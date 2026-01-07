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

  const { message, query } = req.body;
  const userMessage = message || query;

  if (!userMessage) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    const products = await Product.find({ shopId }).lean();
    const orders = await Order.find({ shopId })
      .sort({ date: -1 })
      .limit(100)
      .lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter((order) => {
      const orderDate = new Date(order.date);
      return orderDate >= today;
    });

    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalProfit = orders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    const lowStockProducts = products.filter(
      (p) => p.stock <= (p.lowStockThreshold || 10)
    );

    const productSales = new Map();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const current = productSales.get(item.name) || 0;
        productSales.set(item.name, current + item.quantity);
      });
    });

    const topProducts = Array.from(productSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => `${name} (${qty} sold)`)
      .join(', ');

    const shopContext = `You are an AI business assistant for a retail shop. Answer the user's question using this data:

**TODAY'S PERFORMANCE:**
- Revenue Today: ₹${todayRevenue.toFixed(2)}
- Profit Today: ₹${todayProfit.toFixed(2)}
- Orders Today: ${todayOrders.length}

**OVERALL STATISTICS:**
- Total Products: ${products.length}
- Total Orders: ${orders.length}
- Total Revenue: ₹${totalRevenue.toFixed(2)}
- Total Profit: ₹${totalProfit.toFixed(2)}

**INVENTORY STATUS:**
- Low Stock Items: ${lowStockProducts.length}
${lowStockProducts.length > 0 ? `- Critical Items: ${lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock} units)`).join(', ')}` : ''}

**TOP SELLING PRODUCTS:**
${topProducts || 'No sales data available'}

**RECENT ORDERS:**
${orders.slice(0, 5).map(o => `- ${o.customerName}: ₹${o.total} (${new Date(o.date).toLocaleDateString('en-IN')})`).join('\n')}

**USER QUESTION:** ${userMessage}

Provide a clear, helpful answer with specific numbers. Use Indian Rupees (₹) for money. Be concise and actionable.`;

    const model = getGeminiModel();
    const result = await model.generateContent(shopContext);
    const response = await result.response;
    const aiResponse = response.text();

    res.status(200).json({ reply: aiResponse });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      reply: `I encountered an error processing your request. Error: ${error.message}`,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default authMiddleware(handler);


