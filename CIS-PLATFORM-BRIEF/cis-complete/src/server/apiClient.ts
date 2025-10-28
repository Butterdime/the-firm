import { GoogleGenAI } from '@google/genai';

if (!process.env.API_KEY) {
  // console.error("API_KEY environment variable not set. Please configure it in your .env file or environment.");
  throw new Error("API_KEY environment variable not set. Please configure it in your .env file or environment.");
}

export const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });