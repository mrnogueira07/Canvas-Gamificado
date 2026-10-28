import { model } from "./gemini";
import { parseGeneratedContent } from "./studioGeneration";
import { studioPrompt, studioWarnings } from "./studioGuidelines";
import { saveStudioProject } from "./studioProjects";
import type { ExtractedReferenceImage, StudioProject, StudioSlide } from "./studioProjects";
import { generateStudioImage } from "./studioImages";

const imageStopWords = new Set(["a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "no", "na", "um", "uma", "para", "com", "por", "que", "como", "ou", "se", "ao", "aos", "sua", "seu", "imagem", "figura", "foto", "slide", "pagina", "material", "apostila", "fonte"]);
const imageTokens = (value: string) => new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{2,}/g)?.filter(word => (word.length >= 3 || word === "qr") && !imageStopWords.has(word)) || []);
const overlap = (left: Set<string>, right: Set<string>) => [...left].filter(word => right.has(word)).length;
const pageNumbers = (value?: string) => new Set(value?.match(/\d+/g) || []);
const hasOriginalCredit = (source?: string) => Boolean(source && /^Fonte:\s*\S/i.test(source) && !/validar|gerada por ia|material de refer[eê]ncia|banco de imagens|\(autor\)/i.test(source));

/** Match a generated slide to an original image when the source metadata or AI referenceId supports it. */
export function matchReferenceImage(slide: StudioSlide, images: ExtractedReferenceImage[], usedIds = new Set<string>()): ExtractedReferenceImage | undefined {
  if (["capa", "objetivo_bncc", "encerramento", "exercicio", "gabarito"].includes(slide.type || "")) return;
  const available = images.filter(image => !usedIds.has(image.id));
  if (!available.length) return;
  const id = slide.image?.referenceId;
  const byId = id ? available.find(image => image.id === id) : undefined;
  if (byId) {
    return byId;
  }
  const slidePages = pageNumbers(slide.sourcePages || slide.image?.page);
  const slideWords = imageTokens([slide.title, slide.content, slide.image?.description || "", slide.image?.caption || ""].join(" "));
  let best: { image: ExtractedReferenceImage; score: number } | undefined;
  for (const image of available) {
    const imagePages = pageNumbers(image.page);
    const samePage = Boolean(slidePages.size && imagePages.size && [...slidePages].some(page => imagePages.has(page)));
    const captionMatches = overlap(slideWords, imageTokens(`${image.caption || ""} ${image.label || ""} ${image.name || ""}`));
    const contextMatches = overlap(slideWords, imageTokens(image.context || ""));
    const score = (samePage ? 4 : 0) + captionMatches * 3 + Math.min(contextMatches, 4);
    if (score > (best?.score || 0)) {
      best = { image, score };
    }
  }
  if (best && best.score >= 2) return best.image;
  // Se o slide pediu imagem explicitamente e há imagens disponíveis no material sem conflito, vincula a próxima disponível
  if (slide.image?.description || ["imagem_esquerda_texto_direita", "topicos_com_imagem"].includes(slide.layout || "")) {
    return available[0];
  }
  return undefined;
}

export function associateReferenceImages(slides: StudioSlide[], images: ExtractedReferenceImage[], sourceFileName?: string): StudioSlide[] {
  const used = new Set<string>();
  return slides.map(slide => {
    if (["capa", "objetivo_bncc", "encerramento"].includes(slide.type || "")) return slide;
    const match = matchReferenceImage(slide, images, used);
    if (!match) {
      if (!slide.image || slide.image.url) return slide;
      return { ...slide, image: undefined, pending: [...(slide.pending || []), "Imagem sugerida sem correspondência segura com o texto e o material enviado. Selecione a imagem correta na galeria."] };
    }
    used.add(match.id);
    const source = match.source && hasOriginalCredit(match.source)
      ? match.source
      : hasOriginalCredit(slide.image?.source) ? slide.image!.source
      : `Fonte: ${sourceFileName || "material enviado"}${match.page ? `, p. ${match.page}` : ""}`;
    const pending = (slide.pending || []).filter(item => !/imagem/i.test(item));
    if (!hasOriginalCredit(match.source) && !hasOriginalCredit(slide.image?.source)) pending.push("Confirme o crédito original da imagem no material enviado.");
    const description = slide.image?.description && !/^(?:imagem|figura|ilustra[cç][aã]o)(?:\s+(?:do|da|de)\s+(?:material|apostila|refer[eê]ncia))?(?:\s+(?:enviado|original))?\s*$/i.test(slide.image.description.trim())
      ? slide.image.description
      : match.caption || (!/^Imagem\s+\d+/i.test(match.name) ? match.name : slide.title);
    return {
      ...slide,
      layout: "imagem_esquerda_texto_direita",
      image: {
        description,
        source,
        status: "Imagem original do material",
        referenceId: match.id,
        page: match.page || slide.image?.page,
        caption: match.caption || slide.image?.caption,
        url: match.url,
      },
      pending,
    };
  });
}

