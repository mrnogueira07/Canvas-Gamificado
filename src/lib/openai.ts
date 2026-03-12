import OpenAI from "openai";

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!API_KEY) {
  console.error(
    "VITE_OPENAI_API_KEY is missing! Make sure it is set in your .env file.",
  );
}

export const openai = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true, // Required for client-side usage in Vite
});
