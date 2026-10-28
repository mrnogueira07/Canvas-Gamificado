/**
 * Seção 5 — Lógica do Jogo.
 *
 * Este arquivo é o "roteador central" de todos os tipos de jogo.
 * Responsabilidades:
 *  1. Renderizar o componente correto de `games/` para cada `gameType`.
 *  2. Centralizar a lógica de adição de novos itens (via IA ou template).
 *  3. Aplicar limites de itens por tipo de jogo.
 *
 * ─── FLUXO DE ADIÇÃO (handleAddTarget) ──────────────────────────────────────
 *  Cada jogo tem seu próprio bloco de lógica claramente separado:
 *
 *  [A] Jogo da Memória        → IA gera 1 par de carta (frente + verso)
 *  [B] Jogo de Tiro ao Alvo  → IA gera 1 pergunta + expande em 3 alvos
 *  [C] Jogo de Plataforma 2D → IA gera 1 questão de múltipla escolha
 *  [D] Esmaga Palavras        → Template estático de palavra + definição
 *  [E] Demais jogos de M.E.  → IA gera 1 questão padrão (Roleta, Quiz, etc.)
 */

import React, { useState } from "react";
import { XCircle, Zap } from "lucide-react";
import type { GeneratedContent } from "../../../types";
import { model } from "../../../lib/gemini";
import { SchemaType } from "@google/generative-ai";
import { toStr } from "../shared/utils";

import { Field } from "../shared/Field";

import { PlataformaGame } from "../games/PlataformaGame";
import { TiroAlvoGame } from "../games/TiroAlvoGame";
import { MemoriaGame } from "../games/MemoriaGame";
import { QuebraCabecaGame } from "../games/QuebraCabecaGame";
import { EsmagaPalavrasGame } from "../games/EsmagaPalavrasGame";
import { HouseQuizTargets } from "../shared/HouseQuizTargets";

// ─── Limites máximos de itens por tipo de jogo ──────────────────────────────
// Tiro ao Alvo: 5 perguntas × 3 alvos = 15 itens no array
// Esmaga Palavras: até 30 palavras independentes
// Os demais refletem a UX ideal para cada mecânica
const LIMITS: Record<string, number> = {
  Roleta: 4,
  "Jogo de Tiro ao Alvo": 15,    // 5 questões × 3 alvos cada
  "Jogo de Plataforma 2D": 10,
  "Esmaga Palavras": 10,
  "Sliding Puzzle": 10,
  Quiz: 10,
  Memoria: 8,
  Tabuleiro: 10,
  "Quebra-Cabeca": 10,
};
const DEFAULT_LIMIT = 15;

/** Conta quantas perguntas válidas (com alternativas) existem no targets */
const countTabuleiroQuestions = (targets: any[]) => {
  return targets.filter(t => {
    const tTitle = (t.title || "").toUpperCase();
    const tIsTip = (
      tTitle === "DICA" ||
      tTitle === "INFORMACAO" ||
      tTitle === "CONCEITO" ||
      tTitle === "INFORMATIVO" ||
      tTitle === "CURIOSIDADE" ||
      !t.options ||
      t.options.length === 0
    ) && t.isCorrect !== false;
    return t.isCorrect !== false && !tIsTip;
  }).length;
};

/** Retorna true se o tipo de jogo atingiu o limite máximo de itens */
const hasReachedLimit = (gameType: string, length: number) => {
  const limit = LIMITS[gameType];
  if (limit !== undefined) return length >= limit;
  return length >= DEFAULT_LIMIT;
};

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface GameLogicSectionProps {
  gameLogic: GeneratedContent["gameLogic"];
  gameType: string;
  targetAudience?: string;
  subject: string;
  theme: string;
  pdfBase64?: string | null;
  pdfFileName?: string | null;
  pdfTextContent?: string | null;
  onEdit: (field: string, value: any) => void;
  onAdd: (path: string, item: any) => void;
  onRemove: (path: string, index: number) => void;
  onIsGenerating?: (isGenerating: boolean) => void;
}

// ─── Helpers de prompt de contexto ──────────────────────────────────────────

/** Retorna o bloco de instrução de PDF para incluir no prompt da IA */
const buildPdfContext = (
  pdfBase64: string | null,
  pdfTextContent: string | null,
  pdfFileName?: string | null
): string => {
  const isPdf = pdfFileName ? pdfFileName.toLowerCase().endsWith(".pdf") : true;
  if (pdfBase64 && isPdf)
    return "IMPORTANTE: Use as informações do PDF anexado para contextualizar a pergunta. A resposta deve ser baseada nos conceitos reais do PDF.";
  if (pdfTextContent)
    return `IMPORTANTE: Use as seguintes informações extraídas do documento de referência para contextualizar a pergunta. A resposta deve ser baseada nos conceitos reais deste texto:\n\n${pdfTextContent}`;
  return "A pergunta deve ser elaborada e muito contextualizada no tema.";
};