export interface StudioJob {
  userId: string;
  projectId: string;
  title: string;
  kind: StudioProject["kind"];
  status: "generating" | "reviewing" | "illustrating" | "ready" | "error";
  message: string;
  startedAt?: number;
  progressStep?: number;
  result?: StudioProject;
  dismissed?: boolean;
}

let jobs: StudioJob[] = [];
const listeners = new Set<() => void>();
export const getStudioJobs = () => jobs;
export function subscribeStudioJobs(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(job: StudioJob) {
  const previous = jobs.find(item => item.userId === job.userId && item.projectId === job.projectId);
  const next = {
    ...previous,
    ...job,
    startedAt: job.status === "generating" ? job.startedAt : previous?.startedAt ?? job.startedAt,
    progressStep: job.status === "generating" ? 0 : Math.max(previous?.progressStep ?? 0, job.progressStep ?? 0),
    result: job.status === "generating" ? undefined : job.result ?? previous?.result,
  };
  jobs = [...jobs.filter(item => item.userId !== job.userId || item.projectId !== job.projectId), next];
  listeners.forEach(listener => listener());
}
export function dismissStudioJob(userId: string, projectId: string) {
  jobs = jobs.map(item => item.userId === userId && item.projectId === projectId ? { ...item, dismissed: true } : item);
  listeners.forEach(listener => listener());
}
export function removeStudioJob(userId: string, projectId: string) {
  jobs = jobs.filter(item => !(item.userId === userId && item.projectId === projectId));
  listeners.forEach(listener => listener());
}
export function isStudioJobRunning(job?: StudioJob) {
  return job?.status === "generating" || job?.status === "reviewing" || job?.status === "illustrating";
}

export function markStudioJobSaved(userId: string, project: StudioProject) {
  const job = jobs.find(item => item.userId === userId && item.projectId === project.id);
  if (job?.status === "error" && job.result) {
    publish({ ...job, status: "ready", result: project, message: "Sua aula está pronta e o rascunho foi salvo." });
  }
}

export async function withStudioDeadline<T>(work: Promise<T>, milliseconds: number, message = "A geração excedeu o tempo de espera. Seu briefing está salvo; tente novamente."): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

// Owned by the application module, so route changes never discard the result.
export function startStudioJob(userId: string, project: StudioProject): void {
  if (isStudioJobRunning(jobs.find(job => job.userId === userId && job.projectId === project.id))) return;
  // Fail before starting a request if the browser cannot preserve the briefing.
  const saved = saveStudioProject(userId, project);
  const job: StudioJob = { userId, projectId: saved.id, kind: saved.kind, title: saved.title, status: "generating", message: "Lendo a apostila e os tópicos…", startedAt: Date.now(), progressStep: 0 };
  publish(job);
  void run(job, saved);
}

async function run(job: StudioJob, project: StudioProject) {
  try {
    const isKonectarSlides = project.kind === "slides" && (project.line || "Konectar.me") === "Konectar.me";
    const prompt = studioPrompt(project);
    const request = (text: string) => model.generateContent({ contents: [{ role: "user", parts: [{ text }] }], generationConfig: { responseMimeType: "application/json" } });
    const response = await withStudioDeadline(request(prompt), 130000);
    let result: ReturnType<typeof parseGeneratedContent>;
    let repaired = false;
    try {
      result = parseGeneratedContent(response.response.text(), project.kind);
    } catch (cause) {
      repaired = true;
      publish({ ...job, status: "reviewing", message: "Ajustando o formato da resposta da IA…" });
      const fixed = await withStudioDeadline(request(`${prompt}\n# CORREÇÃO DE FORMATO\nA resposta anterior não pôde ser lida: ${cause instanceof Error ? cause.message : "JSON inválido"}.\nDevolva o JSON completo corrigido, preservando o conteúdo. Cada slide deve ter 'titulo' (string não vazia, ex.: tema na capa, 'Objetivo e BNCC', títulos nos conceitos e 'Encerramento' no final), 'etapa', 'layout', 'nota_apresentador', 'tempo_seg' e 'texto' como lista de strings (ou [] nos slides fixos sem texto em tela), nunca um objeto. Não adicione explicações fora do JSON.\nResposta anterior:\n${response.response.text()}`), 45000);
      result = parseGeneratedContent(fixed.response.text(), project.kind);
    }
    publish({ ...job, status: "reviewing", progressStep: 1, message: "Montando a estrutura obrigatória do modelo…" });
    const actionable = (candidate: typeof result) => studioWarnings({ ...project, ...candidate }).filter(warning => !/VALIDAR|BUSCAR|Competência desenvolvida a definir/.test(warning));
    const corrections = actionable(result);
    if (corrections.length && project.kind !== "roteiro" && !repaired) {
      publish({ ...job, status: "reviewing", progressStep: 1, message: "Estrutura criada. Revisando o checklist…" });
      try {
        const revised = await withStudioDeadline(request(`${prompt}\n# CORREÇÃO DO CHECKLIST\nCorrija estes problemas sem inventar informação e devolva o JSON completo no mesmo formato:\n${JSON.stringify(corrections)}\nResposta anterior:\n${response.response.text()}`), 45000);
        const candidate = parseGeneratedContent(revised.response.text(), project.kind);
        const remaining = actionable(candidate);
        const emptySlidesFixed = actionable(result).filter(item => /conteúdo principal vazio/i.test(item)).every(item => !remaining.includes(item));
        if (remaining.length < corrections.length || corrections.every(item => !remaining.includes(item)) || emptySlidesFixed) result = candidate;
      } catch { /* Keep the complete first result if optional review fails or times out. */ }
    }
    const emptyContentSlides = actionable(result).filter(warning => /conteúdo principal vazio/i.test(warning));
    if (emptyContentSlides.length) {
      throw new Error("A IA retornou slides obrigatórios sem conteúdo principal mesmo após a revisão. Tente gerar novamente.");
    }
    let completed = { ...project, ...result, alerts: [...(project.alerts || []), ...(result.alerts || [])] };
    let failedImages = 0;
    if (project.kind !== "roteiro") {
      publish({ ...job, status: "illustrating", progressStep: 2, result: completed, message: "Conferindo imagens e referências da apostila…" });
      const refImages = project.referenceImages || [];
      if (refImages.length > 0) {
        completed = { ...completed, slides: associateReferenceImages(completed.slides, refImages, project.sourceFileName) };
      }

      // Never replace an unmatched original with a generated illustration.
      const targets = refImages.length ? [] : completed.slides.filter(slide => slide.image?.description && !slide.image?.url && !["capa", "objetivo_bncc", "encerramento"].includes(slide.type || ""));
      if (targets.length) {
        publish({ ...job, status: "illustrating", result: completed, message: "Slides e textos estruturados! Ilustrando a aula…" });
        saveStudioProject(job.userId, completed);
        let next = 0, finished = 0;
        let serviceUnavailable = false;
        const worker = async () => {
          while (next < targets.length) {
            const slide = targets[next++];
            publish({ ...job, status: "illustrating", result: completed, message: `Criando imagens da aula · ${finished} de ${targets.length} concluídas…` });
            try {
              if (serviceUnavailable) throw new Error("Serviço de imagens indisponível.");
              const image = await withStudioDeadline(generateStudioImage(project, slide), 115000);
              completed = { ...completed, slides: completed.slides.map(item => item.id === slide.id ? { ...item, image, layout: "imagem_esquerda_texto_direita" } : item) };
            } catch {
              failedImages++;
              serviceUnavailable = true;
              completed = { ...completed, slides: completed.slides.map(item => item.id === slide.id ? { ...item, image: { ...item.image!, status: "Não gerada — tentar novamente" }, pending: [...(item.pending || []), "Geração da imagem pendente. Use Gerar imagem na edição do slide."] } : item) };
            }
            finished++;
            publish({ ...job, status: "illustrating", result: completed, message: `Criando imagens da aula · ${finished} de ${targets.length} concluídas…` });
          }
        };
        await Promise.all([worker(), worker()]);
      }
    }
    publish({ ...job, status: "reviewing", progressStep: 3, result: completed, message: "Aplicando o modelo visual e a área de segurança…" });
    publish({ ...job, status: "reviewing", progressStep: 4, result: completed, message: "Conferindo as notas do apresentador…" });
    const finalWarnings = studioWarnings(completed);
    completed = { ...completed, alerts: [...new Set([...(completed.alerts || []), ...finalWarnings.filter(item => /página|fonte|imagem|BNCC|validar/i.test(item))])] };
    publish({ ...job, status: "reviewing", progressStep: 5, result: completed, message: "Conferindo as orientações do projeto…" });
    const saved = saveStudioProject(job.userId, completed);
    publish({
      ...job,
      status: "ready",
      progressStep: 6,
      result: saved,
      message: failedImages
        ? `Slides preenchidos! ${failedImages} imagem(ns) pendente(s); você pode gerar na edição dos slides.`
        : (isKonectarSlides ? "Aula Síntese pronta para revisão." : project.referenceImages?.length ? "Sua aula está pronta e as imagens originais foram inseridas automaticamente nos slides!" : "Sua aula está pronta e os slides foram preenchidos a partir do conteúdo de referência!")
    });
  } catch (cause) {
    publish({ ...job, status: "error", message: cause instanceof Error ? cause.message : "Não foi possível gerar a aula. Seu briefing está salvo; tente novamente." });
  }
}
