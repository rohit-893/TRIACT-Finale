// backend/pages/api/shops/[shopId]/ai/chat.js

import connectDB from "../../../../../lib/db.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import { SCHEMAS } from "../../../../../lib/schemas.js";
import { getGeminiModel } from "../../../../../lib/gemini.js";
import mongoose from "mongoose"; // <-- 1. ADD THIS IMPORT

// Import all the models the AI is allowed to query
import Product from "../../../../../models/Product.js";
import Order from "../../../../../models/Order.js";
import Invoice from "../../../../../models/Invoice.js";
import User from "../../../../../models/User.js";

const getRelativeDates = () => {
  // We use the user's "current" date from your context for consistency.
  const now = new Date('2025-11-14T12:00:00.000Z');

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const startOfLast90Days = new Date(now);
  startOfLast90Days.setDate(now.getDate() - 90);
  startOfLast90Days.setHours(0, 0, 0, 0);

  return {
    '{{DATE_START_OF_TODAY}}': startOfToday.toISOString(),
    '{{DATE_END_OF_TODAY}}': endOfToday.toISOString(),
    '{{DATE_START_OF_THIS_MONTH}}': startOfMonth.toISOString(),
    '{{DATE_END_OF_THIS_MONTH}}': endOfMonth.toISOString(),
    '{{DATE_START_OF_LAST_MONTH}}': startOfLastMonth.toISOString(),
    '{{DATE_END_OF_LAST_MONTH}}': endOfLastMonth.toISOString(),
    '{{DATE_START_OF_LAST_90_DAYS}}': startOfLast90Days.toISOString(),
    '{{DATE_NOW}}': now.toISOString(), // Use for "up to now"
  };
};

// This map is created once when the file loads.
const datePlaceholders = getRelativeDates()

const ALLOWED_MODELS = {
  Product,
  Order,
  Invoice,
  User,
};
const objectIdRegex = /ObjectId\((?:'([^']*)'|([^)]*))\)/;

// --- This function remains the same ---
function cleanMongoQuery(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanMongoQuery);
  }
  if (obj['$date'] && obj['$date']['$numberLong'] !== undefined) {
    const milliseconds = parseInt(obj['$date']['$numberLong'], 10);
    if (!isNaN(milliseconds)) {
      console.log(`[CleanQuery] Converted invalid date object to JS Date: ${new Date(milliseconds)}`);
      return new Date(milliseconds);
    } else {
       console.warn(`[CleanQuery] Found invalid date object, but failed to parse $numberLong: ${obj['$date']['$numberLong']}`);
       return obj; 
    }
  }
  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        const match = value.match(objectIdRegex);
        if (match) {
          newObj[key] = match[1] || match[2];
        } else {
          newObj[key] = value;
        }
      } else if (typeof value === 'object') {
        newObj[key] = cleanMongoQuery(value);
      } else {
        newObj[key] = value;
      }
    }
  }
  return newObj;
}
async function callGemini(prompt, format) {
  const model = getGeminiModel(); 
  const generationConfig = {
    temperature: 0.2, 
    maxOutputTokens: 2048,
    response_mime_type: format === "json" ? "application/json" : "text/plain",
  };
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });
    const response = result.response;
    return response.text();
  } catch (e) {
    console.error("[GEMINI API Error]:", e);
    if (e.message.includes("SAFETY")) {
       throw new Error("The request was blocked due to safety settings.");
    }
    throw new Error(`Gemini API request failed: ${e.message}`);
  }
}
const getQueryGenerationPrompt = (question, schemas, categories) => `
You are an expert MongoDB query assistant. Your job is to convert a user's natural language question into a valid, secure MongoDB query.
You must only respond with a single JSON object.

The database schemas you can use are:
${schemas}

---
The available product categories in this shop are:
[${categories.map(c => `'${c}'`).join(', ')}]
---

Rules:
1.  **If the user asks for a list of items**, use the "query" key to filter. Use regex for case-insensitive string matching.
2.  **When filtering by category (e.g., "snacks items", "personal care"), you MUST match the user's input to one of the available categories listed above.** (e.g., 'snacks items' should match 'Snacks').
3.  **If the user asks for a calculation (like a total, sum, count, or average)**, you MUST use the "aggregate" key.
4.  **For aggregations**, "aggregate" should be a string: "sum", "count", or "average".
5.  **For "sum" or "average"**, you MUST also provide the "field" key (e.g., "totalProfit", "stock").
6.  **For "count"**, you do not need a "field" key.
7.  Always use ISO 8601 strings for date queries (e.g., { date: { "$gte": "2025-10-01T00:00:00.000Z" } }).
8.  Provide a short "comment" explaining your query.

---
Example 1: Find a list (find query).
User Question: "Which products are low on stock?"
Response:
{
  "model": "Product",
  "query": { "stock": { "$lte": 10 } },
  "options": { "sort": { "stock": 1 }, "limit": 10 },
  "comment": "Searching for products with stock less than or equal to 10."
}

---
Example 2: Calculate a sum (aggregate query).
User Question: "What is the total stock for the 'Snacks' category?"
Response:
{
  "model": "Product",
  "aggregate": "sum",
  "field": "stock",
  "query": { "category": "Snacks" },
  "comment": "Summing 'stock' for all products in 'Snacks' category."
}

---
Example 3: Count documents (aggregate query).
User Question: "How many employees are due for payment?"
Response:
{
  "model": "User",
  "aggregate": "count",
  "query": { "salary.status": "pending" },
  "comment": "Counting users where salary status is 'pending'."
}

---
Now, generate the JSON for the user's question.
User Question: "${question}"
JSON Response:
`;

