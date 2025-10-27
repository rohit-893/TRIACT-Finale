// backend/pages/api/shops/[shopId]/ai/chat.js

import connectDB from "../../../../../lib/db.js";
import { authMiddleware } from "../../../../../lib/auth.js";
import { SCHEMAS } from "../../../../../lib/schemas.js";

// Import all the models the AI is allowed to query
import Product from "../../../../../models/Product.js";
import Order from "../../../../../models/Order.js";
import Invoice from "../../../../../models/Invoice.js";
import User from "../../../../../models/User.js";

// 1. Import the Gemini model function instead of Ollama
import { getGeminiModel } from "../../../../../lib/gemini.js";
import handleCors from '../../../middleware/cors.js';

// A security-focused map of allowed models
const ALLOWED_MODELS = {
  Product,
  Order,
  Invoice,
  User,
};

// --- UPDATED FUNCTION ---
// Now handles both invalid ObjectId strings AND the specific invalid Date object format

const objectIdRegex = /ObjectId\((?:'([^']*)'|([^)]*))\)/;

function cleanMongoQuery(obj) {
  // Base cases: null or not an object/array
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays recursively
  if (Array.isArray(obj)) {
    return obj.map(cleanMongoQuery);
  }

  // --- NEW: Check for the specific invalid date format ---
  if (obj['$date'] && obj['$date']['$numberLong'] !== undefined) {
    // Attempt to convert the numberLong (which is usually milliseconds since epoch)
    const milliseconds = parseInt(obj['$date']['$numberLong'], 10);
    if (!isNaN(milliseconds)) {
      // If valid, return a proper JavaScript Date object
      // Mongoose understands JS Date objects in queries
      console.log(`[CleanQuery] Converted invalid date object to JS Date: ${new Date(milliseconds)}`);
      return new Date(milliseconds);
    } else {
       // If conversion fails, maybe return null or keep original to let Mongoose handle potential error downstream
       console.warn(`[CleanQuery] Found invalid date object, but failed to parse $numberLong: ${obj['$date']['$numberLong']}`);
       return obj; // Return original problematic object
    }
  }
  // --- END NEW ---


  // Process object properties recursively
  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        // Clean ObjectId strings
        const match = value.match(objectIdRegex);
        if (match) {
          newObj[key] = match[1] || match[2];
        } else {
          newObj[key] = value;
        }
      } else if (typeof value === 'object') {
        // Recurse into nested objects/arrays (this will also handle objects within query operators like $gte, $lte)
        newObj[key] = cleanMongoQuery(value);
      } else {
        // Handle primitives (numbers, booleans, etc.)
        newObj[key] = value;
      }
    }
  }
  return newObj;
}
// --- END OF UPDATED FUNCTION ---

// --- CHANGED ---
// 2. This is the new function to call the Google Gemini API
/**
 * Calls the Gemini API with a specific prompt and response format.
 * @param {string} prompt The user's prompt.
 * @param {'json' | 'text'} format The desired output format.
 * @returns {Promise<string>} The string response from the AI.
 */
async function callGemini(prompt, format) {
  const model = getGeminiModel(); // Gets 'gemini-1.5-flash' from your lib

  const generationConfig = {
    temperature: 0.2, // Lower temp for more factual, less creative queries
    maxOutputTokens: 2048,
    // This is the key feature: forcing JSON or plain text output
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
    // Handle potential safety blocks or other API errors
    if (e.message.includes("SAFETY")) {
       throw new Error("The request was blocked due to safety settings.");
    }
    // This will bubble up and be caught by the main handler
    throw new Error(`Gemini API request failed: ${e.message}`);
  }
}


