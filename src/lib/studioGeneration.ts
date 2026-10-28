import { createStudioId } from "./studioProjects";
import type { StudioKind, StudioScene, StudioSlide } from "./studioProjects";
import { slideTypes } from "./studioGuidelines";
import { formatBnccCodes } from "./studioBriefing";

export const slideLayouts = ["so_texto", "imagem_esquerda_texto_direita", "topicos_com_barras", "caixas_contorno", "formula_com_espaco", "capa", "objetivo_habilidades", "topicos_com_imagem", "topicos", "comparacao", "processo", "linha_do_tempo", "mapa_resumo", "formula", "exercicio", "gabarito", "encerramento"];
const stages = ["introducao", "desenvolvimento", "conclusao", "exercicio", "gabarito", "fixo", "encerramento"];

export function parseGeneratedContent(text: string, kind: StudioKind): { slides: StudioSlide[]; scenes: StudioScene[]; alerts?: string[] } {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) cleaned = jsonMatch[1].trim();
  else {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }

  const data: unknown = JSON.parse(cleaned);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Formato de resposta inválido.");
  const result = data as Record<string, unknown>;
  const alerts = Array.isArray(result.alertas) ? result.alertas.filter((item): item is string => typeof item === "string" && item.length <= 4000) : [];
  const capaMeta = (result.capa && typeof result.capa === "object" && !Array.isArray(result.capa)) ? (result.capa as Record<string, unknown>) : undefined;

  const requireText = (item: Record<string, unknown>, key: string): string => {
    if (typeof item[key] !== "string" || item[key].length > 20000) throw new Error(`Campo inválido na geração: ${key}.`);
    return item[key];
  };
  // The model may explicitly return null for fields that do not apply to a slide.
  const optionalText = (item: Record<string, unknown>, key: string) => item[key] === undefined || item[key] === null ? undefined : requireText(item, key);
  const rows = (key: string): Record<string, unknown>[] => {
    const value = result[key];
    if (!Array.isArray(value) || value.length < 1 || value.length > 30 || value.some(item => !item || typeof item !== "object" || Array.isArray(item))) throw new Error("A IA retornou uma estrutura incompleta.");
    return value;
  };

  const stageDefaultMap: Record<string, string> = {
    capa: "introducao",
    objetivo_bncc: "introducao",
    gancho: "desenvolvimento",
    conteudo: "desenvolvimento",
    interacao: "desenvolvimento",
    formula: "desenvolvimento",
    resumo: "conclusao",
    exercicio: "exercicio",
    gabarito: "gabarito",
    encerramento: "encerramento"
  };

  let normalizedSchemaFields = false;
  const slides = kind === "roteiro" ? [] : rows("slides").map((item, index) => {
    // Accept existing generated drafts while the model transitions to the canonical schema.
    const canonical = item.tipo !== undefined;
    const typeRaw = item.tipo !== undefined ? item.tipo : item.type;
    let type = typeof typeRaw === "string" ? typeRaw : "";
    const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const normalizedType = normalize(type);
    const typeAliases: Record<string, string> = {
      objetivo: "objetivo_bncc", objetivo_habilidades: "objetivo_bncc", objetivo_aprendizagem: "objetivo_bncc", bncc: "objetivo_bncc",
      gancho_contexto: "gancho", contexto: "gancho", pergunta_provocadora: "gancho", abertura: index === 0 ? "capa" : "gancho",
      introducao: item.numero === 1 || index === 0 ? "capa" : "gancho", capa_aula: "capa",
      conteudo_principal: "conteudo", desenvolvimento: "conteudo", conceito: "conteudo", explicacao: "conteudo", texto: "conteudo", topicos: "conteudo",
      interativo: "interacao", pergunta_interativa: "interacao", atividade_interativa: "interacao",
      equacao: "formula", formula_matematica: "formula",
      mapa_resumo: "resumo", linha_do_tempo: "resumo", sintese: "resumo", conclusao: "resumo",
      atividade: "exercicio", questao: "exercicio", quiz: "exercicio", pratica: "exercicio",
      resposta: "gabarito", resolucao: "gabarito", gabarito_comentado: "gabarito",
      final: "encerramento", fechamento: "encerramento", finalizacao: "encerramento",
    };
    if (!slideTypes.includes(type)) type = typeAliases[normalizedType] || "";
    if (!slideTypes.includes(type)) {
      const clues = normalize(`${String(item.titulo ?? item.title ?? item.tema ?? "")} ${String(item.etapa ?? "")} ${String(typeRaw ?? "")}`);
      if (/capa|abertura/.test(clues) && index === 0) type = "capa";
      else if (/objetivo|habilidade|bncc/.test(clues)) type = "objetivo_bncc";
      else if (/gabarito|resposta|resolucao/.test(clues)) type = "gabarito";
      else if (/exercicio|questao|atividade|quiz/.test(clues)) type = "exercicio";
      else if (/encerramento|fechamento|finalizacao/.test(clues)) type = "encerramento";
      else if (/resumo|sintese|linha_do_tempo|mapa/.test(clues)) type = "resumo";
      else if (/gancho|contexto|introducao|pergunta_provocadora/.test(clues)) type = index === 0 ? "capa" : "gancho";
      else if (/formula|equacao/.test(clues)) type = "formula";
      else if (/desenvolvimento|conteudo|conceito|explicacao/.test(clues)) type = "conteudo";
      else type = index === 0 ? "capa" : "conteudo";
      normalizedSchemaFields = true;
    } else if (normalizedType !== type) normalizedSchemaFields = true;

    let durationRaw = canonical ? (item.tempo_seg ?? item.duration ?? item.tempo) : (item.duration ?? item.tempo_seg ?? item.tempo);
    if ((canonical && item.tempo_seg === null) || (!canonical && item.duration === null)) {
      throw new Error("Campo inválido na geração: tempo_seg.");
    }
    if (typeof durationRaw === "string") {
      const parsed = parseInt(durationRaw.replace(/\D/g, ""), 10);
      if (!Number.isNaN(parsed)) durationRaw = parsed;
    }
    if (durationRaw === undefined || durationRaw === null) {
      durationRaw = type === "capa" ? 20 : (type === "encerramento" ? 15 : 45);
    }
    if (typeof durationRaw !== "number" || !Number.isFinite(durationRaw) || durationRaw < 0 || durationRaw > 720) durationRaw = 45;
    const duration: number = typeof durationRaw === "number" ? durationRaw : 45;

    // Some responses use a single string instead of a list, or null on fixed slides.
    // Normalize those equivalent representations without dropping any content.
    // Both the canonical and legacy response formats are returned by some model
    // versions. Accept string or string-list content in either format and keep the
    // first populated alias instead of rejecting `content: [...]` as an invalid field.
    const contentValues = [
      item.texto,
      item.topicos,
      item.conteudo,
      item.bullets,
      item.pontos,
      item.descricao,
      item.content,
      item.text
    ];
    const asContentText = (value: unknown): string | undefined => {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && value.every(line => typeof line === "string")) return value.join("\n");
      return undefined;
    };
    const contentCandidates = contentValues.map(asContentText);
    const content = contentCandidates.find(value => value?.trim()) ?? contentCandidates.find(value => value !== undefined) ?? "";
    const isExemptFromContent = [
      "capa",
      "encerramento",
      "objetivo_bncc",
      "exercicio",
      "gabarito",
      "formula"
    ].includes(type) ||
    Boolean(
      item.exerciseQuestion ||
      item.questao ||
      item.justificativa ||
      item.formula ||
      item.colunas ||
      item.marcos ||
      item.alternativas
    );

    if (contentCandidates.every(value => value === undefined) && !isExemptFromContent) {
      throw new Error(`Texto inválido no slide ${item.numero || ""} (${type}). A IA deve retornar texto ou uma lista de frases.`);
    }
    if (contentValues.some(value => value !== undefined && value !== null) && contentCandidates.every(value => value === undefined)) {
      throw new Error(`Campo inválido na geração: ${canonical ? "texto" : "content"}.`);
    }
    if (content.length > 20000) throw new Error("O texto de um slide excedeu o limite de 20.000 caracteres.");

    // Title resolution with aliases and fixed-slide fallbacks
    const isFixedSlide = ["capa", "encerramento", "objetivo_bncc"].includes(type);
    let title: string;
    const candidateTitle = item.titulo !== undefined ? item.titulo : (item.title !== undefined ? item.title : (item.tema !== undefined ? item.tema : item.nome));
    if (candidateTitle === null && !isFixedSlide) {
      throw new Error("Campo inválido na geração: titulo.");
    }
    if (candidateTitle !== undefined && candidateTitle !== null && typeof candidateTitle !== "string") {
      throw new Error("Campo inválido na geração: titulo.");
    }
    if (typeof candidateTitle === "string" && candidateTitle.trim().length > 0) {
      if (candidateTitle.length > 20000) throw new Error("Campo inválido na geração: titulo.");
      title = candidateTitle.trim();
    } else if (isFixedSlide) {
      if (type === "capa") {
        const fallback = (typeof item.tema === "string" && item.tema.trim()) ||
          (capaMeta && typeof capaMeta.tema === "string" && capaMeta.tema.trim()) ||
          (capaMeta && typeof capaMeta.titulo === "string" && capaMeta.titulo.trim()) ||
          (typeof result.tema === "string" && result.tema.trim()) ||
          (typeof result.title === "string" && result.title.trim()) ||
          "Capa";
        title = fallback;
      } else if (type === "objetivo_bncc") {
        title = "Objetivo e BNCC";
      } else {
        title = "Encerramento";
      }
    } else {
      title = typeof candidateTitle === "string" && candidateTitle.trim() ? candidateTitle.trim() : (type === "exercicio" ? "Exercício" : (type === "gabarito" ? "Gabarito Comentado" : `Slide ${index + 1}`));
    }

    // Notes resolution
    let notes: string;
    const candidateNotes = item.nota_apresentador !== undefined ? item.nota_apresentador : (item.notes !== undefined ? item.notes : (item.nota !== undefined ? item.nota : (item.notas !== undefined ? item.notas : (item.roteiro !== undefined ? item.roteiro : item.fala))));
    if (candidateNotes === null && type !== "encerramento") {
      throw new Error("Campo inválido na geração: nota_apresentador.");
    }
    if (typeof candidateNotes === "string") {
      if (candidateNotes.length > 20000) throw new Error("Campo inválido na geração: nota_apresentador.");
      notes = candidateNotes;
    } else if (Array.isArray(candidateNotes)) {
      notes = candidateNotes.filter(v => typeof v === "string").join(" ");
    } else if (type === "encerramento" && (candidateNotes === undefined || candidateNotes === null)) {
      notes = "";
    } else if (candidateNotes !== undefined && candidateNotes !== null) {
      throw new Error("Campo inválido na geração: nota_apresentador.");
    } else {
      notes = typeof item.titulo === "string" ? `Apresentação sobre ${item.titulo}.` : "Explicação dos tópicos deste slide.";
    }

    const slide: StudioSlide = {
      id: createStudioId(),
      type,
      duration: Math.round(duration),
      title,
      content,
      notes
    };

    if (!canonical) return slide;

    // Stage resolution
    let stage: string;
    if (typeof item.etapa === "string" && stages.includes(item.etapa)) {
      stage = item.etapa;
    } else if (item.etapa === undefined || item.etapa === null) {
      stage = stageDefaultMap[type] || "desenvolvimento";
    } else {
      const candidate = normalize(String(item.etapa));
      const stageAliases: Record<string, string> = { introducao: "introducao", abertura: "introducao", desenvolvimento: "desenvolvimento", conteudo: "desenvolvimento", sintese: "conclusao", conclusao: "conclusao", fechamento: "encerramento", atividade: "exercicio", questoes: "exercicio", resposta: "gabarito", fixo: "fixo", encerramento: "encerramento" };
      stage = stageAliases[candidate] || stageDefaultMap[type] || "desenvolvimento";
      normalizedSchemaFields = true;
    }

    // Layout resolution
    let layout: string;
    if (typeof item.layout === "string") {
      const candidateLayout = normalize(item.layout);
      const layoutAliases: Record<string, string> = { texto: "so_texto", somente_texto: "so_texto", conteudo: "so_texto", objetivo: "objetivo_habilidades", objetivo_bncc: "objetivo_habilidades", linha_tempo: "linha_do_tempo", timeline: "linha_do_tempo", comparativo: "comparacao", quiz: "exercicio", resposta: "gabarito", final: "encerramento", mapa: "mapa_resumo" };
      layout = slideLayouts.includes(item.layout) ? item.layout : layoutAliases[candidateLayout] || (type === "formula" ? "formula_com_espaco" : "so_texto");
      if (layout !== item.layout) normalizedSchemaFields = true;
    } else if (item.layout === undefined || item.layout === null) {
      if (type === "formula") layout = "formula_com_espaco";
      else layout = "so_texto";
    } else {
      layout = requireText(item, "layout");
      if (!slideLayouts.includes(layout)) { layout = type === "formula" ? "formula_com_espaco" : "so_texto"; normalizedSchemaFields = true; }
    }

    slide.stage = stage;
    slide.layout = layout;
    slide.formula = optionalText(item, "formula");
    slide.objective = optionalText(item, "objetivo");
    const rawSkills = Array.isArray(item.habilidades) ? item.habilidades : [];
    slide.skills = rawSkills.flatMap(skill => {
      if (typeof skill === "string") return [skill];
      if (skill && typeof skill === "object" && !Array.isArray(skill)) {
        const record = skill as Record<string, unknown>;
        const code = typeof record.codigo === "string" ? record.codigo : "";
        const text = typeof record.texto === "string" ? record.texto : "";
        return [`${code}${text ? ` — ${text}` : ""}${record.origem === "sugerida_ia" ? " (sugerida pela IA; validar)" : ""}`.trim()];
      }
      return [];
    });
    const legacyCurriculum = optionalText(item, "habilidade");
    slide.curriculum = formatBnccCodes(legacyCurriculum || slide.skills.map(skill => skill.split(" — ")[0].replace(/ \(sugerida pela IA; validar\)$/, "")).join(", "));
    slide.sourcePages = Array.isArray(item.fonte_pag) ? item.fonte_pag.filter(page => typeof page === "string" || typeof page === "number").map(String).join(", ") : typeof item.fonte_pag === "string" ? item.fonte_pag : undefined;
    slide.highlight = optionalText(item, "destaque");
    slide.exerciseQuestion = optionalText(item, "exerciseQuestion") || optionalText(item, "questao");
    slide.justification = optionalText(item, "justificativa");
    if (Array.isArray(item.alternativas)) {
      slide.alternatives = item.alternativas.flatMap((alternative, index) => {
        if (!alternative || typeof alternative !== "object" || Array.isArray(alternative)) return [];
        const row = alternative as Record<string, unknown>;
        if (typeof row.texto !== "string" && typeof row.text !== "string") return [];
        return [{ label: String(row.letra ?? row.label ?? String.fromCharCode(65 + index)), text: String(row.texto ?? row.text), correct: row.correta === true || row.correct === true }];
      });
    }
    if (slide.type === "exercicio" && slide.exerciseQuestion) {
      slide.content = [slide.exerciseQuestion, ...(slide.alternatives || []).map(option => `${option.label}) ${option.text}`)].join("\n");
    }
    if (slide.type === "gabarito" && (slide.alternatives?.length || slide.justification)) {
      const correct = slide.alternatives?.find(option => option.correct);
      slide.content = [correct ? `Resposta: ${correct.label}) ${correct.text}` : "Resposta comentada", slide.justification].filter(Boolean).join("\n");
    }
    if (slide.type === "objetivo_bncc" && !slide.content) {
      slide.content = [slide.objective, ...(slide.skills || [])].filter(Boolean).join("\n");
    }
    if (slide.type === "formula" && !slide.content && slide.formula) {
      slide.content = slide.formula;
    }
    if (Array.isArray(item.colunas)) {
      slide.columns = item.colunas.flatMap(column => {
        if (!column || typeof column !== "object" || Array.isArray(column)) return [];
        const row = column as Record<string, unknown>;
        const items = Array.isArray(row.itens) ? row.itens.filter((entry): entry is string => typeof entry === "string") : [];
        return [{ title: String(row.titulo ?? row.title ?? ""), items }];
      });
    }
    if (Array.isArray(item.marcos)) {
      slide.timelineItems = item.marcos.flatMap(milestone => {
        if (!milestone || typeof milestone !== "object" || Array.isArray(milestone)) return [];
        const row = milestone as Record<string, unknown>;
        return [{ label: String(row.rotulo ?? row.label ?? ""), text: typeof row.texto === "string" ? row.texto : undefined }];
      });
    }
    if (!slide.content) {
      if (slide.columns?.length) {
        slide.content = slide.columns.map(c => `${c.title ? `${c.title}:\n` : ""}${c.items.map(i => `• ${i}`).join("\n")}`).join("\n\n");
      } else if (slide.timelineItems?.length) {
        slide.content = slide.timelineItems.map(m => `• ${m.label}${m.text ? `: ${m.text}` : ""}`).join("\n");
      }
    }
    if (!slide.content.trim() && !isFixedSlide) {
      slide.content = slide.highlight || (slide.notes ? slide.notes.replace(/\[\d+:\d+[–-]\d+:\d+\]\s*/g, "").slice(0, 180) : "") || slide.title || "Tópicos da aula em desenvolvimento";
    }

    if (item.pendencias !== undefined && item.pendencias !== null) {
      if (!Array.isArray(item.pendencias) || item.pendencias.length > 30 || item.pendencias.some(v => typeof v !== "string" || v.length > 4000)) throw new Error("Pendências inválidas.");
      slide.pending = item.pendencias;
    }

    if (item.imagem !== undefined && item.imagem !== null) {
      if (typeof item.imagem !== "object" || Array.isArray(item.imagem)) throw new Error("Imagem inválida.");
      const image = item.imagem as Record<string, unknown>;
      const referenceId = typeof image.id === "string" ? image.id : typeof image.referenceId === "string" ? image.referenceId : undefined;
      const candidateDesc = image.descricao ?? image.description ?? image.prompt ?? image.legenda;
      if ((typeof candidateDesc === "string" && candidateDesc.trim()) || referenceId) {
        const description = typeof candidateDesc === "string" && candidateDesc.trim() ? candidateDesc.trim() : "Imagem do material enviado";
        slide.image = {
          description,
          source: (typeof image.fonte === "string" ? image.fonte : (typeof image.source === "string" ? image.source : undefined)) || "[VALIDAR FONTE]",
          status: (typeof image.status === "string" ? image.status : undefined) || "[BUSCAR IMAGEM]",
          referenceId,
          page: typeof image.pagina === "string" ? image.pagina : typeof image.pagina === "number" ? String(image.pagina) : undefined,
          caption: typeof image.legenda === "string" ? image.legenda : undefined,
        };
      }
    }

    return slide;
  });

  // Garante que nenhum slide de exercício exceda 4 alternativas ao ser gerado:
  // Se houver 5 ou mais alternativas, divide automaticamente em um slide principal (A a D)
  // e um slide de continuação (E em diante), preservando a fonte 2.08cqw sem sobreposição!
  const finalSlides: StudioSlide[] = [];
  for (const slide of slides) {
    if (slide.type === "exercicio" && slide.alternatives && slide.alternatives.length > 4) {
      const kept = slide.alternatives.slice(0, 4);
      const excess = slide.alternatives.slice(4);
      const slide1: StudioSlide = {
        ...slide,
        alternatives: kept,
        content: [slide.exerciseQuestion || "", ...kept.map(o => `${o.label}) ${o.text}`)].filter(Boolean).join("\n"),
      };
      const continuationTitle = slide.title.includes("Continuação")
        ? slide.title
        : `${slide.title || "Exercício"} (Continuação)`;
      const slide2: StudioSlide = {
        ...slide,
        id: createStudioId(),
        title: continuationTitle,
        alternatives: excess,
        content: [slide.exerciseQuestion || "", ...excess.map(o => `${o.label}) ${o.text}`)].filter(Boolean).join("\n"),
        notes: slide.notes ? `[Continuação do Exercício] ${slide.notes}` : "Apresente as alternativas complementares aos alunos e conduza para a resolução.",
      };
      finalSlides.push(slide1, slide2);
    } else {
      finalSlides.push(slide);
    }
  }

  const scenes = kind === "slides" ? [] : rows("scenes").map(item => ({
    id: createStudioId(),
    title: typeof item.title === "string" ? item.title : (typeof item.titulo === "string" ? item.titulo : requireText(item, "title")),
    duration: typeof item.duration === "string" ? item.duration : (typeof item.tempo === "string" ? item.tempo : requireText(item, "duration")),
    speech: typeof item.speech === "string" ? item.speech : (typeof item.fala === "string" ? item.fala : requireText(item, "speech")),
    visual: typeof item.visual === "string" ? item.visual : requireText(item, "visual")
  }));

  if (normalizedSchemaFields) alerts.push("Alguns tipos ou layouts foram ajustados para manter a apresentação compatível com o editor. Revise os slides antes de exportar.");
  return { slides: finalSlides, scenes, alerts: alerts.length ? alerts : undefined };
}