const getAnswerGenerationPrompt = (question, dbResults) => `
You are a helpful shop assistant AI based in India. You will be given a user's question and the data retrieved from the database.
Your job is to answer the user's question in a friendly, concise, natural language response.

User Question: "${question}"

Database Results (as JSON):
${JSON.stringify(dbResults)}

Rules:
1.  If the results are an empty array, say you couldn't find any matching information.
2.  **If the results are an object like { "total": 0 }, it means no data was found for the calculation.** Respond politely (e.g., "There were no sales last month, so the total profit is ₹0.").
3.  **If the results are an object like { "total": 5000 }, that is the answer to the user's calculation.**
4.  If the results are an array of documents, summarize them to answer the question.
5.  When stating any monetary value (prices, costs, revenue, profit, salary), ALWAYS use the Indian Rupee symbol (₹) before the number (e.g., ₹1,234.50, ₹50,000).
6.  Be friendly and professional.

Assistant's Answer:
`;


async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await connectDB();
  const { shopId } = req.query;
  const { query: userQuestion } = req.body;

  if (req.user.shopId !== shopId) {
    return res.status(403).json({ message: "Access denied." });
  }
  if (!userQuestion) {
    return res.status(400).json({ message: "Query is required." });
  }

  try {
    // === Step 1: Generate the MongoDB Query ===
    
    // --- NEW: Fetch categories to make the AI smarter ---
    const categories = await Product.distinct("category", { shopId: shopId });
    
    const queryPrompt = getQueryGenerationPrompt(userQuestion, SCHEMAS, categories);
    const queryGenText = await callGemini(queryPrompt, "json");

    let parsedQuery;
    try {
      parsedQuery = JSON.parse(queryGenText);
    } catch (e) {
      console.error("AI failed to generate valid JSON. Raw response:", queryGenText);
      return res.status(500).json({ answer: "The AI assistant had trouble understanding that. Please rephrase your question." });
    }
    
    const { model, query, options, comment, aggregate, field } = parsedQuery;
    const modelName = model || parsedQuery.model_name;

    // === Step 2: Securely Execute the Query ===
    const Model = ALLOWED_MODELS[modelName];
    if (!Model) { 
      console.error("AI returned invalid model name:", modelName); 
      return res.status(400).json({ answer: "I can't answer questions about that topic." });
    }

    const cleanedQuery = cleanMongoQuery(query);
    const secureQuery = { ...cleanedQuery, shopId: shopId }; 

    // --- UNIVERSAL ObjectId FIX ---
    // Cast shopId to ObjectId. This is required for both find() and aggregate()
    // to reliably match the database schema.
    if (secureQuery.shopId) {
        try {
            secureQuery.shopId = new mongoose.Types.ObjectId(secureQuery.shopId);
        } catch (e) {
            console.error("Invalid shopId format:", secureQuery.shopId);
            return res.status(400).json({ answer: "Invalid shop ID." });
        }
    }
    // --- END OF FIX ---

    let dbResults; 

    if (aggregate) {
      // --- This is an AGGREGATION query ---
      console.log(`[AI RAG] Performing aggregation: ${aggregate} on ${modelName}`);
      const pipeline = [];
      
      // `secureQuery` now has the correct ObjectId
      pipeline.push({ $match: secureQuery });

      // Add the calculation stage
      if (aggregate === "sum") {
        pipeline.push({ $group: { _id: null, total: { $sum: `$${field}` } } });
      } else if (aggregate === "average") {
        pipeline.push({ $group: { _id: null, total: { $avg: `$${field}` } } });
      } else if (aggregate === "count") {
        pipeline.push({ $count: "total" });
      }

      console.log("[AI RAG] Pipeline:", JSON.stringify(pipeline, null, 2));
      const aggResult = await Model.aggregate(pipeline);
      
      if (aggResult.length > 0) {
        dbResults = { total: aggResult[0].total };
      } else {
        dbResults = { total: 0 }; 
      }

    } else {
      // --- This is a standard FIND query ---
      console.log(`[AI RAG] Performing find on ${modelName}`);
      const queryOptions = {
          limit: options?.limit || 20, 
          sort: options?.sort || { createdAt: -1 },
      };
      // `secureQuery` now also has the correct ObjectId for find()
      dbResults = await Model.find(secureQuery, null, queryOptions).lean();
    }
    
    // === Step 3: Generate the Final Answer ===
    const answerPrompt = getAnswerGenerationPrompt(userQuestion, dbResults);
    const finalAnswer = await callGemini(answerPrompt, "text");

    res.status(200).json({ answer: finalAnswer, debugComment: comment });

  } catch (error) {
    console.error("AI Chat Error:", error);
    // ... (rest of your error handling)
    if (error.message.includes("GEMINI_API_KEY")) {
       return res.status(500).json({ answer: "The AI server is not configured. Please add a GEMINI_API_KEY to the .env file." });
    }
    // ... (rest of error handling)
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default authMiddleware(handler);