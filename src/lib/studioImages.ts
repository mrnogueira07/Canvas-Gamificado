import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, functions, storage } from "./firebase";
import { model as geminiModel } from "./gemini";
import type { StudioProject, StudioSlide } from "./studioProjects";

const generateImageCallable = httpsCallable<{
  projectId: string; slideId: string; description: string; context: string;
}, { url: string }>(functions, "generateStudioImage", { timeout: 110000 });

export type MagnificEngine = "photographic" | "cinematic" | "painting" | "illustration" | "science";
export type MagnificCreativity = "low" | "medium" | "high";
export type MagnificHdr = "soft" | "standard" | "ultra";
export type MagnificLighting = "natural" | "studio" | "dramatic" | "museum" | "night";
export type StudioImageAspectRatio = "3:4" | "1:1" | "4:3" | "16:9";

// Compatibilidade retroativa
export type StudioImageStyle = "realista" | "pintura" | "ilustracao";

export interface GenerateImageOptions {
  engine?: MagnificEngine;
  style?: StudioImageStyle;
  creativity?: MagnificCreativity;
  hdr?: MagnificHdr;
  lighting?: MagnificLighting;
  aspectRatio?: StudioImageAspectRatio;
  isUpscale?: boolean;
  sourceImageUrl?: string;
}

const ENGINE_PROMPT_MAP: Record<MagnificEngine, {
  clause: string;
  model: "realism" | "editorial_portraits" | "fluid" | "flexible";
  engine: "automatic" | "magnific_sparkle" | "magnific_illusio" | "magnific_sharpy";
  title: string;
}> = {
  photographic: {
    clause: "Estilo: Fotografia documental realista de altíssima definição 8K, ótica real de lente 85mm f/1.8, profundidade de campo sutil, texturas autênticas de peles, vestimentas e ambientes de época, fidelidade histórica ou científica rigorosa. Sem aspecto de desenho ou cartum, sem textos, sem molduras, sem logotipos.",
    model: "realism",
    engine: "automatic",
    title: "Foto Documental / Realismo",
  },
  cinematic: {
    clause: "Estilo: Fotografia cinematográfica épica de filme blockbuster, lentes anamórficas de 35mm, iluminação cinematográfica com gradação de cor profissional, contraste rico e atmosfera dramática e imersiva. Sem textos, sem molduras, sem logotipos.",
    model: "editorial_portraits",
    engine: "magnific_sparkle",
    title: "Cinematográfico / Épico",
  },
  painting: {
    clause: "Estilo: Pintura histórica clássica a óleo de mestre de arte (estilo neoclássico ou acadêmico de época), camadas ricas de verniz e óleo, textura visível de tela de lona e pinceladas expressivas de museu de belas artes, composição teatral e nobre. Sem textos, sem molduras, sem logotipos.",
    model: "fluid",
    engine: "magnific_illusio",
    title: "Pintura Histórica a Óleo",
  },
  illustration: {
    clause: "Estilo: Ilustração didática moderna e pedagógica, traços limpos, cores harmoniosas e expressivas, excelente clareza visual e equilíbrio conceitual para sala de aula, sem poluição visual. Sem textos, sem molduras, sem logotipos.",
    model: "flexible",
    engine: "magnific_illusio",
    title: "Ilustração Didática",
  },
  science: {
    clause: "Estilo: Visualização científica e anatômica de altíssima precisão técnica, riqueza de micro-detalhes estruturais, corte transversal ou perspectiva macroscópica hiper-detalhada, iluminação límpida e foco cirúrgico. Sem textos, sem molduras, sem logotipos.",
    model: "realism",
    engine: "magnific_sharpy",
    title: "Científico & Macro",
  },
};

const CREATIVITY_MAP: Record<MagnificCreativity, { clause: string; value: number }> = {
  low: { clause: "Fidelidade rigorosa e estrita ao fato/objeto histórico ou científico, sem elementos inventados arbitrários.", value: 1 },
  medium: { clause: "Riqueza natural de detalhes secundários, ambientação crível de época e profundidade refinada.", value: 4 },
  high: { clause: "Riqueza máxima de detalhes atmosféricos, partículas cênicas de luz e poeira, texturas complexas e ambiente imersivo.", value: 7 },
};

