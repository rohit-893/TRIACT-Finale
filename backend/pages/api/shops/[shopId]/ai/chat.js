// backend/pages/api/shops/[shopId]/ai/chat.js

import connectDB from '../../../../../lib/db.js';
import Product from '../../../../../models/Product.js';
import Order from '../../../../../models/Order.js';
import User from '../../../../../models/User.js';
import { authMiddleware } from '../../../../../lib/auth.js';
import { getGeminiModel } from '../../../../../lib/gemini.js';

// ✅ RULE-BASED RESPONSE SYSTEM (Instant, No AI needed)
function getRuleBasedResponse(userMessage, stats) {
  const msg = userMessage.toLowerCase();

  // Product count
  if (msg.includes('how many') && msg.includes('product')) {
    return `You currently have **${stats.productCount} products** in your inventory, with ${stats.lowStockCount} items running low on stock.`;
  }

  // Today's earnings
  if ((msg.includes('today') || msg.includes('earn')) && (msg.includes('revenue') || msg.includes('profit') || msg.includes('earn'))) {
    return `**Today's Performance:**\n- Revenue: ₹${stats.todayRevenue.toFixed(2)}\n- Profit: ₹${stats.todayProfit.toFixed(2)}\n- Orders: ${stats.todayOrders}`;
  }

  // Best seller
  if ((msg.includes('most') || msg.includes('best')) && msg.includes('sold')) {
    const top = stats.top5Selling[0];
    return `**${top.name}** is your best-selling product with **${top.sold} units sold**, generating ₹${top.profit.toFixed(2)} in profit.`;
  }

  // Least sold
  if ((msg.includes('least') || msg.includes('slow')) && msg.includes('sold')) {
    const bottom = stats.bottom5Selling[0];
    return `**${bottom.name}** is your slowest-moving product with only **${bottom.sold} units sold**. Current stock: ${bottom.stock} units.`;
  }

  // Highest profit
  if (msg.includes('profit') && (msg.includes('highest') || msg.includes('most'))) {
    const top = stats.top5Profit[0];
    return `**${top.name}** generates the highest profit: **₹${top.profit.toFixed(2)}** from ${top.sold} units sold.`;
  }

  // Low stock
  if (msg.includes('low') && msg.includes('stock')) {
    if (stats.lowStockProducts.length === 0) {
      return 'Good news! You currently have **no low stock items**.';
    }
    return `**Low Stock Alert (${stats.lowStockProducts.length} items):**\n${stats.lowStockProducts.slice(0, 5).map(p => `- ${p.name}: ${p.stock} units remaining`).join('\n')}`;
  }

  // Employee count
  if (msg.includes('employee') || msg.includes('staff')) {
    return `You have **${stats.employeeCount} employees** with a total monthly payroll of ₹${stats.totalSalary.toFixed(2)}, which is ${stats.laborCostPercent}% of your monthly revenue.`;
  }

  // This month summary
  if (msg.includes('this month') || msg.includes('month')) {
    return `**This Month's Performance:**\n- Revenue: ₹${stats.thisMonthRevenue.toFixed(2)}\n- Profit: ₹${stats.thisMonthProfit.toFixed(2)}\n- Orders: ${stats.thisMonthOrders}\n- Products Sold: ${stats.totalUnitsSold} units`;
  }

  // Overall summary
  if (msg.includes('overall') || msg.includes('total') || msg.includes('summary')) {
    return `**Overall Business Summary:**\n- Total Products: ${stats.productCount}\n- Total Orders: ${stats.totalOrders}\n- Total Revenue: ₹${stats.totalRevenue.toFixed(2)}\n- Total Profit: ₹${stats.totalProfit.toFixed(2)}\n- Top Seller: ${stats.top5Selling[0].name} (${stats.top5Selling[0].sold} units)`;
  }

  // Default - Use AI
  return null;
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
    // ✅ FAST DATA FETCH
    const [products, orders, employees] = await Promise.all([
      Product.find({ shopId }).select('name price cost stock lowStockThreshold').limit(100).lean(),
      Order.find({ shopId }).select('date total totalProfit items').sort({ date: -1 }).limit(30).lean(),
      User.find({ shopId, role: 'employee' }).select('name salary.amount').lean(),
    ]);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayOrders = orders.filter(o => new Date(o.date) >= today);
    const thisMonthOrders = orders.filter(o => new Date(o.date) >= thisMonthStart);

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const thisMonthProfit = thisMonthOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const totalProfit = orders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    const totalMonthlySalary = employees.reduce((s, e) => s + (e.salary?.amount || 0), 0);
    const laborCostPercent = thisMonthRevenue > 0 ? (totalMonthlySalary / thisMonthRevenue * 100).toFixed(1) : '0.0';
    const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 10));

    // Product stats
    const productStats = new Map();
    products.forEach(p => {
      productStats.set(p.name, { name: p.name, sold: 0, profit: 0, stock: p.stock, price: p.price, cost: p.cost });
    });

    let totalUnitsSold = 0;
    orders.forEach(order => {
      order.items?.forEach(item => {
        const ps = productStats.get(item.name);
        if (ps) {
          ps.sold += item.quantity;
          ps.profit += (item.price - item.cost) * item.quantity;
          totalUnitsSold += item.quantity;
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
      totalOrders: orders.length,
      totalUnitsSold,
      employeeCount: employees.length,
      totalSalary: totalMonthlySalary,
      laborCostPercent,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      top5Selling,
      bottom5Selling,
      top5Profit,
    };

    // ✅ TRY RULE-BASED FIRST (Instant response)
    const ruleResponse = getRuleBasedResponse(userMessage, stats);
    
    if (ruleResponse) {
      return res.status(200).json({ reply: ruleResponse });
    }

    // ✅ FALLBACK TO AI for complex questions
    try {
      const context = `Business Assistant. Data:

TODAY: ₹${todayRevenue.toFixed(2)} revenue, ₹${todayProfit.toFixed(2)} profit, ${todayOrders.length} orders
THIS MONTH: ₹${thisMonthRevenue.toFixed(2)} revenue, ${thisMonthOrders.length} orders
TOTAL: ${products.length} products, ${orders.length} orders
EMPLOYEES: ${employees.length} staff, ₹${totalMonthlySalary.toFixed(2)} payroll

TOP 5 SELLERS: ${top5Selling.map(p => `${p.name}(${p.sold})`).join(', ')}
SLOW MOVERS: ${bottom5Selling.slice(0, 3).map(p => `${p.name}(${p.sold})`).join(', ')}

Q: ${userMessage}

Answer briefly with numbers.`;

      const model = getGeminiModel();
      
      // ✅ TIMEOUT PROTECTION
      const aiPromise = model.generateContent(context);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI timeout')), 6000) // 6 second timeout
      );

      const result = await Promise.race([aiPromise, timeoutPromise]);
      const aiResponse = result.response.text();

      return res.status(200).json({ reply: aiResponse });
    } catch (aiError) {
      console.error('AI Error:', aiError.message);
      
      // ✅ GRACEFUL FALLBACK
      return res.status(200).json({
        reply: `I can help you with:\n\n• **"How much did we earn today?"**\n• **"Which product sold the most?"**\n• **"Show low stock items"**\n• **"How many employees do we have?"**\n• **"This month's performance"**\n\nTry asking one of these questions!`
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      reply: `Sorry, an error occurred: ${error.message}`,
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





