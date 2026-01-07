// backend/pages/api/shops/[shopId]/ai/chat.js

import connectDB from "../../../../../lib/db.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import { SCHEMAS } from "../../../../../lib/schemas.js";
import { getGeminiModel } from "../../../../../lib/gemini.js";
import mongoose from "mongoose";
import Shop from "../../../../../models/Shop.js";

// Import all the models the AI is allowed to query
import Product from "../../../../../models/Product.js";
import Order from "../../../../../models/Order.js";
import Invoice from "../../../../../models/Invoice.js";
import User from "../../../../../models/User.js";

const ALLOWED_MODELS = {
  Product,
  Order,
  Invoice,
  User,
  Shop,
};

const objectIdRegex = /ObjectId\((?:'([^']*)'|([^)]*))\)/;

// --- Helper: Clean MongoDB Query Objects ---
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
      return new Date(milliseconds);
    } else {
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

// --- Helper: Dynamic Date Replacement ---
const replaceDatePlaceholders = (jsonString) => {
  const now = new Date(); 

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const startOfLast90Days = new Date(now);
  startOfLast90Days.setDate(now.getDate() - 90);
  startOfLast90Days.setHours(0, 0, 0, 0);

  const replacements = {
    '"{{DATE_START_OF_TODAY}}"': `"${startOfToday.toISOString()}"`,
    '"{{DATE_END_OF_TODAY}}"': `"${endOfToday.toISOString()}"`,
    '"{{DATE_START_OF_THIS_MONTH}}"': `"${startOfMonth.toISOString()}"`,
    '"{{DATE_END_OF_THIS_MONTH}}"': `"${endOfMonth.toISOString()}"`,
    '"{{DATE_START_OF_LAST_MONTH}}"': `"${startOfLastMonth.toISOString()}"`,
    '"{{DATE_END_OF_LAST_MONTH}}"': `"${endOfLastMonth.toISOString()}"`,
    '"{{DATE_START_OF_LAST_90_DAYS}}"': `"${startOfLast90Days.toISOString()}"`,
    '"{{DATE_NOW}}"': `"${now.toISOString()}"`
  };

  let updatedString = jsonString;
  for (const [key, value] of Object.entries(replacements)) {
    updatedString = updatedString.split(key).join(value);
  }
  return updatedString;
};

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
    return result.response.text();
  } catch (e) {
    console.error("[GEMINI API Error]:", e);
    throw new Error(`Gemini API request failed: ${e.message}`);
  }
}

const getQueryGenerationPrompt = (question, schemas, categories) => `
You are an expert MongoDB query assistant. Your job is to convert a user's natural language question into a valid, secure MongoDB query.
You must only respond with a single JSON object.

The database schemas you can use are:
${schemas}

The available product categories are:
[${categories.map(c => `'${c}'`).join(', ')}]

Rules:
1.  **If the user asks for a list**, use the "query" key to filter.
2.  **Calculations (total, sum, count, average)** MUST use the "aggregate" key ("sum", "count", "average").
3.  **For "sum" or "average"**, provide the "field" key.
4.  **Dates:** Do NOT generate static dates. Use these placeholders EXACTLY (including double quotes):
    - "{{DATE_START_OF_TODAY}}"
    - "{{DATE_END_OF_TODAY}}"
    - "{{DATE_START_OF_THIS_MONTH}}"
    - "{{DATE_END_OF_THIS_MONTH}}"
    - "{{DATE_START_OF_LAST_MONTH}}"
    - "{{DATE_END_OF_LAST_MONTH}}"
    - "{{DATE_START_OF_LAST_90_DAYS}}"
    - "{{DATE_NOW}}"
5.  **Top/Most Items (IMPORTANT for Orders):** 
    - For "most sold product" or "best selling item": { "model": "Order", "groupBy": "name", "aggregate": "sum", "field": "quantity" }
    - IMPORTANT: When grouping Order items, after unwinding the items array, use field names WITHOUT any prefix
    - Just use "name" for product name and "quantity" for quantity (not "items.name" or "items.quantity")
6.  **Shop Info:** If asking about the shop itself (name, address, location, details), use { "model": "Shop", "query": {} }

Examples:

Q: "What is my shop address?" or "Where is my shop located?"
A: { "model": "Shop", "query": {} }

Q: "Which product sold the most?" or "What is my best-selling item?"
A: { "model": "Order", "groupBy": "name", "aggregate": "sum", "field": "quantity" }

Q: "What is the total revenue today?"
A: { "model": "Order", "query": { "date": { "$gte": "{{DATE_START_OF_TODAY}}", "$lte": "{{DATE_END_OF_TODAY}}" } }, "aggregate": "sum", "field": "total" }

Q: "List all products in the Beverages category"
A: { "model": "Product", "query": { "category": "Beverages" } }

Q: "How many orders did we get this month?"
A: { "model": "Order", "query": { "date": { "$gte": "{{DATE_START_OF_THIS_MONTH}}", "$lte": "{{DATE_END_OF_THIS_MONTH}}" } }, "aggregate": "count" }

User Question: "${question}"
JSON Response:
`;