const HDR_MAP: Record<MagnificHdr, { clause: string; value: number }> = {
  soft: { clause: "Textura orgânica suave com grão cinematográfico natural e transições delicadas.", value: 2 },
  standard: { clause: "Definição cristalina com alto alcance dinâmico de luz e sombras, foco impecável.", value: 5 },
  ultra: { clause: "Ultra-definição 8K com nitidez extrema em micro-detalhes, texturas táteis de tecidos, poros, pedras e relevos visíveis.", value: 9 },
};

const LIGHTING_MAP: Record<MagnificLighting, string> = {
  natural: "Iluminação natural envolvente da luz solar de Golden Hour, tons quentes e realistas.",
  studio: "Iluminação uniforme e suave de estúdio com softbox profissional, foco límpido.",
  dramatic: "Iluminação dramática chiaroscuro de alto contraste com sombras profundas e fachos de luz expressivos.",
  museum: "Iluminação clássica de galeria de arte e museu, tons terrosos, dourados e nobres.",
  night: "Iluminação noturna atmosférica com luz da lua e tochas/lanternas de época.",
};

const ASPECT_RATIO_MAP: Record<StudioImageAspectRatio, string> = {
  "3:4": "traditional_3_4",
  "1:1": "square_1_1",
  "4:3": "classic_4_3",
  "16:9": "widescreen_16_9",
};

/**
 * Otimiza e enriquece prompts usando as ferramentas de IA da Magnific (Magic Prompt)
 * com fallback inteligente para Gemini.
 */
export async function enhancePromptWithMagnific(
  rawPrompt: string,
  context?: { title?: string; engine?: MagnificEngine; subject?: string }
): Promise<string> {
  const magnificKey = import.meta.env.VITE_MAGNIFIC_API_KEY;
  const baseText = rawPrompt.trim() || context?.title || "Cena histórica educacional";

  // 1. Tenta API oficial da Magnific: POST /v1/ai/improve-prompt
  if (magnificKey) {
    try {
      const response = await fetch("https://api.magnific.com/v1/ai/improve-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-magnific-api-key": magnificKey,
        },
        body: JSON.stringify({
          prompt: `${baseText}${context?.subject ? ` (Contexto: aula de ${context.subject})` : ""}`,
          type: "image",
        }),
      });

      if (response.ok) {
        const payload = await response.json() as { data?: { task_id?: string; generated?: string[] } };
        const taskId = payload.data?.task_id;
        if (payload.data?.generated?.[0]) {
          return payload.data.generated[0];
        }

        if (taskId) {
          // Poll task status (geralmente conclui em 2-4 segundos)
          for (let attempt = 0; attempt < 8; attempt++) {
            await new Promise(r => setTimeout(r, 1200));
            const pollRes = await fetch(`https://api.magnific.com/v1/ai/improve-prompt/${taskId}`, {
              headers: { "x-magnific-api-key": magnificKey },
            });
            if (pollRes.ok) {
              const pollData = await pollRes.json() as { data?: { status?: string; generated?: string[] } };
              if (pollData.data?.status === "COMPLETED" && pollData.data.generated?.[0]) {
                return pollData.data.generated[0];
              }
              if (pollData.data?.status === "FAILED") break;
            }
          }
        }
      }
    } catch (err) {
      console.warn("[Magnific Improve Prompt] Fallback para Gemini:", err);
    }
  }

  // 2. Fallback para Gemini via gemini.ts
  try {
    const geminiPrompt = `Você é o especialista de Prompt Engineering da Magnific AI para materiais didáticos e históricos de altíssimo impacto visual.
Reescreva e aprimore esta descrição tornando-a rica, cinematográfica e visualmente descritiva (detalhando vestimentas autênticas, cenário, iluminação e composição de época, sem textos, sem legendas ou logos).
Descrição original: "${baseText}"
Contexto: ${context?.title || ""} ${context?.subject ? `(${context.subject})` : ""}
Estilo desejado: ${context?.engine || "realista documental"}
Retorne APENAS o texto do prompt enriquecido em português, em 2 ou 3 frases claras e vívidas.`;

    const res = await geminiModel.generateContent(geminiPrompt);
    const text = res.response?.text?.().trim();
    if (text && text.length > 10) return text;
  } catch (gemErr) {
    console.warn("[Gemini Improve Prompt Fallback]", gemErr);
  }

  // 3. Fallback inteligente local
  return `${baseText}, composição imersiva de alta resolução, fidelidade histórica rica em detalhes de vestimentas e ambientação, iluminação envolvente e texturas profundas, sem textos ou bordas.`;
}

