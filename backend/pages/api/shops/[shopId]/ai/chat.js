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
import { getGeminiModel, generateWithTimeout } from '../../../../../lib/gemini.js';

// ✅ Clean markdown formatting
function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '')        // Remove bold **text**
    .replace(/\*/g, '')          // Remove italic *text*
    .replace(/^#+\s/gm, '')      // Remove # headers
    .replace(/`/g, '')           // Remove code blocks `
    .replace(/~/g, '')           // Remove strikethrough ~
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')  // Convert [text](url) to text
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
    // ✅ OPTIMIZED PARALLEL QUERIES with timeout and limited fields
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

    // ✅ FAST DATE CALCULATIONS
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayOrders = orders.filter(o => new Date(o.date) >= today);
    const thisMonthOrders = orders.filter(o => new Date(o.date) >= thisMonthStart);

    // Today's stats
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayProfit = todayOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    // This month stats
    const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const thisMonthProfit = thisMonthOrders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    // Total stats
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const totalProfit = orders.reduce((s, o) => s + (o.totalProfit || 0), 0);

    // ✅ EMPLOYEE SALARY ANALYSIS
    const totalMonthlySalary = employees.reduce((s, e) => s + (e.salary?.amount || 0), 0);
    const sortedBySalary = [...employees].sort((a, b) => (a.salary?.amount || 0) - (b.salary?.amount || 0));
    const lowestPaidEmployee = sortedBySalary[0];
    const highestPaidEmployee = sortedBySalary[sortedBySalary.length - 1];
    const avgSalary = employees.length > 0 ? (totalMonthlySalary / employees.length).toFixed(0) : '0';
    const laborCostPercentage = thisMonthRevenue > 0 
      ? (totalMonthlySalary / thisMonthRevenue * 100).toFixed(1)
      : '0.0';

    // ✅ EMPLOYEE PERFORMANCE
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
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // ✅ PRODUCT ANALYSIS
    const productStats = new Map();
    products.forEach(p => {
      productStats.set(p.name, {
        name: p.name,
        unitsSold: 0,
        revenue: 0,
        profit: 0,
        stock: p.stock,
        price: p.price,
        cost: p.cost,
        category: p.category,
        lowStockThreshold: p.lowStockThreshold || 10
      });
    });

    orders.forEach(order => {
      order.items?.forEach(item => {
        const ps = productStats.get(item.name);
        if (ps) {
          ps.unitsSold += item.quantity || 0;
          ps.revenue += (item.price || 0) * (item.quantity || 0);
          ps.profit += ((item.price || 0) - (item.cost || 0)) * (item.quantity || 0);
        }
      });
    });

    const allStats = Array.from(productStats.values());
    const topSellingProducts = [...allStats].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    const leastSellingProducts = [...allStats].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);
    const topProfitProducts = [...allStats].sort((a, b) => b.profit - a.profit).slice(0, 5);
    const lowStockProducts = allStats.filter(p => p.stock <= p.lowStockThreshold);
    const neverSoldProducts = allStats.filter(p => p.unitsSold === 0);

    // ✅ PRODUCT MARGINS
    const productMargins = products
      .map(p => ({
        name: p.name,
        marginPercent: p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => parseFloat(b.marginPercent) - parseFloat(a.marginPercent))
      .slice(0, 5);

    // ✅ PRODUCT BUNDLES
    const productPairs = new Map();
    orders.forEach(order => {
      const itemNames = order.items?.map(item => item.name) || [];
      for (let i = 0; i < itemNames.length; i++) {
        for (let j = i + 1; j < itemNames.length; j++) {
          const pair = [itemNames[i], itemNames[j]].sort().join(' + ');
          productPairs.set(pair, (productPairs.get(pair) || 0) + 1);
        }
      }
    });

    const topBundles = Array.from(productPairs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => `${pair} (${count}x)`);

    // ✅ CATEGORY PERFORMANCE
    const categoryStats = {};
    thisMonthOrders.forEach(order => {
      order.items?.forEach(item => {
        const product = products.find(p => p.name === item.name);
        const category = product?.category || 'Unknown';
        if (!categoryStats[category]) {
          categoryStats[category] = { revenue: 0, profit: 0 };
        }
        categoryStats[category].revenue += (item.price || 0) * (item.quantity || 0);
        categoryStats[category].profit += ((item.price || 0) - (item.cost || 0)) * (item.quantity || 0);
      });
    });

    const topCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 3)
      .map(([cat, stats]) => `${cat} (₹${stats.revenue.toFixed(0)})`);

    // ✅ COMPACT CONTEXT (reduced by 80%)
    const shopContext = `Business AI Assistant. Answer concisely using this data:

TODAY'S PERFORMANCE:
Revenue: ₹${todayRevenue.toFixed(0)}, Profit: ₹${todayProfit.toFixed(0)}, Orders: ${todayOrders.length}

THIS MONTH:
Revenue: ₹${thisMonthRevenue.toFixed(0)}, Profit: ₹${thisMonthProfit.toFixed(0)}, Orders: ${thisMonthOrders.length}

ALL-TIME:
Revenue: ₹${totalRevenue.toFixed(0)}, Profit: ₹${totalProfit.toFixed(0)}, Orders: ${orders.length}

EMPLOYEES (${employees.length} total):
${sortedBySalary.map((e, i) => `${i + 1}. ${e.name}: ₹${e.salary?.amount || 0}/month (${e.salary?.status || 'unpaid'})`).join('\n')}
Lowest: ${lowestPaidEmployee?.name || 'N/A'} (₹${lowestPaidEmployee?.salary?.amount || 0})
Highest: ${highestPaidEmployee?.name || 'N/A'} (₹${highestPaidEmployee?.salary?.amount || 0})
Average: ₹${avgSalary}
Total Payroll: ₹${totalMonthlySalary}
Labor Cost: ${laborCostPercentage}% of revenue

EMPLOYEE WORK PERFORMANCE:
${employeePerformance.map((e, i) => `${i + 1}. ${e.name}: ${e.orderCount} orders, ₹${e.totalRevenue.toFixed(0)} revenue, ₹${e.totalProfit.toFixed(0)} profit`).join('\n')}

TOP 5 BEST SELLERS:
${topSellingProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.unitsSold} units, ₹${p.revenue.toFixed(0)} revenue`).join('\n')}

