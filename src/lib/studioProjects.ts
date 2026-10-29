export type StudioKind = "slides" | "roteiro" | "pacote";
export type StudioSlideImageAspect = "3:4" | "1:1" | "4:3" | "16:9";
export type StudioSlideImageFit = "cover" | "contain";

export interface StudioTimelineItem {
  label: string;
  text?: string;
  image?: {
    url?: string;
    description?: string;
    source?: string;
    aspectRatio?: StudioSlideImageAspect;
    fit?: StudioSlideImageFit;
  };
}

export interface StudioSlide {
  id: string;
  title: string;
  content: string;
  notes: string;
  type?: string;
  duration?: number;
  stage?: string;
  layout?: string;
  image?: {
    description: string;
    source: string;
    status: string;
    url?: string;
    referenceId?: string;
    page?: string;
    caption?: string;
    aspectRatio?: StudioSlideImageAspect;
    fit?: StudioSlideImageFit;
    positionX?: number;
    positionY?: number;
  };
  imageOffsetY?: number;
  textOffsetY?: number;
  lockToBounds?: boolean;
  images?: { url: string; description?: string; source?: string }[];
  formula?: string;
  objective?: string;
  curriculum?: string;
  sourcePages?: string;
  skills?: string[];
  highlight?: string;
  columns?: { title: string; items: string[] }[];
  timelineItems?: StudioTimelineItem[];
  exerciseQuestion?: string;
  alternatives?: { label: string; text: string; correct: boolean }[];
  justification?: string;
  pending?: string[];
}

export interface StudioScene {
  id: string;
  title: string;
  duration: string;
  speech: string;
  visual: string;
}

export interface ExtractedReferenceImage {
  id: string;
  name: string;
  label?: string;
  url: string;
  sizeBytes?: number;
  /** Page number in the PDF (or printed page when the document supplies one). */
  page?: string;
  /** Caption and authentic credit detected beside the image. */
  caption?: string;
  source?: string;
  /** Short text from the same page/paragraph used to match the image to a slide. */
  context?: string;
}

export interface StudioProject {
  id: string;
  kind: StudioKind;
  title: string;
  subject: string;
  gradeLevel: string;
  objective: string;
  sourceContent: string;
  sourceFileName?: string;
  referenceImages?: ExtractedReferenceImage[];
  line?: string;
  schoolYear?: string;
  bimester?: string;
  teacher?: string;
  subtitle?: string;
  curriculum?: string;
  exercise?: string;
  observations?: string;
  alerts?: string[];
  targetSlideCount?: number;
  slides: StudioSlide[];
  scenes: StudioScene[];
  updatedAt: string;
}

export const STUDIO_PROJECTS_EVENT = "mind-canvas:projects-changed";
const storageKey = (userId: string) => `mind-canvas:studio:v1:${userId}`;

export function createStudioId(): string {
  return crypto.randomUUID();
}

export function studioFilename(project: StudioProject): string {
  const clean = (value: string) => value.toUpperCase().replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim();
  const subjects: Record<string, string> = { GEOGRAFIA: "GEO", MATEMÁTICA: "MAT", HISTÓRIA: "HIS", CIÊNCIAS: "CIE", "LÍNGUA PORTUGUESA": "POR", PORTUGUÊS: "POR", BIOLOGIA: "BIO", FÍSICA: "FIS", QUÍMICA: "QUI" };
  const subject = clean(project.subject || (project.line === "Educação Corporativa" ? "CORP" : "AULA"));
  const year = project.schoolYear?.match(/\d+/)?.[0];
  const bimester = project.bimester?.match(/\d+/)?.[0];
  return ["AP", subjects[subject] || subject, year ? `${year}ANO` : "", bimester ? `${bimester}BIM` : "", clean(project.title || "AULA")].filter(Boolean).join("_").slice(0, 180);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidSlideImage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!["description", "source", "status"].every(key => typeof value[key] === "string")) return false;
  if (!["referenceId", "page", "caption", "aspectRatio", "fit"].every(key => value[key] === undefined || typeof value[key] === "string")) return false;
  return value.url === undefined || (typeof value.url === "string" && /^(https?:\/\/|data:image\/|blob:|\/)/.test(value.url));
}