/**
 * Gera imagens com a IA Magnific (Mystic 2K/4K ou Upscaler) com fallback inteligente para Gemini.
 */
export async function generateStudioImage(
  project: StudioProject,
  slide: StudioSlide,
  options?: GenerateImageOptions
): Promise<NonNullable<StudioSlide["image"]>> {
  // Converte estilo legado se necessário
  let engine: MagnificEngine = options?.engine || "photographic";
  if (!options?.engine && options?.style) {
    if (options.style === "realista") engine = "photographic";
    else if (options.style === "pintura") engine = "painting";
    else engine = "illustration";
  }

  const creativity: MagnificCreativity = options?.creativity || "medium";
  const hdr: MagnificHdr = options?.hdr || "standard";
  const lighting: MagnificLighting = options?.lighting || "natural";
  const selectedRatio: StudioImageAspectRatio = options?.aspectRatio || "3:4";

  const engineConfig = ENGINE_PROMPT_MAP[engine] || ENGINE_PROMPT_MAP.photographic;
  const creativityConfig = CREATIVITY_MAP[creativity] || CREATIVITY_MAP.medium;
  const hdrConfig = HDR_MAP[hdr] || HDR_MAP.standard;
  const lightingClause = LIGHTING_MAP[lighting] || LIGHTING_MAP.natural;
  const mappedRatio = ASPECT_RATIO_MAP[selectedRatio] || "traditional_3_4";

  const description = slide.image?.description?.trim() || `Imagem para ${slide.title}: ${slide.content}`;
  const context = JSON.stringify({
    tema: project.title,
    disciplina: project.subject,
    etapa: project.gradeLevel,
    ano: project.schoolYear,
    titulo: slide.title,
    texto: slide.content,
    motor: engine,
    criatividade: creativity,
    hdr,
    iluminacao: lighting,
    proporcao: selectedRatio,
  });

  const fullPrompt = `${description}. ${engineConfig.clause} ${lightingClause} ${hdrConfig.clause} ${creativityConfig.clause} Proporção exata para margem do slide. Proibido textos, legendas, logos ou molduras.`;

  let url: string | undefined;
  let provider = "Magnific AI";
  const magnificKey = import.meta.env.VITE_MAGNIFIC_API_KEY;

  // 1. GERAÇÃO OU REFINO DIRETO COM A API MAGNIFIC (MYSTIC / IMAGE-UPSCALER)
  if (magnificKey) {
    try {
      // Caso seja solicitação de Refino / Upscale com imagem existente
      if (options?.isUpscale && options?.sourceImageUrl && options.sourceImageUrl.startsWith("http")) {
        const upscalerRes = await fetch("https://api.magnific.com/v1/ai/image-upscaler", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-magnific-api-key": magnificKey,
          },
          body: JSON.stringify({
            image: options.sourceImageUrl,
            scale_factor: "2x",
            prompt: description.slice(0, 500),
            creativity: creativityConfig.value,
            hdr: hdrConfig.value,
            engine: engineConfig.engine,
          }),
        });

        if (upscalerRes.ok) {
          const upPayload = await upscalerRes.json() as { data?: { task_id?: string; generated?: string[] } };
          const taskId = upPayload.data?.task_id;
          if (taskId) {
            for (let i = 0; i < 30; i++) {
              await new Promise(r => setTimeout(r, 2000));
              const poll = await fetch(`https://api.magnific.com/v1/ai/image-upscaler/${taskId}`, {
                headers: { "x-magnific-api-key": magnificKey },
              });
              if (poll.ok) {
                const pollData = await poll.json() as { data?: { status?: string; generated?: string[] } };
                if (pollData.data?.status === "COMPLETED" && pollData.data.generated?.[0]) {
                  url = pollData.data.generated[0];
                  provider = "Magnific AI (Upscale)";
                  break;
                }
                if (pollData.data?.status === "FAILED") break;
              }
            }
          }
        }
      }

      // Se não for upscale ou se upscale não retornou, gera com Magnific Mystic
      if (!url) {
        const mysticRes = await fetch("https://api.magnific.com/v1/ai/mystic", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-magnific-api-key": magnificKey,
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            aspect_ratio: mappedRatio,
            model: engineConfig.model,
            engine: engineConfig.engine,
            resolution: hdr === "ultra" ? "2k" : "1k",
          }),
        });

        if (mysticRes.ok) {
          const payload = await mysticRes.json() as { data?: { task_id?: string; generated?: string[] } };
          const taskId = payload.data?.task_id;
          if (payload.data?.generated?.[0]) {
            url = payload.data.generated[0];
          } else if (taskId) {
            // Polling do resultado do Mystic
            for (let i = 0; i < 35; i++) {
              await new Promise(r => setTimeout(r, 1800));
              const poll = await fetch(`https://api.magnific.com/v1/ai/mystic/${taskId}`, {
                headers: { "x-magnific-api-key": magnificKey },
              });
              if (poll.ok) {
                const pollData = await poll.json() as { data?: { status?: string; generated?: string[] } };
                if (pollData.data?.status === "COMPLETED" && pollData.data.generated?.[0]) {
                  url = pollData.data.generated[0];
                  provider = "Magnific AI (Mystic)";
                  break;
                }
                if (pollData.data?.status === "FAILED") {
                  console.warn("[Magnific Mystic] Tarefa falhou:", pollData.data);
                  break;
                }
              }
            }
          }
        } else {
          console.warn("[Magnific Mystic] Erro HTTP:", mysticRes.status);
        }
      }

      // Se obtivemos URL externa da Magnific, fazemos download e upload para Storage próprio para garantir persistência
      if (url && url.startsWith("http") && auth.currentUser) {
        try {
          const fetchImg = await fetch(url);
          if (fetchImg.ok) {
            const blob = await fetchImg.blob();
            url = await uploadStudioImage(auth.currentUser.uid, project.id, slide.id, new File([blob], `magnific-${engine}.jpg`, { type: "image/jpeg" }));
          }
        } catch (uploadErr) {
          console.warn("Upload da imagem Magnific para Storage falhou, mantendo URL direta:", uploadErr);
        }
      }
    } catch (magErr) {
      console.warn("Falha no pipeline Magnific AI, iniciando fallback Gemini:", magErr);
    }
  }

  // 2. FALLBACK PARA GEMINI COM AS MESMAS DIRETRIZES MAGNIFIC
  if (!url) {
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (geminiKey) {
      try {
        provider = "Gemini AI";
        const geminiInstruction = `Crie uma imagem de altíssima definição no estilo ${engineConfig.title}.
Diretrizes Visuais da Cena: ${fullPrompt}
Composição: cobrir toda a margem do slide (${selectedRatio}).
Restrições estritas: Proibido qualquer texto, legenda, moldura, barra preta ou logotipo.`;

        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          signal: AbortSignal.timeout(90000),
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{
                text: `${geminiInstruction}\nDescrição detalhada: ${JSON.stringify(description.slice(0, 4000))}\nContexto: ${context}`
              }]
            }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
          }),
        });

        if (response.ok) {
          const data = await response.json() as { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };
          const image = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith("image/"))?.inlineData;
          if (image && ["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) {
            const binary = atob(image.data);
            if (binary.length <= 10 * 1024 * 1024) {
              const directDataUrl = `data:${image.mimeType};base64,${image.data}`;
              if (auth.currentUser) {
                try {
                  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
                  url = await uploadStudioImage(auth.currentUser.uid, project.id, slide.id, new File([bytes], `generated-${engine}.jpg`, { type: image.mimeType }));
                  cacheImageDataUrl(url, directDataUrl);
                } catch {
                  url = directDataUrl;
                }
              } else {
                url = directDataUrl;
              }
              cacheImageDataUrl(url, directDataUrl);
            }
          }
        }
      } catch (gemErr) {
        console.warn("Fallback Gemini falhou:", gemErr);
      }
    }
  }

  // 3. FALLBACK FINAL PARA FIREBASE CLOUD FUNCTION
  if (!url) {
    try {
      const response = await generateImageCallable({
        projectId: project.id,
        slideId: slide.id,
        description: `${description.slice(0, 3500)}. ${engineConfig.clause}`,
        context,
      });
      url = response.data?.url;
      provider = "Servidor Studio";
    } catch (cause) {
      throw new Error(cause instanceof Error ? cause.message : "Não foi possível gerar a imagem com IA.");
    }
  }

  if (!url || (!url.startsWith("data:") && !url.startsWith("http"))) {
    throw new Error("A geração não retornou uma imagem válida.");
  }

  return {
    description,
    url,
    source: `Fonte: ${engineConfig.title} gerada por ${provider}`,
    status: `Gerada com ${provider} (${engineConfig.title}) — revisar`,
    aspectRatio: selectedRatio,
    fit: slide.image?.fit || "cover",
  };
}

