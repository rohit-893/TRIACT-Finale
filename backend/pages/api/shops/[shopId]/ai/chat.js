// // backend/pages/api/shops/[shopId]/ai/chat.js
// import connectDB from "../../../../../lib/db.js";
// import Product from "../../../../../models/Product.js";
// import User from "../../../../../models/User.js";
// import Order from "../../../../../models/Order.js";
// import Shop from "../../../../../models/Shop.js";  // ← ADD THIS
// import { authMiddleware } from "../../../../../lib/auth.js";
// import { getOpenAIClient } from "../../../../../lib/openai.js";

// async function handler(req, res) {
//   if (req.method !== "POST") {
//     return res.status(405).json({ message: "Method Not Allowed" });
//   }

//   await connectDB();
//   const { shopId } = req.query;

//   if (req.user.shopId !== shopId) {
//     return res.status(403).json({ message: "Access denied." });
//   }

//   const { query } = req.body;

//   if (!query || typeof query !== "string") {
//     return res.status(400).json({ message: "Query is required." });
//   }

//   try {
//     console.log("[AI CHAT] User query:", query);

//     // ===== FETCH SHOP INFORMATION =====
//     const shop = await Shop.findById(shopId).populate("ownerId", "name email");
//     const products = await Product.find({ shopId });
//     const employees = await User.find({ shopId, role: "employee" }).select("-passwordHash");
//     const recentOrders = await Order.find({ shopId }).sort({ date: -1 }).limit(10);

//     const contextParts = [];

//     // ===== ADD SHOP INFORMATION TO CONTEXT =====
//     contextParts.push("=== SHOP INFORMATION ===");
//     contextParts.push(`- Shop Name: ${shop.shopName}`);
//     contextParts.push(`- Shop Address/Location: ${shop.address || "Not set"}`);
//     contextParts.push(`- Owner: ${shop.ownerId?.name || "Unknown"}`);
//     contextParts.push(`- Owner Email: ${shop.ownerId?.email || "Unknown"}`);

//     contextParts.push("\n=== PRODUCTS ===");
//     products.forEach((p) => {
//       contextParts.push(
//         `- ${p.name} (Category: ${p.category}, Price: Rs.${p.price}, Cost: Rs.${p.cost}, Stock: ${p.stock}, Threshold: ${p.lowStockThreshold})`
//       );
//     });

//     contextParts.push("\n=== EMPLOYEES ===");
//     employees.forEach((e) => {
//       contextParts.push(
//         `- ${e.name} (Email: ${e.email}, Salary: Rs.${e.salary.amount}, Status: ${e.salary.status})`
//       );
//     });

//     contextParts.push("\n=== RECENT ORDERS (Last 10) ===");
//     recentOrders.forEach((o) => {
//       contextParts.push(
//         `- Order ${o._id}: Customer ${o.customerName}, Biller ${o.billerName}, Total Rs.${o.total}, Profit Rs.${o.totalProfit}, Date: ${new Date(o.date).toLocaleDateString()}`
//       );
//     });

//     const contextString = contextParts.join("\n");

//     console.log("[AI CHAT] Calling OpenAI with complete shop context...");

//     const openai = getOpenAIClient();
    
//     const completion = await openai.chat.completions.create({
//       model: "gpt-5-mini",
//       messages: [
//         {
//           role: "system",
//           content: `You are a helpful shop management assistant for ${shop.shopName}. Answer questions based on the shop data provided below. Be concise, accurate, and friendly.

// ${contextString}`,
//         },
//         {
//           role: "user",
//           content: query,
//         },
//       ],
//       temperature: 0.7,
//       max_tokens: 500,
//     });

//     const answer = completion.choices[0].message.content;

//     console.log("[AI CHAT] Response received");

//     res.status(200).json({
//       answer: answer,
//       debugComment: `Shop: ${shop.shopName}, ${products.length} products, ${employees.length} employees, ${recentOrders.length} orders`,
//     });
//   } catch (error) {
//     console.error("[AI CHAT] Error:", error);
//     res.status(500).json({
//       message: "Failed to process query",
//       error: error.message,
//     });
//   }
// }

// export default authMiddleware(handler);

// backend/pages/api/shops/[shopId]/ai/chat.js

import connectDB from '../../../../../lib/db.js';
import Product from '../../../../../models/Product.js';
import Order from '../../../../../models/Order.js';
import User from '../../../../../models/User.js';
import { authMiddleware } from '../../../../../lib/auth.js';
import { getGeminiModel } from '../../../../../lib/gemini.js';

