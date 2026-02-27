import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("VITE_GEMINI_API_KEY is missing! Make sure it is set in your .env file.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "dummy-key");

export const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
