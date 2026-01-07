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

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // Gather shop context
    const products = await Product.find({ shopId }).lean();
    const orders = await Order.find({ shopId })
      .sort({ date: -1 })
      .limit(100)
      .lean();

    // Calculate today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(
      (order) => new Date(order.date) >= today
    );
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const todayProfit = todayOrders.reduce((sum, o) => sum + o.totalProfit, 0);

    // Calculate total stats
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalProfit = orders.reduce((sum, o) => sum + o.totalProfit, 0);
    const totalOrders = orders.length;

    // Low stock products
    const lowStockProducts = products.filter(
      (p) => p.stock <= (p.lowStockThreshold || 10)
    );

    // Build context for AI
    const shopContext = `
You are an AI business assistant for a retail shop. Answer questions based on this data:

**Shop Inventory:**
- Total Products: ${products.length}
- Low Stock Items: ${lowStockProducts.length}
${
  lowStockProducts.length > 0
    ? `- Critical Stock: ${lowStockProducts
        .slice(0, 5)
        .map((p) => `${p.name} (${p.stock} units)`)
        .join(', ')}`
    : ''
}

**Today's Performance:**
- Revenue: ₹${todayRevenue.toFixed(2)}
- Profit: ₹${todayProfit.toFixed(2)}
- Orders: ${todayOrders.length}

**Overall Stats:**
- Total Orders: ${totalOrders}
- Total Revenue: ₹${totalRevenue.toFixed(2)}
- Total Profit: ₹${totalProfit.toFixed(2)}

**Top Products by Stock:**
${products
  .sort((a, b) => b.stock - a.stock)
  .slice(0, 5)
  .map((p) => `- ${p.name}: ${p.stock} units (₹${p.price})`)
  .join('\n')}

**Recent Orders (Last 10):**
${orders
  .slice(0, 10)
  .map(
    (o) =>
      `- ${o.customerName}: ₹${o.total} on ${new Date(o.date).toLocaleDateString()}`
  )
  .join('\n')}

User Question: ${message}

Provide a helpful, concise answer with specific numbers and actionable insights. Format currency in Indian Rupees (₹). Use bullet points for lists.
    `.trim();

    // Call Gemini AI
    const model = getGeminiModel();
    const result = await model.generateContent(shopContext);
    const response = result.response;
    const aiResponse = response.text();

    res.status(200).json({ reply: aiResponse });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      message: 'Failed to get AI response',
      error: error.message,
    });
  }
}

export default authMiddleware(handler);

