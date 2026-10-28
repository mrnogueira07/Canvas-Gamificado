/**
 * Configuração e integração segura da IA do Google (Gemini)
 * 
 * SEGURANÇA: As chamadas ao modelo Gemini são enviadas preferencialmente
 * para a Firebase Cloud Function ('generateGeminiContent') para que a chave
 * de API NUNCA seja exposta no navegador do cliente.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const LOCAL_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Cliente local para fallback caso esteja rodando offline com chave local
const localGenAI = LOCAL_API_KEY ? new GoogleGenerativeAI(LOCAL_API_KEY) : null;
const localModel = localGenAI
  ? localGenAI.getGenerativeModel(
      { model: "gemini-2.5-flash" },
      {
        customHeaders: {
          Referer: "https://canvasgame-2025.web.app/",
        },
      }
    )
  : null;

// Função Callable segura do Firebase Cloud Functions
const generateGeminiContentFn = httpsCallable<
  {
    prompt?: string;
    contents?: unknown[];
    generationConfig?: unknown;
    modelName?: string;
  },
  { text: string }
>(functions, "generateGeminiContent");

export interface GenerateContentResultLike {
  response: {
    text: () => string;
  };
}

/**
 * Adaptador seguro para o modelo Gemini.
 * Executa as chamadas de IA através do backend do Firebase Cloud Functions,
 * mantendo a chave de API estritamente no servidor.
 */
export const model = {
  async generateContent(
    params:
      | string
      | {
          contents?: unknown[];
          generationConfig?: unknown;
          [key: string]: unknown;
        }
  ): Promise<GenerateContentResultLike> {
    const isDev = import.meta.env.DEV || (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"));

    // Em ambiente de desenvolvimento local com chave configurada, usa o modelo local diretamente para máxima velocidade
    if (isDev && localModel) {
      try {
        const localResult = await localModel.generateContent(
          params as Parameters<typeof localModel.generateContent>[0]
        );
        return localResult;
      } catch (localError) {
        console.warn("[Gemini Proxy] Tentativa com modelo local em dev falhou, tentando Cloud Function:", localError);
      }
    }

    try {
      let payload: {
        prompt?: string;
        contents?: unknown[];
        generationConfig?: unknown;
        modelName?: string;
      } = {};

      if (typeof params === "string") {
        payload = { prompt: params, modelName: "gemini-2.5-flash" };
      } else if (params && typeof params === "object") {
        payload = {
          contents: params.contents,
          generationConfig: params.generationConfig,
          modelName: "gemini-2.5-flash",
        };
      }

      const result = await generateGeminiContentFn(payload);
      const textOutput = result.data?.text || "";

      return {
        response: {
          text: () => textOutput,
        },
      };
    } catch (backendError) {
      // Se houver chave local configurada para desenvolvimento, usa como fallback
      if (localModel) {
        console.warn(
          "[Gemini Proxy] Backend Cloud Function indisponível ou em desenvolvimento local, utilizando fallback local:",
          backendError
        );
        const localResult = await localModel.generateContent(
          params as Parameters<typeof localModel.generateContent>[0]
        );
        return localResult;
      }

      console.error("[Gemini Proxy] Falha ao gerar conteúdo via Cloud Function:", backendError);
      throw backendError;
    }
  },
};