const stopWords = new Set(["a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "no", "na", "um", "uma", "para", "com", "por", "que", "como", "ou", "se", "ao", "aos", "sua", "seu", "imagem", "figura", "foto", "slide", "pagina", "material", "apostila", "fonte"]);
function extractTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-z0-9]{3,}/g)
      ?.filter(w => !stopWords.has(w)) || []
  );
}

/**
 * Restaura URLs de imagens e referenceImages que possam ter sido omitidas no localStorage
 * devido ao limite de cota de 5MB, ou vincula imagens da apostila a slides cujo url está ausente.
 */
export function hydrateProjectImages(project: StudioProject, fallback?: StudioProject): StudioProject {
  const refImages = (project.referenceImages && project.referenceImages.length > 0)
    ? project.referenceImages
    : (fallback?.referenceImages || []);

  const usedRefIds = new Set<string>();
  for (const s of project.slides) {
    if (s.image?.referenceId && s.image?.url) usedRefIds.add(s.image.referenceId);
    if (s.image?.url && refImages.length > 0) {
      const matchedByUrl = refImages.find(r => r.url === s.image?.url);
      if (matchedByUrl) usedRefIds.add(matchedByUrl.id);
    }
  }

  let changed = refImages !== project.referenceImages;
  const hydratedSlides = project.slides.map(slide => {
    if (!slide.image || slide.image.url || slide.image.status === "Removida") {
      return slide;
    }

    const fbSlide = fallback?.slides.find(s => s.id === slide.id || (s.title && s.title === slide.title));
    if (fbSlide?.image?.url) {
      changed = true;
      return {
        ...slide,
        layout: slide.layout === "so_texto" ? "imagem_esquerda_texto_direita" : (slide.layout || "imagem_esquerda_texto_direita"),
        image: {
          ...slide.image,
          url: fbSlide.image.url,
          referenceId: slide.image.referenceId || fbSlide.image.referenceId,
          aspectRatio: slide.image.aspectRatio || fbSlide.image.aspectRatio,
          fit: slide.image.fit || fbSlide.image.fit,
        },
      };
    }

    if (refImages.length > 0 && !["capa", "objetivo_bncc", "encerramento"].includes(slide.type || "")) {
      // 1. Tenta por referenceId explícito
      let matchedRef = slide.image.referenceId
        ? refImages.find(r => r.id === slide.image?.referenceId)
        : undefined;

      // 2. Tenta por correspondência semântica (título + descrição da imagem + conteúdo)
      if (!matchedRef) {
        const slideWords = extractTokens(`${slide.title} ${slide.image.description || ""} ${slide.image.caption || ""} ${slide.content}`);
        let bestScore = 0;
        for (const candidate of refImages) {
          if (usedRefIds.has(candidate.id)) continue;
          const candWords = extractTokens(`${candidate.caption || ""} ${candidate.context || ""} ${candidate.label || ""} ${candidate.name || ""}`);
          let overlapCount = 0;
          for (const w of slideWords) {
            if (candWords.has(w)) overlapCount++;
          }
          const score = overlapCount * 3 + (!usedRefIds.has(candidate.id) ? 1 : 0);
          if (score > bestScore) {
            bestScore = score;
            matchedRef = candidate;
          }
        }
      }

      // 3. Se o slide faz referência direta ao arquivo enviado ("Fonte: AP_...") e ainda não achou, usa a próxima imagem disponível da apostila
      if (!matchedRef && (slide.image.source?.includes(project.sourceFileName || "AP_") || slide.image.description)) {
        matchedRef = refImages.find(r => !usedRefIds.has(r.id)) || refImages[0];
      }

      if (matchedRef?.url) {
        usedRefIds.add(matchedRef.id);
        changed = true;
        return {
          ...slide,
          layout: slide.layout === "so_texto" ? "imagem_esquerda_texto_direita" : (slide.layout || "imagem_esquerda_texto_direita"),
          image: {
            ...slide.image,
            url: matchedRef.url,
            referenceId: matchedRef.id,
            status: "Imagem original do material",
          },
          pending: slide.pending?.filter(p => !/imagem/i.test(p)),
        };
      }
    }

    return slide;
  });

  if (!changed) return project;
  return {
    ...project,
    referenceImages: refImages,
    slides: hydratedSlides,
  };
}