// Cache em memória de data URLs para evitar requisições repetidas e garantir 100% de disponibilidade no PDF/PPTX
const dataUrlCache = new Map<string, string>();

export function cacheImageDataUrl(url: string, dataUrl: string): void {
  if (url && dataUrl) {
    dataUrlCache.set(url, dataUrl);
  }
}

/**
 * Converte qualquer URL de imagem (Firebase Storage, CDN externo, etc.)
 * para Data URL Base64 sem ser bloqueado por restrições de CORS.
 */
export async function resolveImageAsDataUrl(imageUrl?: string): Promise<string> {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:")) return imageUrl;

  // Verifica cache em memória
  if (dataUrlCache.has(imageUrl)) {
    return dataUrlCache.get(imageUrl)!;
  }

  // 1. Tenta via proxy local do Vite para eliminar 100% de CORS
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const blob = await proxyRes.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl) {
        dataUrlCache.set(imageUrl, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // Continua
  }

  // 2. Tenta fetch direto
  try {
    const directRes = await fetch(imageUrl, { mode: "cors" });
    if (directRes.ok) {
      const blob = await directRes.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl) {
        dataUrlCache.set(imageUrl, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // Continua
  }

  // 3. Tenta via offscreen canvas
  try {
    const canvasDataUrl = await new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(imageUrl);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch {
          resolve(imageUrl);
        }
      };
      img.onerror = () => resolve(imageUrl);
      img.src = imageUrl;
    });
    if (canvasDataUrl && canvasDataUrl.startsWith("data:")) {
      dataUrlCache.set(imageUrl, canvasDataUrl);
      return canvasDataUrl;
    }
  } catch {
    // Continua
  }

  return imageUrl;
}

/**
 * Converte qualquer URL de imagem para Blob binário seguro para inserção no PowerPoint (.pptx).
 */
export async function resolveImageAsBlob(imageUrl?: string): Promise<Blob | null> {
  if (!imageUrl) return null;
  const dataUrl = await resolveImageAsDataUrl(imageUrl);
  if (!dataUrl) return null;

  if (dataUrl.startsWith("data:")) {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  }

  try {
    const res = await fetch(dataUrl);
    if (res.ok) return await res.blob();
  } catch {
    /* ignore fetch error */
  }

  return null;
}

export async function uploadStudioImage(userId: string, projectId: string, slideId: string, file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) {
    throw new Error("Envie uma imagem PNG, JPG ou WebP de até 10 MB.");
  }
  const path = ref(storage, `users/${userId}/studio/${projectId}/${slideId}-${crypto.randomUUID()}`);
  await uploadBytes(path, file, { contentType: file.type });
  const downloadUrl = await getDownloadURL(path);
  try {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        cacheImageDataUrl(downloadUrl, reader.result);
      }
    };
    reader.readAsDataURL(file);
  } catch {
    /* ignore caching error */
  }
  return downloadUrl;
}