/** Normaliza um array de opções garantindo exatamente 3 itens */
const normalizeOptions = (options: string[]): string[] => {
  const fallbacks = ["Alternativa A", "Alternativa B", "Alternativa C"];
  const list = [...options];
  while (list.length < 3) list.push(fallbacks[list.length] || `Alternativa ${list.length + 1}`);
  return list.slice(0, 3);
};

// ─── Componente Principal ────────────────────────────────────────────────────

export const GameLogicSection: React.FC<GameLogicSectionProps> = ({
  gameLogic,
  gameType,
  targetAudience = "",
  subject,
  theme,
  pdfBase64 = null,
  pdfFileName: _pdfFileName = null,
  pdfTextContent = null,
  onEdit,
  onAdd,
  onRemove,
  onIsGenerating,
}) => {
  const isFundamental1 = targetAudience.toLowerCase().includes("fundamental 1");
  const isFundamental2 = targetAudience.toLowerCase().includes("fundamental 2");
  const isEnsinoMedio = targetAudience.toLowerCase().includes("médio") || targetAudience.toLowerCase().includes("medio");

  const isPdf = _pdfFileName?.toLowerCase().endsWith(".pdf") || false;

  const getPromptParts = (promptText: string) => {
    const parts: any[] = [{ text: promptText }];
    if (pdfTextContent) {
      parts.push({ text: `\n\nTexto do material de apoio:\n${pdfTextContent}` });
    } else if (pdfBase64 && isPdf) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
    }
    return parts;
  };

  let fundamentalRule = "";
  if (isFundamental1) {
    fundamentalRule = "\nIMPORTANTE: Como o público-alvo é do Ensino Fundamental 1 (crianças de anos iniciais), as perguntas, enunciados das questões, as alternativas de opções de resposta, as respostas e as descrições/feedbacks DEVEM ser extremamente curtas, simples, diretas e de fácil compreensão. Mantenha enunciados com no máximo 6 a 8 palavras e alternativas/opções/respostas com no máximo 2 a 3 palavras. Seja super direto.";
  } else if (isFundamental2) {
    fundamentalRule = "\nIMPORTANTE: Como o público-alvo é do Ensino Fundamental 2 (anos finais), as perguntas e enunciados devem ser mais elaboradas, completas e contextualizadas pedagogicamente (com aproximadamente 10 a 15 palavras por enunciado), utilizando um vocabulário adequado para pré-adolescentes.";
  } else if (isEnsinoMedio) {
    fundamentalRule = "\nIMPORTANTE: Como o público-alvo é do Ensino Médio, todas as perguntas/enunciados, alternativas e descrições/feedbacks devem ser bem elaboradas, utilizando uma linguagem formal, culta, precisa e analítica (no estilo de questões de pré-vestibular ou ENEM). Os enunciados devem conter contextualizações ricas e completas sobre os conceitos pedagógicos, exigindo leitura analítica e interpretação.";
  }

  const {
    howToPlay,
    targets = [],
    questionPool = [],
    thematicHints = [],
  } = gameLogic;

  const [addingQuestion, setAddingQuestion] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCO [A] — JOGO DA MEMÓRIA
  // Gera 1 par de carta (frente = conceito / verso = descrição de imagem).
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddMemoria = async () => {
    setAddingQuestion(true);
    onIsGenerating?.(true);

    const existingConcepts = targets.map((t) => t.title).filter(Boolean).join(", ");
    const noRepeatRule = existingConcepts
      ? `\nIMPORTANTE: Os seguintes conceitos já existem e NÃO PODEM ser repetidos: ${existingConcepts}. Crie um conceito TOTALMENTE NOVO.`
      : "";

    const prompt = `Você é um especialista em gamificação educacional.
Gere EXATAMENTE 1 par de carta para um jogo da memória sobre "${subject}" com o tema "${theme || subject}".
${buildPdfContext(pdfBase64, pdfTextContent, _pdfFileName)}${noRepeatRule}${fundamentalRule}
A frente da carta (título) deve conter um conceito, termo ou palavra-chave bem curto extraído do conteúdo/PDF. Máximo de 3 palavras.
O verso da carta deve conter uma descrição visual muito simples e resumida da imagem sugerida para este conceito. Comece obrigatoriamente com "Imagem de". Máximo de 8 palavras.
IMPORTANTE: NÃO inclua prefixos como "a)", "b)", "c)" ou numerações em nenhum campo.`;

    try {
      const parts = getPromptParts(prompt);

      const res = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              titulo: { type: SchemaType.STRING },
              verso: { type: SchemaType.STRING }
            },
            required: ["titulo", "verso"]
          }
        },
      });
      
      const data = JSON.parse(res.response.text().replace(/```json|```/g, "").trim());

      const finalTitle = toStr(data.titulo || data.title || data.concept || `Conceito ${targets.length + 1}`).trim();
      const finalVerso = toStr(data.verso || data.back || data.description || `Imagem de ${theme || subject}`).trim();

      onAdd("targets", {
        title: finalTitle,
        question: finalTitle,
        description: finalVerso,
        feedback: finalVerso,
        answer: finalVerso,
        isCorrect: true,
        points: 10,
      });
    } catch (err) {
      console.error("[Memória] Erro ao gerar carta via IA:", err);
      onAdd("targets", {
        title: `Conceito ${targets.length + 1}`,
        question: `Conceito ${targets.length + 1}`,
        description: `Imagem de ${theme || subject}`,
        feedback: `Imagem de ${theme || subject}`,
        answer: `Imagem de ${theme || subject}`,
        isCorrect: true,
        points: 10,
      });
    } finally {
      setAddingQuestion(false);
      onIsGenerating?.(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCO [B] — JOGO DE TIRO AO ALVO
  // Gera 1 pergunta de múltipla escolha e expande em 3 alvos:
  // 1 alvo correto (isCorrect: true) + 2 alvos distratores (isCorrect: false).
  // Limite: 5 questões × 3 alvos = 15 itens no array.
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddTiroAlvo = async () => {
    setAddingQuestion(true);
    onIsGenerating?.(true);

    const questionNumber = Math.floor(targets.length / 3) + 1;
    const existingQuestions = targets
      .filter((t) => t.isCorrect) // só conta as perguntas (corretas são únicas por grupo)
      .map((t) => t.question || t.title)
      .filter(Boolean)
      .join("\n- ");
    const noRepeatRule = existingQuestions
      ? `\nIMPORTANTE: As seguintes questões JÁ EXISTEM. Crie algo TOTALMENTE NOVO:\n- ${existingQuestions}\n`
      : "";

    const prompt = `Você é um especialista em gamificação educacional.
Gere EXATAMENTE 1 pergunta de múltipla escolha super curta, direta e básica (máximo 1 frase) sobre "${subject}" com o tema "${theme || subject}".
${buildPdfContext(pdfBase64, pdfTextContent, _pdfFileName)}${noRepeatRule}${fundamentalRule}
O enunciado deve ser muito curto e direto, sem contextualizações longas ou situações-problema.
Gere EXATAMENTE 3 alternativas curtas e diretas no array "options" (1 correta e 2 distratores).
O campo "answer" deve conter o TEXTO EXATO da alternativa correta.
PROIBIDO: opções genéricas como "Opção A", "Alternativa B", letras soltas, objetos JSON.

Retorne EXATAMENTE ESSE FORMATO JSON:
{
  "question": "Enunciado curto e direto",
  "options": ["Resposta correta", "Primeiro distrator", "Segundo distrator"],
  "answer": "Resposta correta"
}`;

    try {
      const parts = getPromptParts(prompt);

      const res = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const data = JSON.parse(res.response.text().replace(/```json|```/g, "").trim());

      const oList = normalizeOptions((data.options || []).map(toStr));
      const finalQuestion = toStr(data.question || `Pergunta ${questionNumber} sobre ${theme || subject}`);
      const finalAnswer = toStr(data.answer && oList.includes(toStr(data.answer)) ? data.answer : oList[0]);
      const wrongOptions = oList.filter((o) => o !== finalAnswer);

      // Expande a pergunta em 3 alvos (1 correto + 2 distratores)
      [
        { title: finalAnswer, isCorrect: true, points: 20, description: "Excelente! Esta resposta está correta." },
        { title: wrongOptions[0] || "Alternativa Incorreta 1", isCorrect: false, points: -10, description: "Esta opção está incorreta conforme o conteúdo." },
        { title: wrongOptions[1] || "Alternativa Incorreta 2", isCorrect: false, points: -10, description: "Desafio extra! Esta opção também está incorreta." },
      ].forEach((alvo) =>
        onAdd("targets", { ...alvo, question: finalQuestion, feedback: "" })
      );
    } catch (err) {
      console.error("[Tiro ao Alvo] Erro ao gerar questão via IA:", err);
      // Fallback: usa questionPool se disponível
      const pool = questionPool.length > 0
        ? questionPool[Math.floor(Math.random() * questionPool.length)]
        : null;
      const oList = normalizeOptions(pool?.options || []);
      const finalQuestion = pool?.question || `Pergunta ${questionNumber} sobre ${theme || subject}`;
      const finalAnswer = pool?.answer || oList[0];
      const wrongOptions = oList.filter((o) => o !== finalAnswer);

      [
        { title: finalAnswer, isCorrect: true, points: 20, description: "Excelente! Esta resposta está correta." },
        { title: wrongOptions[0] || "Incorreta 1", isCorrect: false, points: -10, description: "Esta opção está incorreta conforme o conteúdo." },
        { title: wrongOptions[1] || "Incorreta 2", isCorrect: false, points: -10, description: "Desafio extra! Esta opção também está incorreta." },
      ].forEach((alvo) =>
        onAdd("targets", { ...alvo, question: finalQuestion, feedback: "" })
      );
    } finally {
      setAddingQuestion(false);
      onIsGenerating?.(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCO [C] — JOGO DE PLATAFORMA 2D
  // Gera 1 questão de múltipla escolha completa (enunciado + 3 opções + answer).
  // Cada questão é um checkpoint/fase que o personagem precisa responder.
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddPlataforma = async () => {
    setAddingQuestion(true);
    onIsGenerating?.(true);

    const questionNumber = targets.length + 1;
    const existingQuestions = targets.map((t) => t.question || t.title).filter(Boolean).join("\n- ");
    const noRepeatRule = existingQuestions
      ? `\nIMPORTANTE: As seguintes questões JÁ EXISTEM. Crie algo TOTALMENTE NOVO:\n- ${existingQuestions}\n`
      : "";

    const prompt = `Você é um especialista em gamificação educacional.
Gere EXATAMENTE 1 questão de múltipla escolha super curta, direta e básica (máximo 1 frase) para um Jogo de Plataforma 2D sobre "${subject}" com o tema "${theme || subject}".
${buildPdfContext(pdfBase64, pdfTextContent, _pdfFileName)}${noRepeatRule}${fundamentalRule}
O enunciado deve ser muito curto e direto, sem contextualizações extensas.
Gere EXATAMENTE 3 alternativas bem curtas e diretas no array "options".
O campo "answer" deve conter o TEXTO EXATO copiado de dentro de "options".
PROIBIDO: "Opção A", "Alternativa B", strings vazias, objetos JSON.

Retorne EXATAMENTE ESSE FORMATO JSON:
{
  "question": "Enunciado curto e direto",
  "options": ["Texto curto correto", "Texto curto distrator 1", "Texto curto distrator 2"],
  "answer": "Texto curto correto"
}`;

    try {
      const parts = getPromptParts(prompt);

      const res = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const data = JSON.parse(res.response.text().replace(/```json|```/g, "").trim());

      const oList = normalizeOptions((data.options || []).map(toStr));
      const finalQuestion = toStr(data.question || `Pergunta ${questionNumber} sobre ${theme || subject}`);
      const finalAnswer = toStr(data.answer && oList.includes(toStr(data.answer)) ? data.answer : oList[0]);

      onAdd("targets", {
        question: finalQuestion,
        options: oList,
        answer: finalAnswer,
        isCorrect: true,
        points: 20,
      });
    } catch (err) {
      console.error("[Plataforma 2D] Erro ao gerar questão via IA:", err);
      // Fallback: usa questionPool se disponível
      const pool = questionPool.length > 0
        ? questionPool[Math.floor(Math.random() * questionPool.length)]
        : null;
      const oList = normalizeOptions(pool?.options || []);
      onAdd("targets", {
        question: pool?.question || `Pergunta ${questionNumber} sobre ${theme || subject}`,
        options: oList,
        answer: pool?.answer || oList[0],
        isCorrect: true,
        points: 20,
      });
    } finally {
      setAddingQuestion(false);
      onIsGenerating?.(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCO [D] — ESMAGA PALAVRAS
  // Cria um item estático com título (palavra) e definição (description).
  // Não usa IA: o professor preenche manualmente o conteúdo.
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddEsmagaPalavras = async () => {
    setAddingQuestion(true);
    onIsGenerating?.(true);

    const existingWords = targets.map((t) => t.title).filter(Boolean).join(", ");
    const noRepeatRule = existingWords
      ? `\nIMPORTANTE: As seguintes palavras já existem no jogo e NÃO podem ser repetidas: ${existingWords}. Crie um termo TOTALMENTE NOVO.`
      : "";

    const prompt = `Você é um especialista em gamificação educacional.
Gere EXATAMENTE 1 palavra oculta (um termo curto de uma única palavra de no máximo 12 letras) e sua respectiva definição técnica simplificada para um caça-palavras sobre a matéria "${subject}" com o tema "${theme || subject}".
${buildPdfContext(pdfBase64, pdfTextContent, _pdfFileName)}${noRepeatRule}${fundamentalRule}
A palavra gerada deve ser curta, direta, sem espaços e ideal para ser oculta em um grid de caça-palavras.
A descrição/definição pedagógica deve ser clara, curta e explicativa (máximo 1 ou 2 frases curtas).
IMPORTANTE: Não inclua numerações, pontuações ou prefixos em nenhum campo.

Retorne EXATAMENTE ESSE FORMATO JSON:
{
  "word": "PALAVRANOVA",
  "description": "Definição pedagógica simplificada sobre esta palavra."
}`;

    try {
      const parts = getPromptParts(prompt);

      const res = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const data = JSON.parse(res.response.text().replace(/```json|```/g, "").trim());

      const finalWord = toStr(data.word || "PALAVRA").replace(/\s/g, "").toUpperCase();
      const finalDesc = toStr(data.description || "Definição sobre a palavra.");

      onAdd("targets", {
        title: finalWord,
        question: finalWord,
        description: finalDesc,
        options: [],
        answer: finalWord,
        isCorrect: true,
        points: 15,
        feedback: finalDesc,
      });
    } catch (err) {
      console.error("[Esmaga Palavras] Erro ao gerar palavra via IA:", err);
      // Fallback
      const pool = questionPool.length > 0
        ? questionPool[Math.floor(Math.random() * questionPool.length)]
        : null;
      const finalWord = pool ? toStr(pool.question).replace(/\s/g, "").toUpperCase() : `PALAVRA${targets.length + 1}`;
      const finalDesc = pool ? toStr(pool.answer) : `Definição da palavra ${finalWord}.`;

      onAdd("targets", {
        title: finalWord,
        question: finalWord,
        description: finalDesc,
        options: [],
        answer: finalWord,
        isCorrect: true,
        points: 15,
        feedback: finalDesc,
      });
    } finally {
      setAddingQuestion(false);
      onIsGenerating?.(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCO [Sliding Puzzle] — GERAÇÃO DINÂMICA DE QUESTÕES E PENALIDADES
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddSlidingPuzzleQuestion = async () => {
    if (targets.length >= 10) return;
    setAddingQuestion(true);
    onIsGenerating?.(true);

    const questionNumber = targets.length + 1;
    const existingQuestions = targets.map((t) => t.question || t.title).filter(Boolean).join("\n- ");
    const noRepeatRule = existingQuestions
      ? `\nIMPORTANTE: As seguintes questões JÁ EXISTEM. Crie algo TOTALMENTE NOVO:\n- ${existingQuestions}\n`
      : "";

    const prompt = `Você é um especialista em gamificação educacional.
Gere EXATAMENTE 1 pergunta de múltipla escolha super curta, direta e básica (máximo 1 frase) sobre a matéria "${subject}" com o tema "${theme || subject}".
${buildPdfContext(pdfBase64, pdfTextContent, _pdfFileName)}${noRepeatRule}${fundamentalRule}
O enunciado deve ser muito curto e direto, sem de fato contextualizações longas.
Gere EXATAMENTE 3 alternativas curtas e diretas no array "options" (1 correta e 2 distratores).
O campo "answer" deve conter o TEXTO EXATO da alternativa correta.
A pergunta deve ter "isCorrect": true.

Retorne EXATAMENTE ESSE FORMATO JSON:
{
  "question": "Enunciado curto e direto",
  "options": ["Resposta correta curta", "Primeiro distrator curto", "Segundo distrator curto"],
  "answer": "Resposta correta curta"
}`;

    try {
      const parts = getPromptParts(prompt);

      const res = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const data = JSON.parse(res.response.text().replace(/```json|```/g, "").trim());

      const oList = normalizeOptions((data.options || []).map(toStr));
      const finalQuestion = toStr(data.question || `Pergunta sobre ${theme || subject}`);
      const finalAnswer = toStr(data.answer && oList.includes(toStr(data.answer)) ? data.answer : oList[0]);

      onAdd("targets", {
        title: `Pergunta ${questionNumber}: ${finalQuestion.split(/[.?]/)[0]}?`,
        question: finalQuestion,
        options: oList,
        answer: finalAnswer,
        isCorrect: true,
        points: 15,
        feedback: "",
        description: "Excelente! Resposta correta.",
      });
    } catch (err) {
      console.error("[Sliding Puzzle] Erro ao gerar questão via IA:", err);
      onAdd("targets", {
        title: `Pergunta ${questionNumber}: Sobre ${theme || subject}`,
        question: `Pergunta ${questionNumber} sobre ${theme || subject}`,
        options: ["Correta", "Incorreta 1", "Incorreta 2"],
        answer: "Correta",
        isCorrect: true,
        points: 15,
        feedback: "",
        description: "Resposta correta.",
      });
    } finally {
      setAddingQuestion(false);
      onIsGenerating?.(false);
    }
  };

  const handleAddSlidingPuzzlePenalty = async () => {
    const penaltyCount = targets.filter(t => t.isCorrect === false).length;
    if (targets.length >= 10 || penaltyCount >= 5) return;

    setAddingQuestion(true);
    onIsGenerating?.(true);

    const prompt = `Você é um especialista em gamificação educacional.
Gere EXATAMENTE 1 enunciado curto de penalidade ou obstáculo de jogo (máximo 1 frase curta) sobre a matéria "${subject}" com o tema "${theme || subject}".
${buildPdfContext(pdfBase64, pdfTextContent, _pdfFileName)}
A penalidade deve narrar um revés ou obstáculo contextualizado com o tema que faça o jogador perder pontos ou movimentos (exemplo: "Você se perdeu na floresta de carbono! Perdeu 2 movimentos.").
Não inclua numerações. A penalidade deve ter "isCorrect": false.

Retorne EXATAMENTE ESSE FORMATO JSON:
{
  "penalty": "Descrição curta do obstáculo ou revés sofrido"
}`;

    try {
      const parts = getPromptParts(prompt);

      const res = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const data = JSON.parse(res.response.text().replace(/```json|```/g, "").trim());

      const finalPenalty = toStr(data.penalty || "Obstáculo no caminho! Perdeu pontos.");

      onAdd("targets", {
        title: "Penalidade",
        question: finalPenalty,
        options: [],
        answer: "",
        isCorrect: false,
        points: -10,
        feedback: "",
        description: "Penalidade aplicada.",
      });
    } catch (err) {
      console.error("[Sliding Puzzle] Erro ao gerar penalidade via IA:", err);
      onAdd("targets", {
        title: "Penalidade",
        question: `Obstáculo sobre ${theme || subject}! Perdeu movimentos.`,
        options: [],
        answer: "",
        isCorrect: false,
        points: -10,
        feedback: "",
        description: "Penalidade aplicada.",
      });
    } finally {
      setAddingQuestion(false);
      onIsGenerating?.(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCO [E] — DEMAIS JOGOS DE MÚLTIPLA ESCOLHA
  // Cobre: Roleta, Tabuleiro, Quiz, Arrastar e Soltar, Jogo da Velha, etc.
  // IA gera 1 questão padrão (enunciado + 3 alternativas + resposta).
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddMultipleChoice = async () => {
    setAddingQuestion(true);
    onIsGenerating?.(true);

    const questionNumber = targets.length + 1;
    const existingQuestions = targets.map((t) => t.question || t.title).filter(Boolean).join("\n- ");
    const noRepeatRule = existingQuestions
      ? `\nIMPORTANTE: As seguintes questões JÁ EXISTEM. Crie algo TOTALMENTE NOVO:\n- ${existingQuestions}\n`
      : "";

    const prompt = `Você é um especialista em gamificação educacional.
Gere EXATAMENTE 1 pergunta de múltipla escolha super curta, direta e básica (máximo 1 frase) sobre "${subject}" com o tema "${theme || subject}".
${buildPdfContext(pdfBase64, pdfTextContent, _pdfFileName)}${noRepeatRule}${fundamentalRule}
O enunciado deve ser muito curto e direto, sem contextualizações longas ou rodeios.
Gere EXATAMENTE 3 alternativas curtas e diretas no array "options" (1 correta e 2 distratores plausíveis).
O campo "answer" deve conter o TEXTO EXATO da alternativa correta.
PROIBIDO: opções genéricas como "Opção A", "Alternativa B", letras soltas.

Retorne EXATAMENTE ESSE FORMATO JSON:
{
  "question": "Enunciado curto e direto",
  "options": ["Resposta correta curta", "Primeiro distrator curto", "Segundo distrator curto"],
  "answer": "Resposta correta curta"
}`;

    try {
      const parts = getPromptParts(prompt);

      const res = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const data = JSON.parse(res.response.text().replace(/```json|```/g, "").trim());

      const oList = normalizeOptions((data.options || []).map(toStr));
      const finalQuestion = toStr(data.question || `Pergunta sobre ${theme || subject}`);
      const finalAnswer = toStr(data.answer && oList.includes(toStr(data.answer)) ? data.answer : oList[0]);

      onAdd("targets", {
        title: `Pergunta ${questionNumber}: ${finalQuestion.split(/[.?]/)[0]}?`,
        question: finalQuestion,
        options: oList,
        answer: finalAnswer,
        isCorrect: true,
        points: 15,
        feedback: "",
        description: "Clique para editar o feedback explicativo.",
      });
    } catch (err) {
      console.error(`[${gameType}] Erro ao gerar questão via IA:`, err);
      // Fallback: usa questionPool se disponível
      const pool = questionPool.length > 0
        ? questionPool[Math.floor(Math.random() * questionPool.length)]
        : null;
      const oList = normalizeOptions(pool?.options || []);

      onAdd("targets", {
        title: `Pergunta ${questionNumber}: Sobre ${theme || subject}`,
        question: pool?.question || `Pergunta ${questionNumber} sobre ${theme || subject}`,
        options: oList,
        answer: pool?.answer || oList[0],
        isCorrect: true,
        points: 15,
        feedback: "",
        description: "",
      });
    } finally {
      setAddingQuestion(false);
      onIsGenerating?.(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPATCHER — Decide qual bloco executar com base no gameType
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAddTarget = async () => {
    if (hasReachedLimit(gameType, targets.length)) return;
    if (gameType === "Tabuleiro" && countTabuleiroQuestions(targets) >= 5) return;

    switch (gameType) {
      // [A] Memória
      case "Memoria":
        await handleAddMemoria();
        break;

      // [B] Tiro ao Alvo
      case "Jogo de Tiro ao Alvo":
        await handleAddTiroAlvo();
        break;

      // [C] Plataforma 2D
      case "Jogo de Plataforma 2D":
        await handleAddPlataforma();
        break;

      // [D] Esmaga Palavras (com IA)
      case "Esmaga Palavras":
        await handleAddEsmagaPalavras();
        break;

      // [E] Demais jogos de múltipla escolha
      case "Roleta":
      case "Tabuleiro":
      case "Quiz":
      case "Arrastar e Soltar":
      case "Jogo da Velha":
      default:
        await handleAddMultipleChoice();
        break;
    }
  };

  // ─── Label do botão "Adicionar" ──────────────────────────────────────────
  const getAddButtonLabel = (): string | null => {
    if (addingQuestion) return null; // exibido como spinner pelo render

    if (gameType === "Tabuleiro") {
      const qCount = countTabuleiroQuestions(targets);
      if (qCount >= 5) return "Limite de Questões Atingido (5)";
      if (targets.length >= 10) return "Limite de Casas Atingido (10)";
      return "+ Adicionar Questão";
    }

    const labels: Record<string, string> = {
      Roleta: targets.length >= 4 ? "Limite Máximo (4)" : "+ Adicionar Questão",
      "Esmaga Palavras": targets.length >= 10 ? "Limite de Palavras Atingido" : "+ Adicionar Palavra",
      "Jogo de Tiro ao Alvo": targets.length >= 15 ? "Limite de Perguntas Atingido (5)" : "+ Adicionar Questão",
      "Jogo de Plataforma 2D": targets.length >= 10 ? "Limite de Questões Atingido" : "+ Adicionar Pergunta",
      Quiz: targets.length >= 10 ? "Limite de Questões Atingido (10)" : "+ Adicionar Pergunta",
      Memoria: targets.length >= 8 ? "Limite de Cartas Atingido (8)" : "+ Adicionar Carta",
      "Quebra-Cabeca": targets.length >= 10 ? "Limite de Questões Atingido (10)" : "+ Adicionar Questão",
    };
    return labels[gameType] || "+ Adicionar Questão";
  };

  const isAddDisabled =
    addingQuestion ||
    hasReachedLimit(gameType, targets.length) ||
    (gameType === "Tabuleiro" && countTabuleiroQuestions(targets) >= 5);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Cabeçalho com badge do tipo de jogo e botão de adicionar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-orange-50 rounded-xl shrink-0">
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-slate-800 font-black uppercase tracking-widest text-[12.1px] whitespace-nowrap">
                Lógica do Jogo
              </h3>
            </div>
            <span className="px-3 py-1 bg-violet-50 text-violet-500 rounded-full text-[9.9px] font-black uppercase tracking-widest border border-violet-100 shadow-sm animate-in fade-in slide-in-from-left-2 duration-500 whitespace-nowrap">
              {gameType}
            </span>

          </div>
        </div>

        {/* Botão "Adicionar" — label e comportamento variam por tipo de jogo */}
        {gameType === "Sliding Puzzle" ? (
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            {/* Botão Adicionar Questão */}
            <button
              onClick={handleAddSlidingPuzzleQuestion}
              disabled={addingQuestion || targets.length >= 10}
              title={
                addingQuestion
                  ? "Aguarde, gerando questão..."
                  : "Adicionar pergunta"
              }
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg active:scale-95 select-none whitespace-nowrap flex-1 sm:flex-none ${addingQuestion
                  ? "bg-violet-400 text-white cursor-wait shadow-violet-300/30 animate-pulse"
                  : targets.length >= 10
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    : "bg-violet-500 text-white hover:bg-violet-600 shadow-violet-500/20 cursor-pointer"
                }`}
            >
              {addingQuestion ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Gerando Questão…
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  {targets.length >= 10 ? "Limite Atingido (10)" : "+ Adicionar Questão"}
                </>
              )}
            </button>

            {/* Botão Adicionar Penalidade */}
            <button
              onClick={handleAddSlidingPuzzlePenalty}
              disabled={addingQuestion || targets.length >= 10 || targets.filter(t => t.isCorrect === false).length >= 5}
              title={
                addingQuestion
                  ? "Aguarde, gerando penalidade..."
                  : "Adicionar penalidade"
              }
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg active:scale-95 select-none whitespace-nowrap flex-1 sm:flex-none ${addingQuestion
                  ? "bg-slate-400 text-white cursor-wait shadow-slate-300/30 animate-pulse"
                  : (targets.length >= 10 || targets.filter(t => t.isCorrect === false).length >= 5)
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    : "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20 cursor-pointer"
                }`}
            >
              {addingQuestion ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Gerando Penalidade…
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  {targets.filter(t => t.isCorrect === false).length >= 5
                    ? "Limite Penalidades (5)"
                    : targets.length >= 10
                      ? "Limite Atingido (10)"
                      : "+ Adicionar Penalidade"}
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleAddTarget}
            disabled={isAddDisabled}
            title={
              addingQuestion
                ? "Aguarde, gerando questão..."
                : gameType === "Memoria"
                  ? "Adicionar carta"
                  : "Adicionar pergunta"
            }
            className={`print:hidden flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-lg active:scale-95 select-none ${addingQuestion
                ? "bg-violet-400 text-white cursor-wait shadow-violet-300/30 animate-pulse"
                : hasReachedLimit(gameType, targets.length)
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-violet-500 text-white hover:bg-violet-600 shadow-violet-500/20 cursor-pointer"
              }`}
          >
            {addingQuestion ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Gerando Questão…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-white" />
                {getAddButtonLabel()}
              </>
            )}
          </button>
        )}
      </div>

      <div className="p-8 md:p-10 space-y-10">
        <Field
          label="COMO JOGAR"
          value={howToPlay}
          onChange={(val: string) => onEdit("howToPlay", val)}
        />

        {/* ── ROTEADOR DE RENDERIZAÇÃO ──────────────────────────────────────
           Cada gameType renderiza seu próprio componente especializado de games/.
           A ordem das condições reflete a prioridade de correspondência. */}

        {/* [A] Memória — cartas frente/verso */}
        {gameType === "Memoria" && (
          <MemoriaGame targets={targets} onEdit={onEdit} onRemove={onRemove} />
        )}

        {/* [B] Tiro ao Alvo — grupos de pergunta + 3 alvos */}
        {gameType === "Jogo de Tiro ao Alvo" && (
          <TiroAlvoGame
            targets={targets}
            gameType={gameType}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        )}

        {/* [C] Plataforma 2D — questões com múltipla escolha + dicas temáticas */}
        {gameType === "Jogo de Plataforma 2D" && (
          <PlataformaGame
            targets={targets}
            hints={thematicHints}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        )}

        {/* [D] Quebra-Cabeça — desafios narrativos com montagem de imagem */}
        {(gameType || "").toLowerCase().includes("quebra") && (
          <QuebraCabecaGame
            targets={targets}
            gameLogic={gameLogic}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        )}

        {/* [E] Esmaga Palavras — lista de palavras + definição */}
        {gameType === "Esmaga Palavras" && (
          <EsmagaPalavrasGame
            targets={targets}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        )}

        {/* [F] Demais tipos: Roleta, Tabuleiro, Quiz, Arrastar e Soltar,
               Jogo da Velha — compartilham o layout padrão de "casas de pergunta" */}
        {![
          "Memoria",
          "Jogo de Tiro ao Alvo",
          "Jogo de Plataforma 2D",
          "Esmaga Palavras",
        ].includes(gameType) &&
          !(gameType || "").toLowerCase().includes("quebra") && (
            <HouseQuizTargets
              targets={targets}
              gameType={gameType}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          )}
      </div>
    </div>
  );
};
