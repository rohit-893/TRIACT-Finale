// backend/lib/gemini.js

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("GEMINI_API_KEY is missing!");
  throw new Error("GEMINI_API_KEY not found in environment");
}

const genAI = new GoogleGenerativeAI(API_KEY);

export const getGeminiModel = () => {
  return genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500, // ✅ Shorter responses = faster
      topP: 0.9,
    },
  });
};

export default genAI;