const getAnswerGenerationPrompt = (question, dbResults) => `
You are a helpful shop assistant AI for TRIACT. 
User Question: "${question}"

Database Results (as JSON):
${JSON.stringify(dbResults, null, 2)}

Rules:
1.  If results are empty, politely say you found nothing relevant.
2.  If results are { "total": X }, state that clearly (e.g., "The total is ₹X" or "You have X items").
3.  For grouped results (array of objects), show the top items clearly with their values.
4.  For shop details, present the information in a friendly way.
5.  Summarize lists of items concisely - don't just dump raw data.
6.  Use ₹ symbol for currency (Indian Rupees).
7.  Be professional, friendly, and conversational.
8.  If the data shows interesting insights, mention them.

Answer:
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
    console.log(`[AI CHAT] User question: "${userQuestion}"`);
    
    // === Step 1: Generate Query ===
    const categories = await Product.distinct("category", { shopId: shopId });
    const queryPrompt = getQueryGenerationPrompt(userQuestion, SCHEMAS, categories);
    
    let queryGenText = await callGemini(queryPrompt, "json");

    // Remove Markdown backticks if Gemini adds them
    queryGenText = queryGenText.replace(/```json/g, "").replace(/```/g, "").trim();

    // Inject dynamic dates BEFORE parsing
    queryGenText = replaceDatePlaceholders(queryGenText);

    console.log("[AI CHAT] Generated query:", queryGenText);

    let parsedQuery;
    try {
      parsedQuery = JSON.parse(queryGenText);
    } catch (e) {
      console.error("[AI CHAT] JSON Parse Error. Raw:", queryGenText);
      return res.status(500).json({ 
        answer: "I understood your question, but I had trouble processing it internally. Please try rephrasing." 
      });
    }
    
    const { model, query, options, comment, aggregate, field } = parsedQuery;
    const modelName = model || parsedQuery.model_name;
    const Model = ALLOWED_MODELS[modelName];

    if (!Model) { 
      console.error("[AI CHAT] Invalid model requested:", modelName);
      return res.status(400).json({ 
        answer: "I can't answer questions about that topic. Try asking about products, orders, employees, or shop details." 
      });
    }

    console.log(`[AI CHAT] Using model: ${modelName}`);

    // === Step 2: Execute Query ===
    let secureQuery;
    if (modelName === "Shop") {
       secureQuery = { _id: new mongoose.Types.ObjectId(shopId) };
    } else {
       secureQuery = { ...cleanMongoQuery(query), shopId: new mongoose.Types.ObjectId(shopId) };
    }

    console.log("[AI CHAT] Secure query:", JSON.stringify(secureQuery));

    let dbResults; 

    if (aggregate) {
   console.log(`[AI CHAT] Running aggregation: ${aggregate} on ${modelName}`);
   console.log(`[AI CHAT] GroupBy: ${parsedQuery.groupBy}, Field: ${field}`);
   
   const pipeline = [{ $match: secureQuery }];
   
   // Unwind items array for Order/Invoice models
   if (modelName === "Order" || modelName === "Invoice") {
      pipeline.push({ $unwind: "$items" }); 
      console.log("[AI CHAT] Unwound items array");
   }

   // After $unwind, fields are at root level
   const groupId = parsedQuery.groupBy ? `$items.${parsedQuery.groupBy}` : null;
   
   if (aggregate === "sum") {
     pipeline.push({ 
       $group: { 
         _id: groupId, 
         total: { $sum: `$items.${field}` } 
       } 
     });
   } else if (aggregate === "average") {
     pipeline.push({ 
       $group: { 
         _id: groupId, 
         total: { $avg: `$items.${field}` } 
       } 
     });
   } else if (aggregate === "count") {
      if (parsedQuery.groupBy) {
        pipeline.push({ $group: { _id: groupId, total: { $sum: 1 } } });
      } else {
        pipeline.push({ $count: "total" });
      }
   }

   // Sort and limit for grouped results
   if (parsedQuery.groupBy) {
      pipeline.push({ $sort: { total: -1 } });
      pipeline.push({ $limit: 10 });
      
      // Format results
      pipeline.push({
        $project: {
          _id: 0,
          name: "$_id",
          total: 1
        }
      });
   }

   console.log("[AI CHAT] Aggregation pipeline:", JSON.stringify(pipeline, null, 2));
   
   try {
     const aggResult = await Model.aggregate(pipeline);
     console.log("[AI CHAT] Aggregation returned:", JSON.stringify(aggResult, null, 2));
     
     if (aggResult.length > 0) {
        dbResults = parsedQuery.groupBy ? aggResult : { total: aggResult[0].total };
     } else {
        console.log("[AI CHAT] WARNING: Aggregation returned empty array!");
        dbResults = parsedQuery.groupBy ? [] : { total: 0 };
     }
   } catch (aggError) {
     console.error("[AI CHAT] Aggregation error:", aggError);
     throw aggError;
   }



    } else {
      // Regular find query
      const queryOptions = {
          limit: options?.limit || 20, 
          sort: options?.sort || { createdAt: -1 },
      };
      
      console.log("[AI CHAT] Running find query with options:", queryOptions);
      
      dbResults = await Model.find(secureQuery, null, queryOptions).lean();
      
      console.log(`[AI CHAT] Find result: ${dbResults.length} documents found`);
    }
    
    console.log("[AI CHAT] DB Results preview:", JSON.stringify(dbResults).substring(0, 300));

    // === Step 3: Generate Answer ===
    const answerPrompt = getAnswerGenerationPrompt(userQuestion, dbResults);
    const finalAnswer = await callGemini(answerPrompt, "text");

    console.log("[AI CHAT] Final answer:", finalAnswer);

    res.status(200).json({ 
      answer: finalAnswer.trim(), 
      debugComment: comment 
    });

  } catch (error) {
    console.error("[AI CHAT] Error:", error);
    res.status(500).json({ 
      answer: "I'm sorry, I encountered an error while processing your request. Please try again or rephrase your question.",
      error: error.message 
    });
  }
}

export default authMiddleware(handler);
