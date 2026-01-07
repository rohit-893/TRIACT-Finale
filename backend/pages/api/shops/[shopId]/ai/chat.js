import connectDB from "../../../../../lib/db.js";
import Product from "../../../../../models/Product.js";
import User from "../../../../../models/User.js";
import Order from "../../../../../models/Order.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import { getOpenAIClient } from "../../../../../lib/openai.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await connectDB();
  const { shopId } = req.query;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }

  const { query } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ message: "Query is required." });
  }

  try {
    console.log("[AI CHAT] User query:", query);

    // Fetch shop data for context
    const products = await Product.find({ shopId });
    const employees = await User.find({ shopId, role: "employee" }).select(
      "-passwordHash"
    );
    const recentOrders = await Order.find({ shopId })
      .sort({ date: -1 })
      .limit(10);

    // Build context string
    const contextParts = [];

    contextParts.push("=== PRODUCTS ===");
    products.forEach((p) => {
      contextParts.push(
        `- ${p.name} (Category: ${p.category}, Price: Rs.${p.price}, Cost: Rs.${p.cost}, Stock: ${p.stock}, Low Stock Threshold: ${p.lowStockThreshold})`
      );
    });

    contextParts.push("\n=== EMPLOYEES ===");
    employees.forEach((e) => {
      contextParts.push(
        `- ${e.name} (Email: ${e.email}, Salary: Rs.${e.salary.amount}, Status: ${e.salary.status})`
      );
    });

    contextParts.push("\n=== RECENT ORDERS (Last 10) ===");
    recentOrders.forEach((o) => {
      contextParts.push(
        `- Order #${o._id}: Customer: ${o.customerName}, Biller: ${o.billerName}, Total: Rs.${o.total}, Profit: Rs.${o.totalProfit}, Date: ${o.date}`
      );
    });

    const contextString = contextParts.join("\n");

    console.log("[AI CHAT] Context built, calling OpenAI...");

    // Call OpenAI API
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or "gpt-4" for better quality
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant for a shop management system. Answer questions based on the following shop data. Be concise and accurate.

${contextString}`,
        },
        {
          role: "user",
          content: query,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = completion.choices[0].message.content;

    console.log("[AI CHAT] OpenAI response received");

    res.status(200).json({
      answer: answer,
      debugComment: `Context: ${products.length} products, ${employees.length} employees, ${recentOrders.length} recent orders`,
    });
  } catch (error) {
    console.error("[AI CHAT] Error:", error);
    res.status(500).json({
      message: "Failed to process AI query",
      error: error.message,
    });
  }
}

export default authMiddleware(handler);