function isStudioProject(value: unknown): value is StudioProject {
  if (!isRecord(value)) return false;
  const kind = String(value.kind);
  if (!["slides", "roteiro", "pacote"].includes(kind)) return false;
  if (typeof value.id !== "string" || typeof value.title !== "string") return false;
  if (value.updatedAt === undefined || Number.isNaN(Date.parse(String(value.updatedAt)))) return false;
  if (!Array.isArray(value.slides) || !Array.isArray(value.scenes)) return false;

  return (
    ["sourceFileName", "line", "schoolYear", "bimester", "teacher", "subtitle", "curriculum", "exercise", "observations", "subject", "gradeLevel", "objective", "sourceContent"].every(
      key => value[key] === undefined || typeof value[key] === "string"
    ) &&
    (value.alerts === undefined || (Array.isArray(value.alerts) && value.alerts.every(item => typeof item === "string"))) &&
    (value.targetSlideCount === undefined || typeof value.targetSlideCount === "number") &&
    (value.referenceImages === undefined || (Array.isArray(value.referenceImages) && value.referenceImages.every((img: unknown) => isRecord(img) && typeof img.url === "string"))) &&
    value.slides.every((slide: unknown) => isRecord(slide) && ["id", "title"].every((key) => typeof slide[key] === "string") &&
      ["content", "notes", "type", "stage", "layout", "formula", "objective", "curriculum"].every(key => slide[key] === undefined || typeof slide[key] === "string") &&
      ["sourcePages", "highlight", "exerciseQuestion", "justification"].every(key => slide[key] === undefined || typeof slide[key] === "string") &&
      ["skills"].every(key => slide[key] === undefined || (Array.isArray(slide[key]) && (slide[key] as unknown[]).every(item => typeof item === "string"))) &&
      (slide.alternatives === undefined || (Array.isArray(slide.alternatives) && slide.alternatives.every(item => isRecord(item) && typeof item.label === "string" && typeof item.text === "string" && typeof item.correct === "boolean"))) &&
      (slide.columns === undefined || (Array.isArray(slide.columns) && slide.columns.every(item => isRecord(item) && typeof item.title === "string" && Array.isArray(item.items) && item.items.every(val => typeof val === "string")))) &&
      (slide.timelineItems === undefined || (Array.isArray(slide.timelineItems) && slide.timelineItems.every(item => isRecord(item) && typeof item.label === "string" && (item.text === undefined || typeof item.text === "string")))) &&
      (slide.duration === undefined || (typeof slide.duration === "number" && Number.isFinite(slide.duration) && slide.duration >= 0)) &&
      (slide.pending === undefined || (Array.isArray(slide.pending) && slide.pending.every(item => typeof item === "string"))) &&
      (slide.image === undefined || isValidSlideImage(slide.image))) &&
    value.scenes.every((scene: unknown) => isRecord(scene) && ["id", "title"].every((key) => typeof scene[key] === "string") &&
      ["duration", "speech", "visual"].every(key => scene[key] === undefined || typeof scene[key] === "string"))
  );
}

// Cache em memória para acesso síncrono rápido e sem restrição de cota
const projectsMemory = new Map<string, StudioProject[]>();

const IDB_NAME = "mind-canvas-studio-db";
const IDB_STORE = "projects";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSaveProject(project: StudioProject): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(project);
  } catch (err) {
    console.warn("Aviso ao salvar no IndexedDB:", err);
  }
}

async function idbDeleteProject(projectId: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(projectId);
  } catch (err) {
    console.warn("Aviso ao excluir do IndexedDB:", err);
  }
}

async function syncFromIndexedDb(userId: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => {
      const all = req.result as StudioProject[];
      if (Array.isArray(all) && all.length > 0) {
        const cached = projectsMemory.get(userId) || [];
        const mergedMap = new Map<string, StudioProject>();
        for (const p of all) {
          if (isStudioProject(p)) mergedMap.set(p.id, hydrateProjectImages(p));
        }
        for (const p of cached) {
          const idbVersion = mergedMap.get(p.id);
          if (!idbVersion) {
            mergedMap.set(p.id, hydrateProjectImages(p));
          } else if (Date.parse(p.updatedAt) > Date.parse(idbVersion.updatedAt)) {
            mergedMap.set(p.id, hydrateProjectImages(p, idbVersion));
          } else {
            mergedMap.set(p.id, hydrateProjectImages(idbVersion, p));
          }
        }
        const merged = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        projectsMemory.set(userId, merged);
        window.dispatchEvent(new Event(STUDIO_PROJECTS_EVENT));
      }
    };
  } catch {
    // Silently ignore background sync failure
  }
}