SLOW MOVERS:
${leastSellingProducts.slice(0, 3).map(p => `${p.name} (${p.unitsSold} units)`).join(', ')}

TOP PROFIT PRODUCTS:
${topProfitProducts.slice(0, 3).map(p => `${p.name} (₹${p.profit.toFixed(0)})`).join(', ')}

BEST MARGINS:
${productMargins.map(p => `${p.name} (${p.marginPercent}%)`).join(', ')}

LOW STOCK (${lowStockProducts.length} items):
${lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock} left)`).join(', ')}

NEVER SOLD (${neverSoldProducts.length} items):
${neverSoldProducts.length > 0 ? neverSoldProducts.slice(0, 3).map(p => p.name).join(', ') : 'None'}

PRODUCT BUNDLES:
${topBundles.length > 0 ? topBundles.join(', ') : 'None yet'}

TOP CATEGORIES:
${topCategories.join(', ')}

USER QUESTION: ${userMessage}

INSTRUCTIONS:
- Use exact names and amounts from data above
- Answer in plain text (no asterisks, hashes, or markdown)
- Keep response under 150 words
- Be specific with numbers
- Use ₹ for rupees`;

    // ✅ AI CALL WITH TIMEOUT PROTECTION
    const model = getGeminiModel();
    
    try {
      const aiResponse = await generateWithTimeout(model, shopContext, 7000);
      const cleanedResponse = cleanMarkdown(aiResponse);
      res.status(200).json({ reply: cleanedResponse });
    } catch (error) {
      console.error('AI Error:', error.message);
      
      // ✅ GRACEFUL FALLBACK
      if (error.message === 'AI_TIMEOUT') {
        const fallbackResponse = `I can help you with:

1. "How much did we earn today?" - Revenue: ₹${todayRevenue.toFixed(0)}, Profit: ₹${todayProfit.toFixed(0)}
2. "Which employee has lowest salary?" - ${lowestPaidEmployee?.name || 'N/A'} at ₹${lowestPaidEmployee?.salary?.amount || 0}
3. "Top selling products?" - ${topSellingProducts[0]?.name || 'N/A'} (${topSellingProducts[0]?.unitsSold || 0} units)
4. "Low stock items?" - ${lowStockProducts.length} items need restocking
5. "This month's performance?" - ₹${thisMonthRevenue.toFixed(0)} revenue, ${thisMonthOrders.length} orders

Ask a specific question!`;
        
        res.status(200).json({ reply: fallbackResponse });
      } else {
        throw error;
      }
    }

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

