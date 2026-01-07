// backend/lib/gemini.js

import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Main configuration with optimal settings
const defaultConfig = {
  temperature: 0.7,
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 500,
  candidateCount: 1,
};

const safetySettings = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_NONE',
  },
];

// ✅ Default model (balanced speed + quality)
export function getGeminiModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: defaultConfig,
    safetySettings,
  });
}

// ✅ Fast model for simple queries
export function getGeminiFastModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash-8b',
    generationConfig: {
      ...defaultConfig,
      temperature: 0.5,
      maxOutputTokens: 300,
    },
    safetySettings,
  });
}

// ✅ Generate with timeout protection
export async function generateWithTimeout(model, prompt, timeoutMs = 7000) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('AI_TIMEOUT'));
    }, timeoutMs);

    try {
      const result = await model.generateContent(prompt);
      clearTimeout(timeoutId);
      const text = result.response.text();
      resolve(text);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

// ✅ Streaming for faster perceived response
export async function generateWithStreaming(model, prompt) {
  const result = await model.generateContentStream(prompt);
  let fullText = '';
  
  for await (const chunk of result.stream) {
    fullText += chunk.text();
  }
  
  return fullText;
}

// ✅ Smart router: choose model based on query complexity
export function getSmartModel(userMessage) {
  const simpleQueries = [
    'today', 'revenue', 'profit', 'how much', 'how many',
    'which product', 'employee', 'salary', 'low stock'
  ];
  
  const isSimple = simpleQueries.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );
  
  return isSimple ? getGeminiFastModel() : getGeminiModel();
}

export default getGeminiModel;
