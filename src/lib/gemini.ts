/**
 * Configuração e inicialização da IA do Google (Gemini)
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error(
    "VITE_GEMINI_API_KEY is missing! Make sure it is set in your .env file.",
  );
}

// Inicializa a biblioteca com a chave extraída das variáveis de ambiente
const genAI = new GoogleGenerativeAI(API_KEY || "dummy-key");

// Define o modelo que será usado para geração de conteúdo
// Usando o modelo mais atualizado: gemini-2.5-flash
export const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
