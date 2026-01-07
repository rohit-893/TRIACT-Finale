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
    // ✅ OPTIMIZED: Fetch less data with parallel queries
    const [products, orders, employees] = await Promise.all([
      Product.find({ shopId })
        .select('name category price cost stock lowStockThreshold')
        .limit(100) // Limit products
        .lean(),
      Order.find({ shopId })
        .select('date total totalProfit items billerName customerName')
        .sort({ date: -1 })
        .limit(30) // ✅ Only 30 recent orders instead of 200
        .lean(),
      User.find({ shopId, role: 'employee' })
        .select('name salary.amount salary.status')
        .lean(),
    ]);

    // Quick date calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Filter orders
    const todayOrders = orders.filter(o => new Date(o.date) >= today);
    const thisMonthOrders = orders.filter(o => new Date(o.date) >= thisMonthStart);

    // Basic stats
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const thisMonthProfit = thisMonthOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const totalProfit = orders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    // Employee data
    const totalMonthlySalary = employees.reduce((s, e) => s + (e.salary?.amount || 0), 0);
    const laborCostPercentage = thisMonthRevenue > 0 
      ? (totalMonthlySalary / thisMonthRevenue * 100).toFixed(1)
      : '0.0';

    // Low stock
    const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 10));

    // Product sales (simplified)
    const productStats = new Map();
    products.forEach(p => {
      productStats.set(p.name, {
        name: p.name,
        sold: 0,
        profit: 0,
        stock: p.stock,
        price: p.price,
        cost: p.cost,
      });
    });

    orders.forEach(order => {
      order.items?.forEach(item => {
        const ps = productStats.get(item.name);
        if (ps) {
          ps.sold += item.quantity;
          ps.profit += (item.price - item.cost) * item.quantity;
        }
      });
    });

    const allStats = Array.from(productStats.values());
    const top5Selling = [...allStats].sort((a, b) => b.sold - a.sold).slice(0, 5);
    const bottom5Selling = [...allStats].sort((a, b) => a.sold - b.sold).slice(0, 5);
    const top5Profit = [...allStats].sort((a, b) => b.profit - a.profit).slice(0, 5);

    // ✅ COMPACT CONTEXT (reduced by 70%)
    const context = `You are a business AI assistant. Answer based on this data:

**TODAY:** Revenue ₹${todayRevenue.toFixed(2)}, Profit ₹${todayProfit.toFixed(2)}, ${todayOrders.length} orders

**THIS MONTH:** Revenue ₹${thisMonthRevenue.toFixed(2)}, Profit ₹${thisMonthProfit.toFixed(2)}, ${thisMonthOrders.length} orders

**OVERALL:** ${products.length} products, ${orders.length} total orders, ₹${totalRevenue.toFixed(2)} revenue, ₹${totalProfit.toFixed(2)} profit

**EMPLOYEES:** ${employees.length} staff, ₹${totalMonthlySalary.toFixed(2)} monthly payroll (${laborCostPercentage}% of revenue)

**TOP 5 BEST SELLERS:**
${top5Selling.map((p, i) => `${i+1}. ${p.name}: ${p.sold} units sold, ₹${p.profit.toFixed(2)} profit`).join('\n')}

**5 SLOWEST SELLERS:**
${bottom5Selling.map(p => `${p.name} (${p.sold} units)`).join(', ')}

**TOP 5 PROFIT MAKERS:**
${top5Profit.map(p => `${p.name}: ₹${p.profit.toFixed(2)}`).join(', ')}

**LOW STOCK (${lowStockProducts.length}):** ${lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock})`).join(', ') || 'None'}

**QUESTION:** ${userMessage}

Provide a clear, brief answer with specific numbers. Use ₹ for currency.`;

    // ✅ FAST GEMINI CALL
    const model = getGeminiModel();
    const result = await model.generateContent(context);
    const aiResponse = result.response.text();

    res.status(200).json({ reply: aiResponse });
  } catch (error) {
    console.error('AI Error:', error.message);
    res.status(500).json({
      reply: error.message.includes('API key') 
        ? 'Gemini API key error. Please verify your GEMINI_API_KEY in Vercel environment variables.'
        : `Error: ${error.message}. The query took too long - try a simpler question.`,
    });
  }
}

export const config = {
  maxDuration: 10, // Vercel free tier limit
};

export default authMiddleware(handler);





