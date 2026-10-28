import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { randomUUID } from "node:crypto";

type ImageProvider = "magnific" | "gemini" | "openai";
type AspectRatio = "3:4" | "1:1" | "4:3" | "16:9";

const MAGNIFIC_RATIO: Record<AspectRatio, string> = {
  "3:4": "traditional_3_4",
  "1:1": "square_1_1",
  "4:3": "classic_4_3",
  "16:9": "widescreen_16_9",
};

// gpt-image-1 aceita 1024x1024, 1024x1536 (vertical) e 1536x1024 (horizontal)
const OPENAI_SIZE: Record<AspectRatio, string> = {
  "3:4": "1024x1536",
  "1:1": "1024x1024",
  "4:3": "1536x1024",
  "16:9": "1536x1024",
};

// Fallback dall-e-3: 1024x1024, 1024x1792, 1792x1024
const DALLE3_SIZE: Record<AspectRatio, string> = {
  "3:4": "1024x1792",
  "1:1": "1024x1024",
  "4:3": "1792x1024",
  "16:9": "1792x1024",
};

const PROVIDER_LABEL: Record<ImageProvider, string> = {
  magnific: "Magnific AI",
  gemini: "Gemini AI",
  openai: "OpenAI GPT Image",
};

interface SavedImage { url: string; provider: ImageProvider; providerLabel: string }

