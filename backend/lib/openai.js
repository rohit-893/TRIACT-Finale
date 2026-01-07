// backend/lib/openai.js
import OpenAI from "openai";

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY not found in environment variables");
}

const openai = new OpenAI({
  apiKey: API_KEY,
});

export const getOpenAIClient = () => {
  return openai;
};
