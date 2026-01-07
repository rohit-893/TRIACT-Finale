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

  const startTime = Date.now();

  try {
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

    // ✅ PARALLEL QUERIES - Fetch everything at once
    const [products, orders, employees] = await Promise.all([
      Product.find({ shopId })
        .select('name price cost stock')
        .limit(50)
        .lean(),
      Order.find({ shopId })
        .select('date total totalProfit items billerName')
        .sort({ date: -1 })
        .limit(30) // ✅ Reduced to 30
        .lean(),
      User.find({ shopId, role: 'employee' })
        .select('name salary.amount')
        .lean(),
    ]);

    console.log(`Data fetched in ${Date.now() - startTime}ms`);

    // Quick calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter(o => new Date(o.date) >= today);
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const totalProfit = orders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    // Product stats
    const productStats = new Map();
    products.forEach(p => {
      productStats.set(p.name, {
        name: p.name,
        sold: 0,
        profit: 0,
        stock: p.stock,
        margin: ((p.price - p.cost) / p.price * 100).toFixed(0),
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

    const stats = Array.from(productStats.values());
    const top5 = stats.sort((a, b) => b.sold - a.sold).slice(0, 5);
    const bottom5 = stats.sort((a, b) => a.sold - b.sold).slice(0, 5);

    // Employee stats
    const totalSalary = employees.reduce((s, e) => s + (e.salary?.amount || 0), 0);

    // ✅ MINIMAL CONTEXT - Only essential data
    const context = `Business AI Assistant. Answer briefly.

TODAY: ₹${todayRevenue} revenue, ₹${todayProfit} profit, ${todayOrders.length} orders

TOTALS: ${products.length} products, ${orders.length} orders, ₹${totalRevenue} revenue, ₹${totalProfit} profit

EMPLOYEES: ${employees.length} staff, ₹${totalSalary} monthly payroll

TOP 5 PRODUCTS: ${top5.map(p => `${p.name}(${p.sold} sold, ${p.margin}% margin)`).join(', ')}

BOTTOM 5: ${bottom5.map(p => `${p.name}(${p.sold} sold)`).join(', ')}

Q: ${userMessage}

Give a short, specific answer with numbers.`;

    console.log(`Context built in ${Date.now() - startTime}ms`);

    // ✅ FAST GEMINI CALL
    const model = getGeminiModel();
    const result = await model.generateContent(context);
    const aiResponse = result.response.text();

    console.log(`Total time: ${Date.now() - startTime}ms`);

    res.status(200).json({ reply: aiResponse });
  } catch (error) {
    console.error('AI Error:', error.message);
    res.status(500).json({
      reply: error.message.includes('API') 
        ? 'Gemini API error. Check your API key in Vercel settings.'
        : `Error: ${error.message}`,
    });
  }
}

export const config = {
  maxDuration: 10, // Vercel hobby plan limit
};

export default authMiddleware(handler);




