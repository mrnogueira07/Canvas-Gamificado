import type { StudioSlide } from "./studioProjects";

export const studioCategories = [
  { id: "introducao", label: "Introdução", types: ["capa", "objetivo_bncc", "gancho"] },
  { id: "desenvolvimento", label: "Desenvolvimento", types: ["conteudo", "interacao", "formula"] },
  { id: "sintese", label: "Síntese", types: ["resumo"] },
  { id: "atividade", label: "Exercício e resolução", types: ["exercicio", "gabarito"] },
  { id: "encerramento", label: "Encerramento", types: ["encerramento"] },
];
const order = studioCategories.flatMap(category => category.types);
export const slideTypeLabels: Record<string, string> = {
  capa: "Capa", objetivo_bncc: "Objetivo e habilidades", gancho: "Gancho e contexto", conteudo: "Desenvolvimento", interacao: "Desenvolvimento",
  formula: "Fórmula", resumo: "Resumo", exercicio: "Exercício", gabarito: "Gabarito", encerramento: "Encerramento",
};
export function orderedStudioSlides(slides: StudioSlide[]): StudioSlide[] {
  return [...slides].sort((left, right) => {
    const rank = (slide: StudioSlide) => order.indexOf(slide.type || "conteudo");
    return rank(left) - rank(right);
  });
}

export function getCategoryForSlideType(type?: string): typeof studioCategories[number] {
  const normType = type || "conteudo";
  return studioCategories.find(cat => cat.types.includes(normType)) || studioCategories[1];
}

function defaultStudioSlideId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "slide_" + Math.random().toString(36).slice(2, 11);
}

export function createSlideForCategory(
  categoryIdOrType?: string,
  selectedSlide?: StudioSlide,
  customId?: string
): StudioSlide {
  const targetCategory = studioCategories.find(c => c.id === categoryIdOrType)
    || (categoryIdOrType ? studioCategories.find(c => c.types.includes(categoryIdOrType)) : undefined)
    || (selectedSlide ? getCategoryForSlideType(selectedSlide.type) : studioCategories[1]);

  let type: string;
  if (categoryIdOrType && !studioCategories.some(c => c.id === categoryIdOrType)) {
    type = categoryIdOrType;
  } else {
    switch (targetCategory.id) {
      case "introducao":
        type = "gancho";
        break;
      case "desenvolvimento":
        type = selectedSlide?.type === "formula" ? "formula" : "conteudo";
        break;
      case "sintese":
        type = "resumo";
        break;
      case "atividade":
        type = selectedSlide?.type === "gabarito" ? "gabarito" : "exercicio";
        break;
      case "encerramento":
        type = "encerramento";
        break;
      default:
        type = "conteudo";
    }
  }

  const base: StudioSlide = {
    id: customId || defaultStudioSlideId(),
    type,
    title: "",
    content: "",
    notes: "",
    duration: type === "encerramento" ? 20 : type === "gabarito" ? 30 : 45,
    layout: type === "exercicio" ? "exercicio" : type === "gabarito" ? "gabarito" : type === "formula" ? "formula" : "so_texto",
  };

  if (type === "exercicio") {
    base.exerciseQuestion = "";
    base.alternatives = [
      { label: "A", text: "", correct: false },
      { label: "B", text: "", correct: false },
      { label: "C", text: "", correct: false },
      { label: "D", text: "", correct: false },
    ];
  }

  if (type === "gabarito") {
    base.justification = "";
  }

  return base;
}

export function insertSlideIntoList(
  currentSlides: StudioSlide[],
  newSlide: StudioSlide,
  selectedSlideId?: string
): StudioSlide[] {
  const ordered = orderedStudioSlides(currentSlides);
  const targetCat = getCategoryForSlideType(newSlide.type);
  const selIndex = selectedSlideId ? ordered.findIndex(s => s.id === selectedSlideId) : -1;
  const selSlide = selIndex >= 0 ? ordered[selIndex] : undefined;
  const selCat = selSlide ? getCategoryForSlideType(selSlide.type) : undefined;

  const next = [...ordered];

  if (selSlide && selCat?.id === targetCat.id) {
    next.splice(selIndex + 1, 0, newSlide);
  } else {
    const catSlides = ordered.filter(s => targetCat.types.includes(s.type || "conteudo"));
    if (catSlides.length > 0) {
      const lastCatSlide = catSlides[catSlides.length - 1];
      const lastIdx = next.findIndex(s => s.id === lastCatSlide.id);
      next.splice(lastIdx + 1, 0, newSlide);
    } else {
      const targetRank = order.indexOf(newSlide.type || "conteudo");
      const insertIdx = next.findIndex(s => order.indexOf(s.type || "conteudo") > targetRank);
      if (insertIdx >= 0) {
        next.splice(insertIdx, 0, newSlide);
      } else {
        next.push(newSlide);
      }
    }
  }

  return orderedStudioSlides(next);
}

export function isMasterUser(name?: string | null, email?: string | null): boolean {
  const n = (name || "").toLowerCase().trim();
  const e = (email || "").toLowerCase().trim();
  return (
    n.includes("matheus") ||
    e.includes("matheus") ||
    e === "matheusnog95@gmail.com" ||
    e === "matheus.nogueira@innyx.com"
  );
}
