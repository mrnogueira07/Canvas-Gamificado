import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI, type Content, type GenerationConfig } from "@google/generative-ai";

admin.initializeApp();
export { generateStudioImage } from "./studioImage";

type GeminiPart =
  | string
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GenerateGeminiPayload {
  prompt?: string;
  contents?: Array<{
    role?: string;
    parts: GeminiPart[];
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
  };
  modelName?: string;
}

function normalizeContents(contents: GenerateGeminiPayload["contents"]): Content[] {
  return (contents ?? []).map((content) => ({
    role: content.role ?? "user",
    parts: content.parts.map((part) =>
      typeof part === "string"
        ? { text: part }
        : part
    ),
  }));
}

export const generateGeminiContent = onCall(
  {
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    // 1. Validação de autenticação
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Acesso não autorizado. É necessário estar autenticado para utilizar este recurso."
      );
    }

    // 2. Leitura segura da chave do Gemini no ambiente do servidor
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY não configurada no ambiente do Cloud Functions.");
      throw new HttpsError(
        "failed-precondition",
        "Chave do Gemini não configurada no servidor."
      );
    }

    const data = (request.data || {}) as GenerateGeminiPayload;
    const modelName = data.modelName || "gemini-2.5-flash";

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const generativeModel = genAI.getGenerativeModel(
        {
          model: modelName,
          generationConfig: data.generationConfig as Record<string, unknown> | undefined,
        },
        {
          customHeaders: {
            Referer: "https://canvasgame-2025.web.app/",
          },
        }
      );

      let responseText = "";

      if (data.contents && data.contents.length > 0) {
        // Chamada estruturada com contents e parts
        const result = await generativeModel.generateContent({
          contents: normalizeContents(data.contents),
          generationConfig: data.generationConfig as GenerationConfig | undefined,
        });
        const response = await result.response;
        responseText = response.text();
      } else if (data.prompt) {
        // Chamada simples com string prompt
        const result = await generativeModel.generateContent(data.prompt);
        const response = await result.response;
        responseText = response.text();
      } else {
        throw new HttpsError(
          "invalid-argument",
          "Nenhum prompt ou conteúdo fornecido para a IA."
        );
      }

      return { text: responseText };
    } catch (err: unknown) {
      console.error("Erro ao chamar API do Gemini no backend:", err);
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      throw new HttpsError("internal", `Erro na geração de conteúdo: ${message}`);
    }
  }
);

export const syncTeamAvatars = onCall(
  {
    cors: true,
    maxInstances: 5,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Acesso não autorizado. É necessário estar autenticado para utilizar este recurso."
      );
    }

    try {
      const listUsersResult = await admin.auth().listUsers(1000);
      const batch = admin.firestore().batch();
      let updatedCount = 0;

      const knownDeactivated = new Set([
        "gabriella.oliveira@innyx.com",
        "lilian.matos@innyx.com",
        "leticia.lima@innyx.com",
      ]);

      for (const authUser of listUsersResult.users) {
        if (!authUser.email) continue;
        const userRef = admin.firestore().collection("users").doc(authUser.uid);
        const isDeactivated = Boolean(
          authUser.disabled ||
          knownDeactivated.has(authUser.email.toLowerCase().trim())
        );
        const dataToSet: Record<string, unknown> = {
          uid: authUser.uid,
          name: authUser.displayName || authUser.email.split("@")[0] || "Educador(a)",
          email: authUser.email,
          photoURL: authUser.photoURL || null,
        };
        if (isDeactivated) {
          dataToSet.disabled = true;
          dataToSet.status = "deactivated";
        }
        batch.set(userRef, dataToSet, { merge: true });
        updatedCount++;
      }

      await batch.commit();
      return { success: true, count: updatedCount };
    } catch (err: unknown) {
      console.error("Erro ao sincronizar avatares da equipe:", err);
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      throw new HttpsError("internal", `Erro na sincronização de avatares: ${message}`);
    }
  }
);

export const proxyImage = onRequest(
  {
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).send("Missing url parameter");
      return;
    }
    try {
      const fetchRes = await fetch(targetUrl);
      if (!fetchRes.ok) {
        res.status(fetchRes.status).send(`Upstream error: ${fetchRes.statusText}`);
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", fetchRes.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      const arrayBuffer = await fetchRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch {
      res.status(500).send("Proxy image failed");
    }
  }
);

