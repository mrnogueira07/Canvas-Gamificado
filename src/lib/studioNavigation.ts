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
