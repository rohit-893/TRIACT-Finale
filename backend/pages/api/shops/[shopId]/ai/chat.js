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
    const products = await Product.find({ shopId }).lean();
    const orders = await Order.find({ shopId })
      .sort({ date: -1 })
      .limit(200)
      .lean();
    
    // Get employees with salary data
    const employees = await User.find({ shopId, role: 'employee' }).lean();

    // Date calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    lastMonthEnd.setHours(23, 59, 59, 999);

    // Filter orders by time period
    const todayOrders = orders.filter(o => new Date(o.date) >= today);
    const thisMonthOrders = orders.filter(o => new Date(o.date) >= thisMonthStart);
    const lastMonthOrders = orders.filter(o => {
      const orderDate = new Date(o.date);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });

    // Today's stats
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    // This month stats
    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const thisMonthProfit = thisMonthOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    // Last month stats
    const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lastMonthProfit = lastMonthOrders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    // Month-over-month comparison
    const revenueChange = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : '0.0';
    const profitChange = lastMonthProfit > 0
      ? ((thisMonthProfit - lastMonthProfit) / lastMonthProfit * 100).toFixed(1)
      : '0.0';

    // Total stats
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalProfit = orders.reduce((sum, o) => sum + (o.totalProfit || 0), 0);

    // Employee salary analysis
    const totalMonthlySalary = employees.reduce((sum, emp) => sum + (emp.salary?.amount || 0), 0);
    const laborCostPercentage = thisMonthRevenue > 0 
      ? (totalMonthlySalary / thisMonthRevenue * 100).toFixed(1)
      : '0.0';

    // Employee performance tracking
    const employeeStats = {};
    orders.forEach(order => {
      const biller = order.billerName;
      if (!employeeStats[biller]) {
        employeeStats[biller] = {
          name: biller,
          orderCount: 0,
          totalRevenue: 0,
          totalProfit: 0,
        };
      }
      employeeStats[biller].orderCount++;
      employeeStats[biller].totalRevenue += order.total || 0;
      employeeStats[biller].totalProfit += order.totalProfit || 0;
    });

    const employeePerformance = Object.values(employeeStats)
      .map(emp => ({
        ...emp,
        avgRevenuePerOrder: emp.orderCount > 0 ? (emp.totalRevenue / emp.orderCount).toFixed(2) : '0.00',
        avgProfitPerOrder: emp.orderCount > 0 ? (emp.totalProfit / emp.orderCount).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const lowStockProducts = products.filter(
      (p) => p.stock <= (p.lowStockThreshold || 10)
    );

    // Product sales analysis
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

    // Product bundle analysis (frequently bought together)
    const productPairs = new Map();
    orders.forEach(order => {
      const itemNames = order.items.map(item => item.name);
      for (let i = 0; i < itemNames.length; i++) {
        for (let j = i + 1; j < itemNames.length; j++) {
          const pair = [itemNames[i], itemNames[j]].sort().join(' + ');
          productPairs.set(pair, (productPairs.get(pair) || 0) + 1);
        }
      }
    });

    const topBundles = Array.from(productPairs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pair, count]) => `${pair} (${count} times)`);

    const allProductStats = Array.from(productStats.values());
    const topSellingProducts = [...allProductStats]
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    const leastSellingProducts = [...allProductStats]
      .sort((a, b) => a.unitsSold - b.unitsSold)
      .slice(0, 10);

    const topProfitProducts = [...allProductStats]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const productMargins = products.map(p => ({
      name: p.name,
      price: p.price,
      cost: p.cost,
      margin: p.price - p.cost,
      marginPercent: ((p.price - p.cost) / p.price * 100).toFixed(1),
      stock: p.stock
    })).sort((a, b) => b.marginPercent - a.marginPercent);

    const neverSoldProducts = allProductStats
      .filter(p => p.unitsSold === 0)
      .map(p => `${p.name} (Stock: ${p.stock})`);

    // Category performance this month vs last month
    const categoryStatsThisMonth = {};
    const categoryStatsLastMonth = {};

    thisMonthOrders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p.name === item.name);
        const category = product?.category || 'Unknown';
        if (!categoryStatsThisMonth[category]) {
          categoryStatsThisMonth[category] = { revenue: 0, profit: 0 };
        }
        categoryStatsThisMonth[category].revenue += item.price * item.quantity;
        categoryStatsThisMonth[category].profit += (item.price - item.cost) * item.quantity;
      });
    });

    lastMonthOrders.forEach(order => {
      order.items.forEach(item => {
        const product = products.find(p => p.name === item.name);
        const category = product?.category || 'Unknown';
        if (!categoryStatsLastMonth[category]) {
          categoryStatsLastMonth[category] = { revenue: 0, profit: 0 };
        }
        categoryStatsLastMonth[category].revenue += item.price * item.quantity;
        categoryStatsLastMonth[category].profit += (item.price - item.cost) * item.quantity;
      });
    });

    const categoryComparison = Object.keys({...categoryStatsThisMonth, ...categoryStatsLastMonth})
      .map(category => {
        const thisMonth = categoryStatsThisMonth[category] || { revenue: 0, profit: 0 };
        const lastMonth = categoryStatsLastMonth[category] || { revenue: 0, profit: 0 };
        const revenueGrowth = lastMonth.revenue > 0 
          ? ((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue * 100).toFixed(1)
          : 'N/A';
        return `${category}: This Month ₹${thisMonth.revenue.toFixed(2)}, Last Month ₹${lastMonth.revenue.toFixed(2)}, Change: ${revenueGrowth}%`;
      });

    const shopContext = `You are an AI business assistant for a retail shop. Answer the user's question using this comprehensive data:

**TODAY'S PERFORMANCE:**
- Revenue: ₹${todayRevenue.toFixed(2)}
- Profit: ₹${todayProfit.toFixed(2)}
- Orders: ${todayOrders.length}

**THIS MONTH vs LAST MONTH:**
- This Month Revenue: ₹${thisMonthRevenue.toFixed(2)} | Last Month: ₹${lastMonthRevenue.toFixed(2)} | Change: ${revenueChange}%
- This Month Profit: ₹${thisMonthProfit.toFixed(2)} | Last Month: ₹${lastMonthProfit.toFixed(2)} | Change: ${profitChange}%
- This Month Orders: ${thisMonthOrders.length} | Last Month: ${lastMonthOrders.length}

**CATEGORY PERFORMANCE (Month-over-Month):**
${categoryComparison.join('\n')}

**OVERALL STATISTICS:**
- Total Products: ${products.length}
- Total Orders: ${orders.length}
- All-Time Revenue: ₹${totalRevenue.toFixed(2)}
- All-Time Profit: ₹${totalProfit.toFixed(2)}

**EMPLOYEE DATA:**
- Total Employees: ${employees.length}
- Total Monthly Salaries: ₹${totalMonthlySalary.toFixed(2)}
- Labor Cost as % of Revenue: ${laborCostPercentage}%
- Employee Details: ${employees.map(e => `${e.name} (₹${e.salary?.amount || 0}/month, Status: ${e.salary?.status || 'N/A'})`).join(', ')}

**EMPLOYEE PERFORMANCE:**
${employeePerformance.map((emp, i) => `${i + 1}. ${emp.name}: ${emp.orderCount} orders, Revenue: ₹${emp.totalRevenue.toFixed(2)}, Profit: ₹${emp.totalProfit.toFixed(2)}, Avg/Order: ₹${emp.avgRevenuePerOrder}`).join('\n')}

**PRODUCT BUNDLES (Frequently Bought Together):**
${topBundles.length > 0 ? topBundles.join('\n') : 'No bundle patterns detected yet'}

**TOP 10 BEST SELLING PRODUCTS:**
${topSellingProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.unitsSold} units, Revenue: ₹${p.revenue.toFixed(2)}, Profit: ₹${p.profit.toFixed(2)}`).join('\n')}

**TOP 10 LEAST SELLING:**
${leastSellingProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.unitsSold} units, Stock: ${p.stock}`).join('\n')}

**NEVER SOLD (${neverSoldProducts.length} items):**
${neverSoldProducts.length > 0 ? neverSoldProducts.slice(0, 10).join(', ') : 'All products have sales'}

**TOP PROFIT PRODUCTS:**
${topProfitProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p.name}: ₹${p.profit.toFixed(2)}`).join('\n')}

**PROFIT MARGINS (Top 5):**
${productMargins.slice(0, 5).map((p, i) => `${i + 1}. ${p.name}: ${p.marginPercent}% margin (Price: ₹${p.price}, Cost: ₹${p.cost})`).join('\n')}

**LOW STOCK ALERTS:**
${lowStockProducts.length > 0 ? lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock} units)`).join(', ') : 'No low stock items'}

**USER QUESTION:** ${userMessage}

Provide a clear, data-driven answer with specific numbers, product names, and employee names. Use Indian Rupees (₹). Be concise and actionable.`;

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




