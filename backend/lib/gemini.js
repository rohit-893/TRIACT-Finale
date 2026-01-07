// backend/lib/gemini.js

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Please define the GEMINI_API_KEY environment variable");
}

const genAI = new GoogleGenerativeAI(API_KEY);

export const getGeminiModel = () => {
  return genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview"
  });
};

export default genAI;