// Conjunto em memória de IDs de projetos confirmados na nuvem (Firestore)
const syncedCloudProjectIds = new Set<string>();

export function isStudioProjectSynced(projectId: string): boolean {
  return syncedCloudProjectIds.has(projectId);
}

interface FirestoreServices {
  auth: typeof import("./firebase").auth;
  db: typeof import("./firebase").db;
  collection: typeof import("firebase/firestore").collection;
  doc: typeof import("firebase/firestore").doc;
  getDocs: typeof import("firebase/firestore").getDocs;
  query: typeof import("firebase/firestore").query;
  setDoc: typeof import("firebase/firestore").setDoc;
  deleteDoc: typeof import("firebase/firestore").deleteDoc;
  where: typeof import("firebase/firestore").where;
}

let firestoreServicesPromise: Promise<FirestoreServices | null> | null = null;

async function getFirestoreServices(): Promise<FirestoreServices | null> {
  if (typeof window === "undefined") return null;
  if (!firestoreServicesPromise) {
    firestoreServicesPromise = (async () => {
      try {
        const { auth, db } = await import("./firebase");
        const firestore = await import("firebase/firestore");
        return {
          auth,
          db,
          collection: firestore.collection,
          doc: firestore.doc,
          getDocs: firestore.getDocs,
          query: firestore.query,
          setDoc: firestore.setDoc,
          deleteDoc: firestore.deleteDoc,
          where: firestore.where,
        };
      } catch (err) {
        console.warn("Aviso: Firebase Firestore indisponível para sincronização em nuvem:", err);
        return null;
      }
    })();
  }
  return firestoreServicesPromise;
}

export function sanitizeStudioProjectForFirestore(project: StudioProject, userId: string): Record<string, unknown> {
  const clean: Record<string, unknown> = {
    id: project.id,
    userId: userId || "local",
    kind: project.kind,
    type: project.kind,
    title: project.title.trim() || "Projeto sem título",
    subject: project.subject || "",
    grade: project.gradeLevel || "",
    gradeLevel: project.gradeLevel || "",
    objective: project.objective || "",
    sourceContent: project.sourceContent || "",
    sourceFileName: project.sourceFileName || null,
    line: project.line || "Konectar.me",
    schoolYear: project.schoolYear || "",
    bimester: project.bimester || "",
    teacher: project.teacher || "",
    subtitle: project.subtitle || "",
    curriculum: project.curriculum || "",
    exercise: project.exercise || "",
    observations: project.observations || "",
    alerts: project.alerts || [],
    targetSlideCount: project.targetSlideCount || 10,
    slides: project.slides || [],
    scenes: project.scenes || [],
    updatedAt: project.updatedAt || new Date().toISOString(),
    createdAt: project.updatedAt || new Date().toISOString(),
    order: Date.parse(project.updatedAt) || Date.now(),
  };

  if (Array.isArray(project.referenceImages)) {
    clean.referenceImages = project.referenceImages.map(img => {
      const isHuge = typeof img.url === "string" && img.url.startsWith("data:") && img.url.length > 50000;
      return {
        id: img.id,
        name: img.name,
        label: img.label || null,
        url: isHuge ? "" : img.url,
        sizeBytes: img.sizeBytes || null,
        page: img.page || null,
        caption: img.caption || null,
        source: img.source || null,
        context: img.context || null,
      };
    });
  }

  const stripNullBytes = (val: unknown): unknown => {
    if (typeof val === "string") return val.split("\0").join("");
    if (Array.isArray(val)) return val.map(stripNullBytes);
    if (val && typeof val === "object") {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (v !== undefined) res[k] = stripNullBytes(v);
      }
      return res;
    }
    return val;
  };

  const removeNestedArrays = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      const v = rec[key];
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (Array.isArray(v[i])) {
            v[i] = [];
          } else if (typeof v[i] === "object") {
            removeNestedArrays(v[i]);
          }
        }
      } else if (typeof v === "object") {
        removeNestedArrays(v);
      }
    }
  };

  const sanitized = stripNullBytes(clean) as Record<string, unknown>;
  removeNestedArrays(sanitized);

  if (Array.isArray(sanitized.slides)) {
    sanitized.slides = (sanitized.slides as Record<string, unknown>[]).map(slide => {
      const img = slide?.image as Record<string, unknown> | undefined;
      if (img?.url && typeof img.url === "string" && img.url.startsWith("data:") && img.url.length > 200000) {
        return {
          ...slide,
          image: {
            ...img,
            url: undefined,
          },
        };
      }
      return slide;
    });
  }

  return sanitized;
}

