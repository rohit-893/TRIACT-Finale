// backend/lib/gemini.js

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Please define the GEMINI_API_KEY environment variable");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// This is the model we'll use for both steps
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

export const getGeminiModel = () => {
  return model;
};