export const generateStudioImage = onCall({ cors: true, maxInstances: 10, timeoutSeconds: 180, memory: "512MiB" }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Entre na sua conta para gerar imagens.");
  const { projectId, slideId, description, context } = request.data || {};
  const requestedProvider = request.data?.provider as ImageProvider | undefined;
  const aspectRatio: AspectRatio = ["3:4", "1:1", "4:3", "16:9"].includes(request.data?.aspectRatio) ? request.data.aspectRatio : "3:4";
  if (![projectId, slideId].every(value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) || typeof description !== "string" || !description.trim() || description.length > 4000 || typeof context !== "string" || context.length > 40000) {
    throw new HttpsError("invalid-argument", "Dados da imagem inválidos.");
  }
  if (requestedProvider !== undefined && !["magnific", "gemini", "openai"].includes(requestedProvider)) {
    throw new HttpsError("invalid-argument", "Provedor de imagem inválido.");
  }

  const keys = {
    magnific: process.env.MAGNIFIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  const bucket = admin.storage().bucket(process.env.STUDIO_STORAGE_BUCKET || "canvasgame-2025.firebasestorage.app");
  const uid = request.auth.uid;

  async function save(bytes: Buffer, mimeType: string, provider: ImageProvider): Promise<SavedImage> {
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error("Imagem fora do limite permitido.");
    const token = randomUUID();
    const ext = mimeType.split("/")[1] || "png";
    const path = `users/${uid}/studio/${projectId}/${slideId}-${randomUUID()}.${ext}`;
    await bucket.file(path).save(bytes, { resumable: false, metadata: { contentType: mimeType, metadata: { firebaseStorageDownloadTokens: token } } });
    return {
      url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`,
      provider,
      providerLabel: PROVIDER_LABEL[provider],
    };
  }

  async function viaMagnific(): Promise<SavedImage> {
    if (!keys.magnific) throw new Error("Magnific não configurado.");
    const prompt = `${description.slice(0, 900)}. Cena visual de alta definição, iluminação envolvente e texturas realistas. Sem textos, sem molduras, sem logotipos.`;
    const res = await fetch("https://api.magnific.com/v1/ai/mystic", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-magnific-api-key": keys.magnific },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ prompt, aspect_ratio: MAGNIFIC_RATIO[aspectRatio], model: "realism", engine: "automatic", resolution: "2k" }),
    });
    if (!res.ok) throw new Error(`Magnific HTTP ${res.status}`);
    const payload = await res.json() as { data?: { task_id?: string; generated?: string[] } };
    let imgUrl = payload.data?.generated?.[0];
    const taskId = payload.data?.task_id;
    if (!imgUrl && taskId) {
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`https://api.magnific.com/v1/ai/mystic/${taskId}`, { headers: { "x-magnific-api-key": keys.magnific } });
        if (!poll.ok) continue;
        const data = await poll.json() as { data?: { status?: string; generated?: string[] } };
        if (data.data?.status === "COMPLETED" && data.data.generated?.[0]) { imgUrl = data.data.generated[0]; break; }
        if (data.data?.status === "FAILED") break;
      }
    }
    if (!imgUrl) throw new Error("Magnific não retornou imagem.");
    const img = await fetch(imgUrl);
    if (!img.ok) throw new Error("Falha ao baixar imagem da Magnific.");
    return save(Buffer.from(await img.arrayBuffer()), img.headers.get("content-type")?.split(";")[0] || "image/jpeg", "magnific");
  }

  async function viaGemini(): Promise<SavedImage> {
    if (!keys.gemini) throw new Error("Gemini não configurado.");
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": keys.gemini },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Crie uma representação visual de alta definição baseada no conteúdo e descrição abaixo, na proporção ${aspectRatio}. Não crie o slide inteiro, textos, legendas, molduras ou logotipos. Foco visual claro, bom contraste e alta qualidade estética.\nDescrição visual: ${JSON.stringify(description)}\nContexto da aula: ${context}` }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const payload = await res.json() as { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };
    const image = payload.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith("image/"))?.inlineData;
    if (!image) throw new Error("Gemini não retornou imagem.");
    return save(Buffer.from(image.data, "base64"), image.mimeType, "gemini");
  }

  async function viaOpenAI(): Promise<SavedImage> {
    if (!keys.openai) throw new Error("OpenAI não configurada.");
    const prompt = `${description.slice(0, 3000)}\n\nImagem educacional de alta qualidade para slide de aula (proporção ${aspectRatio}). Proibido qualquer texto, legenda, letreiro, moldura, borda ou logotipo na imagem.`;
    const call = async (body: Record<string, unknown>) => {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.openai}` },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({})) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || `OpenAI HTTP ${res.status}`);
      return json.data?.[0];
    };

    let item: { b64_json?: string; url?: string } | undefined;
    try {
      item = await call({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt, size: OPENAI_SIZE[aspectRatio], quality: "high", n: 1 });
    } catch (primaryError) {
      console.warn("gpt-image-1 indisponível, tentando dall-e-3:", primaryError instanceof Error ? primaryError.message : primaryError);
      item = await call({ model: "dall-e-3", prompt: prompt.slice(0, 3900), size: DALLE3_SIZE[aspectRatio], quality: "hd", response_format: "b64_json", n: 1 });
    }
    if (item?.b64_json) return save(Buffer.from(item.b64_json, "base64"), "image/png", "openai");
    if (item?.url) {
      const img = await fetch(item.url);
      if (img.ok) return save(Buffer.from(await img.arrayBuffer()), img.headers.get("content-type")?.split(";")[0] || "image/png", "openai");
    }
    throw new Error("OpenAI não retornou imagem.");
  }

  const runners: Record<ImageProvider, () => Promise<SavedImage>> = { magnific: viaMagnific, gemini: viaGemini, openai: viaOpenAI };

  // Provedor escolhido pelo usuário primeiro; depois os demais configurados como reserva.
  const order: ImageProvider[] = requestedProvider
    ? [requestedProvider, ...(["magnific", "gemini", "openai"] as ImageProvider[]).filter(p => p !== requestedProvider)]
    : ["magnific", "gemini", "openai"];
  const available = order.filter(p => Boolean(keys[p]));
  if (!available.length) throw new HttpsError("failed-precondition", "A geração de imagens ainda não foi configurada no servidor.");

  const failures: string[] = [];
  for (const provider of available) {
    try {
      const result = await runners[provider]();
      return { ...result, requestedProvider: requestedProvider || provider, fallback: requestedProvider ? provider !== requestedProvider : false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      console.warn(`Falha no provedor ${provider}:`, message);
      failures.push(`${PROVIDER_LABEL[provider]}: ${message}`);
    }
  }
  throw new HttpsError("unavailable", `Não foi possível gerar a imagem. ${failures.join(" | ")}`.slice(0, 900));
});
