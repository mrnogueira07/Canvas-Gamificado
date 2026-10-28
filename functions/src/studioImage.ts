import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { randomUUID } from "node:crypto";

export const generateStudioImage = onCall({ cors: true, maxInstances: 10, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Entre na sua conta para gerar imagens.");
  const { projectId, slideId, description, context } = request.data || {};
  if (![projectId, slideId].every(value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) || typeof description !== "string" || !description.trim() || description.length > 4000 || typeof context !== "string" || context.length > 40000) throw new HttpsError("invalid-argument", "Dados da imagem inválidos.");
  const magnificApiKey = process.env.MAGNIFIC_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!magnificApiKey && !geminiApiKey) throw new HttpsError("failed-precondition", "A geração de imagens ainda não foi configurada no servidor.");

  const bucket = admin.storage().bucket(process.env.STUDIO_STORAGE_BUCKET || "canvasgame-2025.firebasestorage.app");

  // 1. Prioriza Magnific AI Mystic para geração de altíssima fidelidade
  if (magnificApiKey) {
    try {
      const prompt = `${description.slice(0, 800)}. Cena visual de alta definição, iluminação envolvente e texturas realistas. Sem textos, sem molduras, sem logotipos.`;
      const magResponse = await fetch("https://api.magnific.com/v1/ai/mystic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-magnific-api-key": magnificApiKey,
        },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          prompt,
          aspect_ratio: "traditional_3_4",
          model: "realism",
          engine: "automatic",
          resolution: "2k",
        }),
      });

      if (magResponse.ok) {
        const payload = await magResponse.json() as { data?: { task_id?: string; generated?: string[] } };
        let imgUrl = payload.data?.generated?.[0];
        const taskId = payload.data?.task_id;

        if (!imgUrl && taskId) {
          for (let i = 0; i < 25; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const pollRes = await fetch(`https://api.magnific.com/v1/ai/mystic/${taskId}`, {
              headers: { "x-magnific-api-key": magnificApiKey },
            });
            if (pollRes.ok) {
              const pollData = await pollRes.json() as { data?: { status?: string; generated?: string[] } };
              if (pollData.data?.status === "COMPLETED" && pollData.data.generated?.[0]) {
                imgUrl = pollData.data.generated[0];
                break;
              }
              if (pollData.data?.status === "FAILED") break;
            }
          }
        }

        if (imgUrl) {
          const fetchRes = await fetch(imgUrl);
          if (fetchRes.ok) {
            const arrayBuf = await fetchRes.arrayBuffer();
            const bytes = Buffer.from(arrayBuf);
            if (bytes.length && bytes.length <= 10 * 1024 * 1024) {
              const token = randomUUID();
              const path = `users/${request.auth.uid}/studio/${projectId}/${slideId}-${randomUUID()}.jpg`;
              await bucket.file(path).save(bytes, {
                resumable: false,
                metadata: { contentType: "image/jpeg", metadata: { firebaseStorageDownloadTokens: token } },
              });
              return {
                url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`,
                provider: "magnific",
              };
            }
          }
        }
      } else {
        console.warn("Magnific AI HTTP status:", magResponse.status);
      }
    } catch (magError) {
      console.warn("Magnific AI call failed, falling back to Gemini:", magError);
    }
  }

  // 2. Fallback para Gemini caso Magnific não esteja configurado ou falhe
  if (!geminiApiKey) throw new HttpsError("unavailable", "O serviço de imagens está indisponível no momento.");
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey }, signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Crie uma representação visual de alta definição baseada no conteúdo e descrição abaixo. Preencha a margem vertical do slide (proporção 3:4). Não crie o slide inteiro, textos, legendas, molduras ou logotipos. Foco visual claro, bom contraste e alta qualidade estética.\nDescrição visual: ${JSON.stringify(description)}\nContexto da aula: ${context}` }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
    });
    if (!response.ok) {
      console.error("Studio image provider status", response.status);
      throw new HttpsError(response.status === 429 ? "resource-exhausted" : "unavailable", "O serviço de imagens está indisponível ou sem cota. Tente novamente mais tarde.");
    }
    const payload = await response.json() as { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };
    const image = payload.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith("image/"))?.inlineData;
    if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) throw new HttpsError("failed-precondition", "A IA não retornou uma imagem. Ajuste a descrição e tente novamente.");
    const bytes = Buffer.from(image.data, "base64");
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new HttpsError("internal", "A imagem retornada excedeu o limite permitido.");
    const token = randomUUID();
    const path = `users/${request.auth.uid}/studio/${projectId}/${slideId}-${randomUUID()}.${image.mimeType.split("/")[1]}`;
    await bucket.file(path).save(bytes, { resumable: false, metadata: { contentType: image.mimeType, metadata: { firebaseStorageDownloadTokens: token } } });
    return {
      url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`,
      provider: "gemini",
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Studio image generation failed", error instanceof Error ? error.name : "unknown");
    throw new HttpsError("unavailable", "Não foi possível gerar a imagem. Os textos da aula foram preservados.");
  }
});
