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
    // ✅ OPTIMIZED: Fetch less data - only last 50 orders instead of 200
    const products = await Product.find({ shopId }).select('name category price cost stock lowStockThreshold').lean();
    const orders = await Order.find({ shopId })
      .select('date total totalProfit items billerName customerName')
      .sort({ date: -1 })
      .limit(50) // ✅ Reduced from 200 to 50
      .lean();
    
    const employees = await User.find({ shopId, role: 'employee' })
      .select('name salary')
      .lean();

    // Date calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    lastMonthEnd.setHours(23, 59, 59, 999);

    const todayOrders = orders.filter(o => new Date(o.date) >= today);
    const thisMonthOrders = orders.filter(o => new Date(o.date) >= thisMonthStart);
    const lastMonthOrders = orders.filter(o => {
      const orderDate = new Date(o.date);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });

    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const thisMonthProfit = thisMonthOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);
    const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lastMonthProfit = lastMonthOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    const revenueChange = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : '0.0';
    const profitChange = lastMonthProfit > 0
      ? ((thisMonthProfit - lastMonthProfit) / lastMonthProfit * 100).toFixed(1)
      : '0.0';

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalProfit = orders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    const totalMonthlySalary = employees.reduce((sum, emp) => sum + (emp.salary?.amount || 0), 0);
    const laborCostPercentage = thisMonthRevenue > 0 
      ? (totalMonthlySalary / thisMonthRevenue * 100).toFixed(1)
      : '0.0';

    // Employee performance
    const employeeStats = {};
    orders.forEach(order => {
      const biller = order.billerName;
      if (!employeeStats[biller]) {
        employeeStats[biller] = { name: biller, orderCount: 0, totalRevenue: 0, totalProfit: 0 };
      }
      employeeStats[biller].orderCount++;
      employeeStats[biller].totalRevenue += order.total || 0;
      employeeStats[biller].totalProfit += order.totalProfit || 0;
    });

    const employeePerformance = Object.values(employeeStats)
      .map(emp => ({
        ...emp,
        avgRevenuePerOrder: emp.orderCount > 0 ? (emp.totalRevenue / emp.orderCount).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5); // ✅ Top 5 only

    const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 10));

    // Product analysis
    const productStats = new Map();
    products.forEach(product => {
      productStats.set(product.name, {
        name: product.name,
        unitsSold: 0,
        revenue: 0,
        profit: 0,
        stock: product.stock,
        price: product.price,
        cost: product.cost,
      });
    });

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const existing = productStats.get(item.name);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.price * item.quantity;
          existing.profit += (item.price - item.cost) * item.quantity;
        }
      });
    });

    const allProductStats = Array.from(productStats.values());
    const topSellingProducts = [...allProductStats].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    const leastSellingProducts = [...allProductStats].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);
    const topProfitProducts = [...allProductStats].sort((a, b) => b.profit - a.profit).slice(0, 5);

    const productMargins = products
      .map(p => ({
        name: p.name,
        marginPercent: ((p.price - p.cost) / p.price * 100).toFixed(1),
        margin: p.price - p.cost,
      }))
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .slice(0, 5);

    const neverSoldProducts = allProductStats.filter(p => p.unitsSold === 0).slice(0, 5);

    // ✅ SIMPLIFIED CONTEXT - Less text for faster processing
    const shopContext = `You are a business AI assistant. Answer concisely using this data:

**TODAY:** Revenue ₹${todayRevenue.toFixed(2)}, Profit ₹${todayProfit.toFixed(2)}, Orders ${todayOrders.length}

**THIS MONTH vs LAST MONTH:**
Current: ₹${thisMonthRevenue.toFixed(2)} revenue, ₹${thisMonthProfit.toFixed(2)} profit, ${thisMonthOrders.length} orders
Previous: ₹${lastMonthRevenue.toFixed(2)} revenue, ₹${lastMonthProfit.toFixed(2)} profit
Change: Revenue ${revenueChange}%, Profit ${profitChange}%

**EMPLOYEES:**
Total: ${employees.length}, Monthly Salaries: ₹${totalMonthlySalary.toFixed(2)}, Labor Cost: ${laborCostPercentage}% of revenue
Top Performers: ${employeePerformance.map(e => `${e.name} (₹${e.totalRevenue.toFixed(2)}, ${e.orderCount} orders)`).join(', ')}

**TOP 5 BEST SELLERS:**
${topSellingProducts.map(p => `${p.name}: ${p.unitsSold} units, ₹${p.profit.toFixed(2)} profit`).join('; ')}

**TOP 5 LEAST SOLD:**
${leastSellingProducts.map(p => `${p.name}: ${p.unitsSold} units`).join('; ')}

**NEVER SOLD (${neverSoldProducts.length}):** ${neverSoldProducts.map(p => p.name).join(', ') || 'None'}

**TOP 5 PROFIT MAKERS:**
${topProfitProducts.map(p => `${p.name}: ₹${p.profit.toFixed(2)}`).join('; ')}

**TOP 5 MARGINS:**
${productMargins.map(p => `${p.name}: ${p.marginPercent}%`).join('; ')}

**LOW STOCK:** ${lowStockProducts.length > 0 ? lowStockProducts.map(p => `${p.name} (${p.stock})`).join(', ') : 'None'}

Question: ${userMessage}

Answer clearly with specific numbers.`;

    const model = getGeminiModel();
    const result = await model.generateContent(shopContext);
    const response = await result.response;
    const aiResponse = response.text();

    res.status(200).json({ reply: aiResponse });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      reply: `Error: ${error.message}`,
    });
  }
}

// ✅ INCREASE TIMEOUT FOR VERCEL
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    maxDuration: 30, // Max for hobby plan is 10s, but declaring helps
  },
};

export default authMiddleware(handler);




