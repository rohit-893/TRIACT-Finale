// backend/pages/api/shops/[shopId]/ai/chat.js
import connectDB from "../../../../../../lib/db.js";
import Product from "../../../../../../models/Product.js";
import User from "../../../../../../models/User.js";
import Order from "../../../../../../models/Order.js";
import { authMiddleware } from "../../../../../../lib/auth.js";
import { getOpenAIClient } from "../../../../../../lib/openai.js";

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

    const products = await Product.find({ shopId });
    const employees = await User.find({ shopId, role: "employee" }).select("-passwordHash");
    const recentOrders = await Order.find({ shopId }).sort({ date: -1 }).limit(10);

    const contextParts = [];

    contextParts.push("=== PRODUCTS ===");
    products.forEach((p) => {
      contextParts.push(
        `- ${p.name} (Category: ${p.category}, Price: Rs.${p.price}, Cost: Rs.${p.cost}, Stock: ${p.stock}, Threshold: ${p.lowStockThreshold})`
      );
    });

    contextParts.push("\n=== EMPLOYEES ===");
    employees.forEach((e) => {
      contextParts.push(
        `- ${e.name} (Email: ${e.email}, Salary: Rs.${e.salary.amount}, Status: ${e.salary.status})`
      );
    });

    contextParts.push("\n=== RECENT ORDERS ===");
    recentOrders.forEach((o) => {
      contextParts.push(
        `- Order ${o._id}: Customer ${o.customerName}, Biller ${o.billerName}, Total Rs.${o.total}, Profit Rs.${o.totalProfit}`
      );
    });

    const contextString = contextParts.join("\n");

    console.log("[AI CHAT] Calling OpenAI...");

    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful shop management assistant. Answer based on this data:\n\n${contextString}`,
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

    console.log("[AI CHAT] Response received");

    res.status(200).json({
      answer: answer,
      debugComment: `${products.length} products, ${employees.length} employees, ${recentOrders.length} orders`,
    });
  } catch (error) {
    console.error("[AI CHAT] Error:", error);
    res.status(500).json({
      message: "Failed to process query",
      error: error.message,
    });
  }
}

export default authMiddleware(handler);
