// backend/lib/openai.js
import OpenAI from "openai";

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  throw new Error("Please define the OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({
  apiKey: API_KEY,
});

export const getOpenAIClient = () => {
  return openai;
};
