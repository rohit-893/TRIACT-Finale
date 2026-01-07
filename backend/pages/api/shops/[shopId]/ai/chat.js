// backend/pages/api/shops/[shopId]/ai/chat.js

import connectDB from '../../../../../lib/db.js';
import Product from '../../../../../models/Product.js';
import Order from '../../../../../models/Order.js';
import User from '../../../../../models/User.js';
import { authMiddleware } from '../../../../../lib/auth.js';

// ✅ SMART RULE-BASED SYSTEM (Instant Responses)
function getSmartResponse(userMessage, stats) {
  const msg = userMessage.toLowerCase();

  // Product queries
  if (msg.match(/how many|total.*product|product.*count|number.*product/i)) {
    return `You currently have **${stats.productCount} products** in your inventory${stats.lowStockCount > 0 ? `, with ${stats.lowStockCount} items running low on stock` : ''}.`;
  }

  // Today's earnings
  if (msg.match(/today|earn.*today|revenue.*today|profit.*today/i)) {
    return `**Today's Performance:**\n- Revenue: ₹${stats.todayRevenue.toFixed(2)}\n- Profit: ₹${stats.todayProfit.toFixed(2)}\n- Orders: ${stats.todayOrders}\n\n${stats.todayProfit > 0 ? '📈 Positive profit!' : '📉 Consider reviewing costs.'}`;
  }

  // Best/Most sold
  if (msg.match(/best.*sell|most.*sold|top.*sell|which.*sold.*most/i)) {
    if (stats.top5Selling[0].sold === 0) {
      return 'No products have been sold yet.';
    }
    const top3 = stats.top5Selling.slice(0, 3);
    return `**Top 3 Best Sellers:**\n${top3.map((p, i) => `${i + 1}. **${p.name}** - ${p.sold} units sold (₹${p.profit.toFixed(2)} profit)`).join('\n')}`;
  }

  // Worst/Least sold
  if (msg.match(/worst|least.*sold|slow.*moving|not.*selling/i)) {
    const slowMovers = stats.bottom5Selling.filter(p => p.sold < 5).slice(0, 3);
    if (slowMovers.length === 0) {
      return 'All products are selling well!';
    }
    return `**Slow-Moving Products:**\n${slowMovers.map(p => `- **${p.name}**: Only ${p.sold} units sold, ${p.stock} in stock`).join('\n')}\n\nConsider promotions or discounts.`;
  }

  // Profit queries
  if (msg.match(/profit|most.*profitable|highest.*profit/i) && !msg.includes('today')) {
    if (stats.top5Profit[0].profit === 0) {
      return 'No profit data available yet.';
    }
    const top3 = stats.top5Profit.slice(0, 3);
    return `**Most Profitable Products:**\n${top3.map((p, i) => `${i + 1}. **${p.name}** - ₹${p.profit.toFixed(2)} profit from ${p.sold} units`).join('\n')}`;
  }

  // Low stock
  if (msg.match(/low.*stock|stock.*low|running.*out|restock/i)) {
    if (stats.lowStockProducts.length === 0) {
      return '✅ Good news! All products are well-stocked.';
    }
    const urgent = stats.lowStockProducts.slice(0, 5);
    return `**⚠️ Low Stock Alert (${stats.lowStockProducts.length} items):**\n${urgent.map(p => `- **${p.name}**: ${p.stock} units left (threshold: ${p.lowStockThreshold})`).join('\n')}\n\nConsider restocking soon!`;
  }

  // Employee queries
  if (msg.match(/employee|staff|worker|salary|payroll/i)) {
    return `**Employee Summary:**\n- Total Employees: **${stats.employeeCount}**\n- Monthly Payroll: ₹${stats.totalSalary.toFixed(2)}\n- Labor Cost: ${stats.laborCostPercent}% of monthly revenue\n\n${parseFloat(stats.laborCostPercent) > 30 ? '⚠️ Labor costs are high.' : '✅ Labor costs are reasonable.'}`;
  }

  // This month
  if (msg.match(/this.*month|current.*month|month/i) && !msg.includes('last')) {
    return `**This Month's Performance:**\n- Revenue: ₹${stats.thisMonthRevenue.toFixed(2)}\n- Profit: ₹${stats.thisMonthProfit.toFixed(2)}\n- Orders: ${stats.thisMonthOrders}\n- Units Sold: ${stats.totalUnitsSold}\n\n${stats.thisMonthProfit > 0 ? '📈 Profitable month so far!' : '📉 Need improvement.'}`;
  }

  // Overall summary
  if (msg.match(/overall|summary|total|all.*time|performance/i)) {
    return `**Overall Business Summary:**\n- Products: ${stats.productCount} (${stats.lowStockCount} low stock)\n- Total Orders: ${stats.totalOrders}\n- All-Time Revenue: ₹${stats.totalRevenue.toFixed(2)}\n- All-Time Profit: ₹${stats.totalProfit.toFixed(2)}\n- Best Seller: **${stats.top5Selling[0].name}** (${stats.top5Selling[0].sold} units)\n\n${stats.totalProfit > 0 ? '✅ Business is profitable!' : '⚠️ Review pricing strategy.'}`;
  }

  // Revenue queries
  if (msg.match(/revenue|earning|sales|income/i)) {
    return `**Revenue Breakdown:**\n- Today: ₹${stats.todayRevenue.toFixed(2)}\n- This Month: ₹${stats.thisMonthRevenue.toFixed(2)}\n- All-Time: ₹${stats.totalRevenue.toFixed(2)}\n\nTotal orders: ${stats.totalOrders}`;
  }

  // Order queries
  if (msg.match(/order|sale.*count|transaction/i)) {
    return `**Order Statistics:**\n- Today: ${stats.todayOrders} orders\n- This Month: ${stats.thisMonthOrders} orders\n- All-Time: ${stats.totalOrders} orders\n\nAverage order value: ₹${stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : '0.00'}`;
  }

  // Default help menu
  return `I can help you with:\n\n📦 **"How many products do we have?"**\n💰 **"How much did we earn today?"**\n🏆 **"Which product sold the most?"**\n📉 **"Show slow-moving products"**\n⚠️ **"Which items are low on stock?"**\n👥 **"How many employees do we have?"**\n📊 **"This month's performance"**\n📈 **"Overall business summary"**\n\nTry asking any of these questions!`;
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
    // ✅ ULTRA-FAST DATA FETCH (Optimized queries)
    const [products, recentOrders, employees] = await Promise.all([
      Product.find({ shopId })
        .select('name price cost stock lowStockThreshold')
        .limit(200)
        .lean()
        .maxTimeMS(3000),
      Order.find({ shopId })
        .select('date total totalProfit items')
        .sort({ date: -1 })
        .limit(100)
        .lean()
        .maxTimeMS(3000),
      User.find({ shopId, role: 'employee' })
        .select('salary.amount')
        .lean()
        .maxTimeMS(2000),
    ]);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayOrders = recentOrders.filter(o => new Date(o.date) >= today);
    const thisMonthOrders = recentOrders.filter(o => new Date(o.date) >= thisMonthStart);

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const thisMonthProfit = thisMonthOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const totalRevenue = recentOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalProfit = recentOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    const totalMonthlySalary = employees.reduce((s, e) => s + (e.salary?.amount || 0), 0);
    const laborCostPercent = thisMonthRevenue > 0 ? (totalMonthlySalary / thisMonthRevenue * 100).toFixed(1) : '0.0';
    const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 10));

    // Product stats
    const productStats = new Map();
    products.forEach(p => {
      productStats.set(p.name, { 
        name: p.name, 
        sold: 0, 
        profit: 0, 
        stock: p.stock, 
        lowStockThreshold: p.lowStockThreshold || 10 
      });
    });

    let totalUnitsSold = 0;
    recentOrders.forEach(order => {
      order.items?.forEach(item => {
        const ps = productStats.get(item.name);
        if (ps) {
          ps.sold += item.quantity || 0;
          ps.profit += ((item.price || 0) - (item.cost || 0)) * (item.quantity || 0);
          totalUnitsSold += item.quantity || 0;
        }
      });
    });

    const allStats = Array.from(productStats.values());
    const top5Selling = [...allStats].sort((a, b) => b.sold - a.sold).slice(0, 5);
    const bottom5Selling = [...allStats].sort((a, b) => a.sold - b.sold).slice(0, 5);
    const top5Profit = [...allStats].sort((a, b) => b.profit - a.profit).slice(0, 5);

    const stats = {
      productCount: products.length,
      todayRevenue,
      todayProfit,
      todayOrders: todayOrders.length,
      thisMonthRevenue,
      thisMonthProfit,
      thisMonthOrders: thisMonthOrders.length,
      totalRevenue,
      totalProfit,
      totalOrders: recentOrders.length,
      totalUnitsSold,
      employeeCount: employees.length,
      totalSalary: totalMonthlySalary,
      laborCostPercent,
      lowStockCount: lowStockProducts.length,
      lowStockProducts: lowStockProducts.map(p => ({
        name: p.name,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold || 10
      })),
      top5Selling,
      bottom5Selling,
      top5Profit,
    };

    // ✅ GET INSTANT RESPONSE
    const response = getSmartResponse(userMessage, stats);

    return res.status(200).json({ reply: response });

  } catch (error) {
    console.error('Chat Error:', error);
    return res.status(200).json({
      reply: 'Sorry, I encountered an error. Please try asking:\n\n• "How many products do we have?"\n• "Today\'s revenue"\n• "Best selling product"',
    });
  }
}

export const config = {
  maxDuration: 10,
};

export default authMiddleware(handler);




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