function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s/gm, '')
    .replace(/`/g, '')
    .replace(/~/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .trim();
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  await connectDB();
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  const { message, query } = req.body;
  const userMessage = message || query;

  if (!userMessage) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // ✅ OPTIMIZED QUERIES with timeout and limited fields
    const [products, orders, employees] = await Promise.all([
      Product.find({ shopId })
        .select('name price cost stock lowStockThreshold category')
        .limit(100)
        .lean()
        .maxTimeMS(3000),
      Order.find({ shopId })
        .select('date total totalProfit items billerName')
        .sort({ date: -1 })
        .limit(50)
        .lean()
        .maxTimeMS(3000),
      User.find({ shopId, role: 'employee' })
        .select('name salary')
        .lean()
        .maxTimeMS(2000)
    ]);

    // Quick date calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayOrders = orders.filter(o => new Date(o.date) >= today);
    const thisMonthOrders = orders.filter(o => new Date(o.date) >= thisMonthStart);

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const thisMonthProfit = thisMonthOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    // Employee salary analysis
    const totalMonthlySalary = employees.reduce((s, e) => s + (e.salary?.amount || 0), 0);
    const sortedBySalary = [...employees].sort((a, b) => (a.salary?.amount || 0) - (b.salary?.amount || 0));
    const lowestPaidEmployee = sortedBySalary[0];
    const highestPaidEmployee = sortedBySalary[sortedBySalary.length - 1];

    // Product stats
    const productStats = new Map();
    products.forEach(p => {
      productStats.set(p.name, {
        name: p.name,
        unitsSold: 0,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold || 10
      });
    });

    orders.forEach(order => {
      order.items?.forEach(item => {
        const ps = productStats.get(item.name);
        if (ps) ps.unitsSold += item.quantity || 0;
      });
    });

    const allStats = Array.from(productStats.values());
    const topSellingProducts = [...allStats].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    const leastSellingProducts = [...allStats].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);
    const lowStockProducts = allStats.filter(p => p.stock <= p.lowStockThreshold);

    // ✅ SHORTER CONTEXT (reduces tokens)
    const shopContext = `Business AI. Answer briefly using this data:

TODAY: Revenue ₹${todayRevenue.toFixed(0)}, Profit ₹${todayProfit.toFixed(0)}, Orders ${todayOrders.length}
THIS MONTH: Revenue ₹${thisMonthRevenue.toFixed(0)}, Profit ₹${thisMonthProfit.toFixed(0)}, Orders ${thisMonthOrders.length}

EMPLOYEES (${employees.length} total, Monthly Payroll: ₹${totalMonthlySalary}):
${sortedBySalary.map((e, i) => `${i + 1}. ${e.name}: ₹${e.salary?.amount || 0}/month`).join('\n')}
Lowest Paid: ${lowestPaidEmployee?.name} (₹${lowestPaidEmployee?.salary?.amount || 0})
Highest Paid: ${highestPaidEmployee?.name} (₹${highestPaidEmployee?.salary?.amount || 0})

TOP 5 SELLERS: ${topSellingProducts.map(p => `${p.name}(${p.unitsSold} units)`).join(', ')}
SLOW MOVERS: ${leastSellingProducts.slice(0, 3).map(p => `${p.name}(${p.unitsSold})`).join(', ')}
LOW STOCK (${lowStockProducts.length}): ${lowStockProducts.slice(0, 3).map(p => `${p.name}(${p.stock})`).join(', ')}

Q: ${userMessage}

Answer in plain text (no markdown), under 150 words, with specific names and numbers.`;

    const model = getGeminiModel();

    // ✅ ADD TIMEOUT PROTECTION
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT')), 7000);
    });

    let aiResponse;
    try {
      const result = await Promise.race([
        model.generateContent(shopContext),
        timeoutPromise
      ]);
      const response = await result.response;
      aiResponse = response.text();
    } catch (error) {
      console.error('AI Error:', error.message);
      
      // Graceful fallback
      if (error.message === 'AI_TIMEOUT') {
        aiResponse = `I can help you with:

1. "How much did we earn today?"
2. "Which employee has the lowest salary?"
3. "Show top selling products"
4. "Which items are low on stock?"
5. "This month's performance"
6. "Employee performance"

Please ask a specific question!`;
      } else {
        throw error;
      }
    }

    const cleanedResponse = cleanMarkdown(aiResponse);
    res.status(200).json({ reply: cleanedResponse });

  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({
      reply: `Error: ${error.message}. Try asking: "Today's revenue" or "Top products"`,
    });
  }
}

export const config = {
  maxDuration: 10,
};

export default authMiddleware(handler);