export async function saveStudioProjectToFirestore(userId: string, project: StudioProject): Promise<void> {
  if (!userId || userId === "local") return;
  const services = await getFirestoreServices();
  if (!services) return;
  try {
    const payload = sanitizeStudioProjectForFirestore(project, userId);
    const user = services.auth.currentUser;
    if (user) {
      payload.authorName = user.displayName || user.email?.split("@")[0] || "";
      payload.authorEmail = user.email || "";
      payload.authorPhoto = user.photoURL || null;
    }
    await services.setDoc(services.doc(services.db, "projects", project.id), payload, { merge: true });
    syncedCloudProjectIds.add(project.id);
  } catch (err) {
    console.warn("Aviso ao sincronizar projeto com o Firestore:", err);
  }
}

export async function deleteStudioProjectFromFirestore(projectId: string): Promise<void> {
  if (!projectId) return;
  const services = await getFirestoreServices();
  if (!services) return;
  try {
    await services.deleteDoc(services.doc(services.db, "projects", projectId));
    syncedCloudProjectIds.delete(projectId);
  } catch (err) {
    console.warn("Aviso ao remover projeto do Firestore:", err);
  }
}

export async function syncStudioProjectsFromCloud(userId: string): Promise<StudioProject[]> {
  if (!userId || userId === "local") return getStudioProjects(userId);
  const services = await getFirestoreServices();
  if (!services) return getStudioProjects(userId);
  try {
    const q = services.query(services.collection(services.db, "projects"), services.where("userId", "==", userId));
    const snap = await services.getDocs(q);
    const cloudProjects: StudioProject[] = [];

    snap.docs.forEach(d => {
      const data = d.data();
      if (["slides", "roteiro", "pacote"].includes(String(data.kind)) || Array.isArray(data.slides)) {
        if (isStudioProject(data)) {
          cloudProjects.push(hydrateProjectImages(data));
          syncedCloudProjectIds.add(d.id);
        }
      }
    });

    if (cloudProjects.length > 0) {
      const cached = projectsMemory.get(userId) || getStudioProjects(userId);
      const mergedMap = new Map<string, StudioProject>();

      for (const cp of cloudProjects) {
        mergedMap.set(cp.id, cp);
      }

      for (const lp of cached) {
        const cp = mergedMap.get(lp.id);
        if (!cp) {
          mergedMap.set(lp.id, lp);
          void saveStudioProjectToFirestore(userId, lp);
        } else if (Date.parse(lp.updatedAt) > Date.parse(cp.updatedAt)) {
          const merged = hydrateProjectImages(lp, cp);
          mergedMap.set(lp.id, merged);
          void saveStudioProjectToFirestore(userId, merged);
        } else {
          mergedMap.set(lp.id, hydrateProjectImages(cp, lp));
        }
      }

      const merged = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      projectsMemory.set(userId, merged);

      for (const p of merged) {
        void idbSaveProject(p);
      }

      window.dispatchEvent(new Event(STUDIO_PROJECTS_EVENT));
      return merged;
    }
  } catch (err) {
    console.warn("Aviso ao buscar projetos do Studio no Firestore:", err);
  }
  return getStudioProjects(userId);
}

export function getStudioProjects(userId: string): StudioProject[] {
  if (!userId) return [];
  if (projectsMemory.has(userId)) {
    return projectsMemory.get(userId)!;
  }
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    const projects = Array.isArray(parsed)
      ? parsed.filter(isStudioProject).map(p => hydrateProjectImages(p)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [];
    projectsMemory.set(userId, projects);
    void syncFromIndexedDb(userId);
    if (userId !== "local") {
      void syncStudioProjectsFromCloud(userId);
    }
    return projects;
  } catch {
    void syncFromIndexedDb(userId);
    if (userId !== "local") {
      void syncStudioProjectsFromCloud(userId);
    }
    return [];
  }
}

