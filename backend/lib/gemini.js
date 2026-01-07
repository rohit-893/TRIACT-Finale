// backend/lib/gemini.js

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY not found");
}

const genAI = new GoogleGenerativeAI(API_KEY);

export const getGeminiModel = () => {
  return genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", // ✅ Fastest free model
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 500, // ✅ Short responses only
    },
  });
};

export default genAI;