// --- CHANGED ---
// 3. Prompts are slightly tweaked for Gemini.
const getQueryGenerationPrompt = (question, schemas) => `
You are an expert MongoDB query assistant. Your job is to convert a user's natural language question into a valid MongoDB find() query.
You must only respond with a single JSON object.

The database schemas you can use are:
${schemas}

Rules:
1.  Always use regex for string matching (e.g., "lays chips") to make it case-insensitive. Use the $options: 'i' flag. Example: { name: { $regex: 'lays', $options: 'i' } }
2.  If the question implies sorting, add an "options" key with a "sort" object.
3.  If the question implies a number, add an "options" key with a "limit" object (max 50).
4.  Provide a short "comment" explaining your query.
5.  Only use the models provided: Product, Order, Invoice, User.
6.  **--- ADD THIS RULE ---**
    **When generating date comparisons (like using $gte or $lte), ALWAYS format the date value as an ISO 8601 string. Example: { date: { "$gte": "2025-10-01T00:00:00.000Z" } }**

Example Question: "Which products are low on stock?"
Example Response:
{
  "model": "Product",
  "query": { "stock": { "$lte": 10 } },
  "options": { "sort": { "stock": 1 }, "limit": 10 },
  "comment": "Searching for products with stock less than or equal to 10, sorting by stock ascending."
}

Example Question: "Show orders from October 2025"
Example Response:
{
  "model": "Order",
  "query": {
    "date": {
      "$gte": "2025-10-01T00:00:00.000Z",
      "$lt": "2025-11-01T00:00:00.000Z"
    }
  },
  "options": { "sort": { "date": -1 } },
  "comment": "Searching for orders placed in October 2025, sorting by date descending."
}


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
1.  If the results are empty, say you couldn't find any matching information for that period or criteria.
2.  If the results are not empty, directly answer the question using the data.
3.  Do not just repeat the JSON. Summarize it clearly.
4.  Be friendly and professional.
5.  **--- ADD THIS RULE ---**
    **When stating any monetary value (like prices, costs, revenue, profit, salary), ALWAYS use the Indian Rupee symbol (₹) before the number (e.g., ₹1,234.50, ₹50,000).**

Assistant's Answer:
`;

async function handler(req, res) {
  // --- ADD THIS LINE ---
  await handleCors(req, res); // Run the CORS middleware
  // --------------------
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
    const queryPrompt = getQueryGenerationPrompt(userQuestion, SCHEMAS);

    // Call Gemini with "json" format
    const queryGenText = await callGemini(queryPrompt, "json");

    let parsedQuery;
    try {
      // Gemini's JSON mode is very reliable, so we can parse directly.
      // The complex regex from the Ollama version is no longer needed.
      parsedQuery = JSON.parse(queryGenText);
    } catch (e) {
      console.error("AI failed to generate valid JSON. Raw response:", queryGenText);
      console.error("Parse Error:", e.message);
      return res.status(500).json({ answer: "The AI assistant had trouble understanding that. Please rephrase your question." });
    }
    
    const modelName = parsedQuery.model || parsedQuery.model_name;
    const { query, options, comment } = parsedQuery;

    // === Step 2: Securely Execute the Query ===
    const Model = ALLOWED_MODELS[modelName];
    if (!Model) { 
      console.error("AI returned invalid JSON structure. 'model' key is missing or invalid. Full AI Response:", parsedQuery); 
      return res.status(400).json({ answer: "I can't answer questions about that topic." });
    }

    const cleanedQuery = cleanMongoQuery(query);
    // IMPORTANT: Inject the shopId into every query for security
    const secureQuery = { ...cleanedQuery, shopId: shopId }; 

    const queryOptions = {
        limit: options?.limit || 20, 
        sort: options?.sort || { createdAt: -1 },
    };

    const dbResults = await Model.find(secureQuery, null, queryOptions).lean();

    // === Step 3: Generate the Final Answer ===
    const answerPrompt = getAnswerGenerationPrompt(userQuestion, dbResults);

    // Call Gemini with "text" format
    const finalAnswer = await callGemini(answerPrompt, "text");

    res.status(200).json({ answer: finalAnswer, debugComment: comment });

  } catch (error) {
    console.error("AI Chat Error:", error);
    // Add specific error handling for the API key
    if (error.message.includes("GEMINI_API_KEY")) {
       return res.status(500).json({ answer: "The AI server is not configured. Please add a GEMINI_API_KEY to the .env file." });
    }
    if (error.message.includes("safety settings")) {
        return res.status(500).json({ answer: "I'm sorry, I can't answer that question as it was blocked by my safety settings." });
    }
    // Generic error for other API failures
    if (error.message.includes("Gemini API")) {
        return res.status(500).json({ answer: "I'm having trouble connecting to the AI assistant. Please try again later." });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export default authMiddleware(handler);