export function saveStudioProject(userId: string, project: StudioProject): StudioProject {
  if (!userId) throw new Error("Entre na sua conta para salvar o rascunho.");
  const saved: StudioProject = { ...project, title: project.title.trim() || "Projeto sem título", updatedAt: new Date().toISOString() };

  // 1. Atualizar cache em memória imediatamente (0ms)
  const current = projectsMemory.get(userId) || getStudioProjects(userId);
  const updatedList = [saved, ...current.filter((item) => item.id !== saved.id)];
  projectsMemory.set(userId, updatedList);

  // 2. Persistir no IndexedDB (sem limite de 5MB)
  void idbSaveProject(saved);

  // 3. Persistir no Firebase Firestore na nuvem
  if (userId !== "local") {
    void saveStudioProjectToFirestore(userId, saved);
  }

  // 4. Persistir no localStorage com fallback resiliente para cota excedida
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(updatedList));
  } catch (quotaErr) {
    console.warn("Cota do localStorage atingida. Projeto completo preservado em IndexedDB/memória. Compactando localStorage:", quotaErr);
    try {
      const compactList = updatedList.slice(0, 5).map(item => {
        if (item.id === saved.id) return item;
        return {
          ...item,
          referenceImages: [],
          slides: item.slides.map(s => ({
            ...s,
            image: s.image?.url?.startsWith("data:") ? { ...s.image, url: undefined } : s.image,
          })),
        };
      });
      localStorage.setItem(storageKey(userId), JSON.stringify(compactList));
    } catch {
      try {
        const slidePreserved = updatedList.slice(0, 5).map(item => {
          if (item.id === saved.id) {
            return { ...item, referenceImages: [] };
          }
          return {
            ...item,
            referenceImages: [],
            slides: item.slides.map(s => ({
              ...s,
              image: s.image?.url?.startsWith("data:") ? { ...s.image, url: undefined } : s.image,
            })),
          };
        });
        localStorage.setItem(storageKey(userId), JSON.stringify(slidePreserved));
      } catch {
        // Projeto continua 100% íntegro em memória, IndexedDB e Firestore
      }
    }
  }

  window.dispatchEvent(new Event(STUDIO_PROJECTS_EVENT));
  return saved;
}

export function deleteStudioProject(userId: string, projectId: string): void {
  if (!userId || !projectId) return;
  const current = projectsMemory.get(userId) || getStudioProjects(userId);
  const remaining = current.filter((item) => item.id !== projectId);
  projectsMemory.set(userId, remaining);
  void idbDeleteProject(projectId);
  if (userId !== "local") {
    void deleteStudioProjectFromFirestore(projectId);
  }
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(remaining));
  } catch (err) {
    console.warn("Erro ao atualizar localStorage após exclusão:", err);
  }
  window.dispatchEvent(new Event(STUDIO_PROJECTS_EVENT));
}

export function studioProjectMarkdown(project: StudioProject): string {
  const lines = [
    `# ${project.title || "Projeto sem título"}`,
    "", "Criado no MIND CANVAS", "",
    `**Matéria:** ${project.subject || "Não informada"}`,
    `**Etapa:** ${project.gradeLevel || "Não informada"}`,
    "", "## Objetivo de aprendizagem", "", project.objective || "A definir.",
  ];
  if (project.sourceContent.trim()) lines.push("", "## Conteúdo de referência", "", project.sourceContent);
  if (project.kind !== "roteiro") {
    lines.push("", "## Slides Canvas");
    project.slides.forEach((slide, index) => {
      lines.push("", `### Slide ${index + 1} — ${slide.title || "Sem título"}`, "", slide.content || "Conteúdo a definir.", "", "**Notas de apresentação**", "", slide.notes || "A definir.");
    });
  }
  if (project.kind !== "slides") {
    lines.push("", "## Roteiro de gravação");
    project.scenes.forEach((scene, index) => {
      lines.push("", `### Cena ${index + 1} — ${scene.title || "Sem título"}`, "", `**Tempo estimado:** ${scene.duration || "A definir"}`, "", "**Fala**", "", scene.speech || "A definir.", "", "**Visual e direção**", "", scene.visual || "A definir.");
    });
  }
  if (project.kind === "pacote") lines.push("", "## Game Canvas", "", "O planejamento do jogo é criado separadamente no editor Game Canvas.");
  return `${lines.join("\n")}\n`;
}
