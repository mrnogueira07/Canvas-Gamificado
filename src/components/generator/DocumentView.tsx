/**
 * ============================================================================
 * DocumentView.tsx
 * ============================================================================
 *
 * Componente principal de visualização e edição do Canvas de Gamificação.
 *
 * RESPONSABILIDADES:
 *  - Renderizar todas as seções do Canvas (Currículo, Estilo, Fluxo, etc.)
 *  - Permitir edição inline de todos os campos via prop `onEdit`
 *  - Renderizar o preview interativo específico por tipo de jogo
 *    (Roleta, Jogo da Velha, Sliding Puzzle, Arrastar e Soltar)
 *  - Gerenciar a adição de novas casas customizáveis da Roleta via IA
 *
 * FLUXO DE DADOS:
 *  GeneratorPage → DocumentView → Seções/GamePreviews
 *  Alterações sobem via callbacks: onEdit / onAdd / onRemove
 *
 * ESTRUTURA DO ARQUIVO:
 *  1. Imports
 *  2. Boundary de erro (DocumentViewErrorBoundary)
 *  3. Helpers de texto/segurança (toStr, extractTextFromJsonLikeString, etc.)
 *  4. Componente auxiliar BibliographyField
 *  5. Tipos/Interface principal (DocumentViewProps)
 *  6. Componente principal DocumentView
 *     6a. Helpers internos da Roleta (roletaUpdater, roletaOnAdd, roletaOnRemove)
 *     6b. JSX das seções do Canvas
 * ============================================================================
 */

// ─── 1. IMPORTS ─────────────────────────────────────────────────────────────

import React, { useState, Component } from "react";
import type { GeneratedContent } from "../../types";

import {
  BookOpen,
  Gamepad2,
  ScrollText,
  Library,
  PencilLine,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import { GameLogicSection } from "./sections/GameLogicSection";
import { SectionCard } from "./shared/SectionCard";
import { Field } from "./shared/Field";
import { MechanicsSection } from "./sections/MechanicsSection";
import { ReferenceImagesSection } from "./sections/ReferenceImagesSection";

// Previews específicos por tipo de jogo
import { RoletaPreview } from "./games/RoletaGame";
import { JogoDaVelhaPreview } from "./games/JogoDaVelhaGame";
import { SlidingPuzzlePreview } from "./games/SlidingPuzzleGame";


// ─── 2. ERROR BOUNDARY ───────────────────────────────────────────────────────
/**
 * Captura erros de renderização em qualquer filho do DocumentView
 * e exibe uma tela amigável de recuperação no lugar da tela branca.
 *
 * Exportado para ser usado pelo GeneratorPage ao envolver o DocumentView.
 */
class DocumentViewErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Erro desconhecido",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[DocumentView] Erro de renderização:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 p-12">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-violet-500" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-black text-slate-800 mb-2">
              Erro ao renderizar o canvas
            </h3>
            <p className="text-sm text-slate-500 mb-1">
              Ocorreu um erro inesperado ao exibir o conteúdo gerado.
            </p>
            <p className="text-xs font-mono text-rose-400 bg-slate-50 px-3 py-1.5 rounded-lg mt-2">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="flex items-center gap-2 px-6 py-3 bg-violet-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-violet-600 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { DocumentViewErrorBoundary };


// ─── 3. HELPERS DE SEGURANÇA E CONVERSÃO DE TEXTO ───────────────────────────
/**
 * Tenta extrair um valor textual legível de uma string que pareça um JSON.
 * Útil para casos em que a IA retorna um objeto serializado onde se esperava
 * apenas um string, evitando o erro #31 do React ("Objects are not valid as
 * a React child").
 *
 * Prioridade de extração:
 *  1. Chaves conhecidas: text, texto, option, value, valor, resposta
 *  2. Qualquer valor em aspas que não seja uma chave conhecida
 */
const extractTextFromJsonLikeString = (str: string): string => {
  const cleanStr = str.trim();
  if (!cleanStr.startsWith("{") || !cleanStr.endsWith("}")) return "";

  // Tenta chaves semânticas prioritárias primeiro
  const keyRegex =
    /(?:"(?:text|texto|option|opcao|value|valor|resposta)"|'(?:text|texto|option|opcao|value|valor|resposta)')\s*:\s*(?:"([^"]*)"|'([^']*)')/i;
  const match = cleanStr.match(keyRegex);
  if (match) return match[1] || match[2] || "";

  // Fallback: qualquer valor em aspas que não seja nome de chave
  const anyQuoteRegex = /(?:"([^"]*)"|'([^']*)')/g;
  const knownKeys = [
    "text","texto","option","opcao","value","valor","resposta",
    "iscorrect","points","feedback",
  ];
  let m;
  while ((m = anyQuoteRegex.exec(cleanStr)) !== null) {
    const val = m[1] || m[2];
    if (val && !knownKeys.includes(val.toLowerCase())) return val;
  }
  return "";
};

/**
 * Tenta extrair um valor textual de um objeto já parseado.
 * Percorre chaves semânticas e, como fallback, qualquer valor string/number.
 */
const unpackJsonText = (parsed: unknown): string => {
  if (!parsed || typeof parsed !== "object") return "";
  const values = parsed as Record<string, unknown>;
  const keysToCheck = ["text", "texto", "option", "opcao", "value", "valor", "resposta"];
  for (const key of keysToCheck) {
    if (key in values && values[key] != null) return String(values[key]);
  }
  for (const key of Object.keys(parsed)) {
    const value = values[key];
    if (typeof value === "string" && value.trim().length > 0)
      return value;
  }
  for (const key of Object.keys(parsed)) {
    if (typeof values[key] === "number" || typeof values[key] === "boolean")
      return String(values[key]);
  }
  return "";
};

/**
 * Converte qualquer valor desconhecido para string de forma segura.
 * Lida com: null/undefined, strings JSON, objetos aninhados, arrays, etc.
 *
 * @example
 *   toStr(null)           → ""
 *   toStr({ text: "ok" }) → "ok"
 *   toStr([1, 2])         → "1, 2"
 */
const toStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";

  if (typeof v === "string") {
    const trimmed = v.trim();

    // String JSON entre aspas duplas → tenta desempacotar
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return toStr(parsed);
      } catch { /* não era JSON válido, segue em frente */ }
    }

    // Objeto JSON serializado → tenta extrair valor textual
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
          const unpacked = unpackJsonText(parsed);
          if (unpacked) return toStr(unpacked);
        } else if (typeof parsed === "string") {
          return toStr(parsed);
        }
      } catch {
        // Não é JSON válido mas parece um objeto — tenta extrair por regex
        const extracted = extractTextFromJsonLikeString(trimmed);
        if (extracted) return toStr(extracted);
      }
    }

    return v;
  }

  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toStr).join(", ");

  if (typeof v === "object") {
    const unpacked = unpackJsonText(v);
    if (unpacked) return toStr(unpacked);
  }

  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
};


// ─── 4. COMPONENTE AUXILIAR: BibliographyField ───────────────────────────────
/**
 * Campo de texto para referências bibliográficas (normas ABNT).
 *
 * Comportamento:
 *  - Exibe cada referência separada por uma linha em branco
 *  - Ao perder o foco (onBlur), normaliza o texto removendo linhas em branco
 *    duplicadas e salva apenas se houve mudança
 *  - O `key={displayValue}` força reset do textarea quando o conteúdo
 *    externo muda (ex: ao recriar o canvas)
 */

interface BibliographyFieldProps {
  value?: string;
  onChange: (val: string) => void;
}

/** Remove linhas em branco consecutivas (mantém no máximo uma entre referências) */
const normalizeBibliography = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, i, arr) => {
      if (line === "" && i > 0 && arr[i - 1] === "") return false;
      return true;
    })
    .join("\n");

/** Garante linha em branco entre referências ao exibir */
const addBlankLinesBetweenRefs = (text: string): string => {
  const lines = text.split("\n");
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    if (
      lines[i].trim() !== "" &&
      i + 1 < lines.length &&
      lines[i + 1].trim() !== ""
    ) {
      result.push(""); // insere linha em branco entre referências
    }
  }
  return result.join("\n");
};

const BibliographyField: React.FC<BibliographyFieldProps> = ({
  value = "",
  onChange,
}) => {
  const safeValue = typeof value === "string" ? value : String(value ?? "");
  const displayValue = addBlankLinesBetweenRefs(safeValue);

  return (
    <div className="w-full group/biblio relative">
      {/* Label com ícone de edição ao passar o mouse */}
      <div className="flex items-center justify-between mb-2 ml-1">
        <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] group-focus-within/biblio:text-violet-500 transition-colors">
          Referência Bibliográfica
        </h4>
        <PencilLine className="w-3.5 h-3.5 text-violet-400 opacity-0 group-hover/biblio:opacity-100 transition-opacity" />
      </div>

      {/* Textarea com altura automática baseada no número de linhas */}
      <textarea
        defaultValue={displayValue}
        key={displayValue}
        rows={Math.max(4, displayValue.split("\n").length + 1)}
        onBlur={(e) => {
          const normalized = normalizeBibliography(e.target.value);
          if (normalized !== safeValue) onChange(normalized);
        }}
        className="print:hidden w-full text-sm font-medium leading-relaxed outline-none rounded-xl transition-all border border-slate-200 hover:border-violet-300/50 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500/50 focus:shadow-sm p-3.5 resize-none"
        placeholder="Adicione as referências bibliográficas. Cada referência em uma linha — o sistema adiciona automaticamente o espaço entre elas."
      />
      <div className="canvas-bibliography-print hidden print:block text-sm">{displayValue}</div>
    </div>
  );
};


// ─── 5. TIPOS / INTERFACE PRINCIPAL ─────────────────────────────────────────

interface DocumentViewProps {
  /** Conteúdo completo do canvas gerado pela IA */
  content: GeneratedContent;

  /** Título do projeto (exibido no header do canvas) */
  title: string;

  /**
   * Tipo de jogo (override opcional vindo da página pai).
   * Se não fornecido, usa content.gameStyle.genre.
   */
  gameType?: string;

  /**
   * Callback chamado ao editar qualquer campo do canvas.
   * @param section - Seção do GeneratedContent (ex: "gameLogic", "curriculumRelation")
   * @param field   - Campo da seção. Suporta dot-notation e bracket-notation
   *                  para campos aninhados (ex: "roletaSegments[0].title")
   * @param value   - Novo valor do campo
   */
  onEdit: (section: keyof GeneratedContent, field: string, value: unknown) => void;

  /**
   * Callback para adicionar novos itens em arrays aninhados.
   * @param section - Seção do GeneratedContent
   * @param path    - Caminho do array (ex: "targets")
   * @param item    - Objeto a ser inserido
   */
  onAdd: (section: keyof GeneratedContent, path: string, item: unknown) => void;

  /**
   * Callback para remover um item de um array aninhado.
   * @param section - Seção do GeneratedContent
   * @param path    - Caminho do array (ex: "targets")
   * @param index   - Índice do item a remover
   */
  onRemove: (
    section: keyof GeneratedContent,
    path: string,
    index: number,
  ) => void;

  /** PDF em base64 (se o professor enviou material de apoio) */
  pdfBase64?: string | null;

  /** Nome do arquivo PDF enviado */
  pdfFileName?: string | null;

  /** Texto extraído do PDF (fallback quando base64 não disponível) */
  pdfTextContent?: string | null;

  /** Callback para informar ao pai que uma geração está em andamento */
  onIsGenerating?: (isGenerating: boolean) => void;
}


// ─── 6. COMPONENTE PRINCIPAL: DocumentView ───────────────────────────────────
/**
 * Renderiza o canvas completo do jogo de forma editável.
 *
 * O canvas é composto por 7 seções numeradas + referências bibliográficas:
 *  Seção 1 - Relação com o Currículo
 *  Seção 2 - Estilo do Jogo
 *  Seção 3 - Fluxo do Jogo
 *  Seção 4 - Mecânicas e Tarefas
 *  Seção 5 - Conteúdo Programático + Lógica do Jogo + Preview Interativo
 *  Seção 6 - Imagens de Referência
 *  Seção 7 - Observações ao Desenvolvedor
 *  Rodapé  - Referências Bibliográficas (ABNT)
 */
export const DocumentView: React.FC<DocumentViewProps> = ({
  content,
  title: projectTitle,
  gameType: propGameType,
  onEdit,
  onAdd,
  onRemove,
  pdfBase64 = null,
  pdfFileName = null,
  pdfTextContent = null,
  onIsGenerating,
}) => {

  // ── Estado local: edição inline do título do canvas ──────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const startEditTitle = () => {
    setTitleDraft(projectTitle);
    setIsEditingTitle(true);
  };

  const confirmEditTitle = () => {
    // "_projectTitle" é um campo especial tratado pelo handleContentUpdate no GeneratorPage
    onEdit("curriculumRelation", "_projectTitle", titleDraft);
    setIsEditingTitle(false);
  };

  const cancelEditTitle = () => setIsEditingTitle(false);


  // ── 6a. HELPERS DA ROLETA ────────────────────────────────────────────────
  //
  // Esses helpers encapsulam a lógica de manipulação dos segmentos da Roleta
  // (roletaSegments) para manter o JSX principal limpo e legível.
  //
  // SEGMENTOS PADRÃO: usados como fallback quando o canvas ainda não tem
  // segmentos definidos (ex: canvas recém-gerado sem PDF para a Roleta).

  const ROLETA_DEFAULT_SEGMENTS = [
    { title: "Dica Pedagógica 1",  isCorrect: true,  points: 0,   description: "Conteúdo importante sobre o tema" },
    { title: "Emboscada Inimiga!", isCorrect: false, points: -10, description: "Opa, entrei na trincheira inimiga e fui pego! Preciso recuar." },
    { title: "Dica de Ouro",       isCorrect: true,  points: 10,  description: "Informação chave do tema" },
    { title: "Armadilha Oculta",   isCorrect: false, points: -15, description: "Pisei em uma armadilha temática! Volte duas casas e tente focar mais." },
  ];

  /** Limite máximo de casas customizáveis (dicas + penalidades) */
  const ROLETA_MAX_SEGMENTS = 6;

  /**
   * Atualiza um campo de um segmento existente pelo seu índice.
   * Suporta tanto atualização de campo único quanto patch de múltiplos campos.
   *
   * @param idx         - Índice do segmento a atualizar
   * @param fieldOrPatch - Nome do campo (string) OU objeto com vários campos
   * @param val         - Novo valor (usado apenas se fieldOrPatch for string)
   */
  const roletaUpdater = (
    idx: number,
    fieldOrPatch: string | Record<string, unknown>,
    val?: unknown,
  ) => {
    const current = content.gameLogic.roletaSegments || [];
    const segments = current.length > 0 ? [...current] : [...ROLETA_DEFAULT_SEGMENTS];

    if (typeof fieldOrPatch === "object") {
      segments[idx] = { ...segments[idx], ...fieldOrPatch };
    } else {
      segments[idx] = { ...segments[idx], [fieldOrPatch]: val };
    }

    onEdit("gameLogic", "roletaSegments", segments);
  };

  /**
   * Remove um segmento da Roleta pelo seu índice.
   * Não faz nada se a lista estiver vazia (evita erros de estado).
   */
  const roletaOnRemove = (idx: number) => {
    const current = [...(content.gameLogic.roletaSegments || [])];
    if (current.length === 0) return;
    current.splice(idx, 1);
    onEdit("gameLogic", "roletaSegments", current);
  };

  /**
   * Adiciona uma nova casa customizável à Roleta.
   *
   * Fluxo em duas etapas:
   *  1. IMEDIATA: Insere um item com texto genérico baseado no tema, para
   *     que o usuário veja feedback visual instantâneo sem aguardar a IA.
   *  2. BACKGROUND (IA): Envia o prompt para o Gemini e atualiza apenas
   *     o título e descrição do item recém-criado quando a resposta chegar.
   *     Usa `roletaSegments[index].campo` para não sobrescrever outras edições
   *     que o usuário possa ter feito enquanto aguardava.
   *
   * Restrições:
   *  - Só adiciona se houver menos de ROLETA_MAX_SEGMENTS segmentos.
   *  - O PDF (base64 ou texto) é enviado junto ao prompt para personalização.
   */
  const roletaOnAdd = (type: "Dica" | "Penalidade") => {
    const current: Array<Record<string, unknown>> =
      content.gameLogic.roletaSegments && content.gameLogic.roletaSegments.length > 0
        ? [...content.gameLogic.roletaSegments]
        : [...ROLETA_DEFAULT_SEGMENTS];

    // Bloqueia se já atingiu o limite máximo
    if (current.length >= ROLETA_MAX_SEGMENTS) return;

    const isDica = type === "Dica";
    const subject = content.curriculumRelation?.subject || "Geral";
    const targetAudience = content.gameStyle?.targetAudience || "Geral";

    // ── Etapa 1: Inserção imediata com conteúdo genérico ──────────────────
    const newItem = {
      title: isDica ? `Dica sobre ${subject}` : `Penalidade: Obstáculo Temático!`,
      description: isDica
        ? `Fique atento a este detalhe importante sobre "${subject}" para ter sucesso na jornada!`
        : `Você caiu em uma armadilha temática relacionada a "${subject}"! Perdeu a vez e alguns pontos!`,
      isCorrect: isDica,
      points: isDica ? 5 : -10,
    };

    const newIndex = current.length;
    onEdit("gameLogic", "roletaSegments", [...current, newItem]);

    // ── Etapa 2: Refinamento via IA em background ─────────────────────────
    const prompt = `Gere APENAS um JSON para uma casa de Roleta sobre o tema "${subject}" voltada para o público "${targetAudience}".
O tipo da casa é: ${type}.
Se for Dica: título curto + curiosidade pedagógica rápida e super resumida (máximo 1 frase curta).
Se for Penalidade: título curto + relato narrativo muito resumido e direto em 1ª pessoa de algo ruim ou desafiador que aconteceu estudando "${subject}" (máximo 1 frase curta).
Dica: Tente criar algo imersivo e relacionado ao assunto.

Retorne EXATAMENTE ESSE FORMATO JSON (sem markdown, sem explicações):
{ "title": "Título Curto", "description": "Texto resumido" }`;

    // Monta as partes da requisição (texto + PDF se disponível)
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];
    const isPdf = pdfFileName?.toLowerCase().endsWith(".pdf");
    if (pdfBase64 && isPdf) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
    } else if (pdfTextContent) {
      parts.push({ text: `\n\nTexto do material de apoio:\n${pdfTextContent}` });
    }

    import("../../lib/gemini").then(({ model }) => {
      model
        .generateContent({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json" },
        })
        .then((res) => {
          try {
            const data = JSON.parse(
              res.response.text().replace(/```json|```/g, "").trim()
            );
            // Atualiza apenas os campos deste segmento (não sobrescreve o array inteiro)
            if (data.title)       onEdit("gameLogic", `roletaSegments[${newIndex}].title`, data.title);
            if (data.description) onEdit("gameLogic", `roletaSegments[${newIndex}].description`, data.description);
          } catch (e) {
            console.warn("[Roleta] Falha ao processar resposta da IA para nova casa:", e);
          }
        })
        .catch((err) => {
          console.warn("[Roleta] Erro na chamada à IA para nova casa:", err);
        });
    });
  };

  /**
   * Renderiza o preview interativo específico para o tipo de jogo atual.
   * Retorna null para tipos de jogo que não possuem preview dedicado aqui.
   */
  const renderGamePreview = () => {
    const gt = String(propGameType || content.gameStyle?.genre || "");

    if (gt === "Roleta")
      return (
        <RoletaPreview
          roletaSegments={content.gameLogic.roletaSegments || []}
          questions={content.gameLogic.targets || []}
          onUpdate={roletaUpdater}
          onRemove={roletaOnRemove}
          onAdd={roletaOnAdd}
        />
      );

    if (gt === "Jogo da Velha")
      return <JogoDaVelhaPreview targets={content.gameLogic.targets} />;

    if (gt === "Sliding Puzzle")
      return <SlidingPuzzlePreview targets={content.gameLogic.targets} />;

    return null;
  };


  // ── 6b. RENDER PRINCIPAL ─────────────────────────────────────────────────
  return (
    <div
      className="w-full mx-auto max-w-5xl space-y-6 sm:space-y-8 p-3 sm:p-5 md:p-6 text-slate-800 transition-all duration-300"
      id="document-view"
    >

      {/* ══════════════════════════════════════════════════════════════════
          HEADER DO CANVAS
          Exibe o título do projeto (clicável para edição inline)
          e o subtítulo com disciplina + ano/bimestre.
      ══════════════════════════════════════════════════════════════════ */}
      <div className="relative group mb-6 overflow-hidden rounded-xl text-center canvas-document-header export-compact-header border border-slate-200/80 bg-white">
        {/* Barra superior de acento gradiente */}
        <div className="canvas-document-accent h-1 w-full" />
        
        <div className="relative z-10 py-6 sm:py-8 px-4 sm:px-8">

          {/* Badge do Tipo de Jogo */}
          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-violet-50 text-violet-700 border border-violet-200/70 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
              <Gamepad2 className="w-3.5 h-3.5" />
              {propGameType || content.gameStyle.genre || "Game Canvas"}
            </span>
          </div>

          {/* Modo edição de título */}
          {isEditingTitle ? (
            <div className="flex flex-col items-center gap-4 max-w-3xl mx-auto">
              <textarea
                autoFocus
                className="w-full bg-slate-50 text-slate-900 text-lg sm:text-2xl font-black uppercase text-center outline-none border-2 border-violet-500 rounded-2xl resize-none py-3 leading-tight tracking-tight px-6 shadow-sm"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={confirmEditTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    confirmEditTitle();
                  }
                }}
                rows={2}
              />
              <div className="flex gap-3">
                <button
                  onClick={confirmEditTitle}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                >
                  SALVAR
                </button>
                <button
                  onClick={cancelEditTitle}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 cursor-pointer"
                >
                  DESCARTAR
                </button>
              </div>
            </div>
          ) : (
            /* Modo visualização de título (clicável para editar) */
            <div
              onClick={startEditTitle}
              className="w-full group/btn relative flex flex-col items-center cursor-pointer"
            >
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900 leading-tight tracking-tight transition-all group-hover/btn:text-violet-700 max-w-3xl">
                {projectTitle || "DEFINIR TÍTULO"}
              </h1>
              <div className="mt-2.5 flex items-center justify-center gap-2 text-violet-600 opacity-0 group-hover/btn:opacity-100 transition-all transform translate-y-1 group-hover/btn:translate-y-0 print:hidden">
                <PencilLine className="w-3.5 h-3.5" />
                <span className="text-[9.9px] font-black uppercase tracking-[0.2em] bg-violet-50 text-violet-700 px-3 py-1 rounded-full border border-violet-200">
                  Editar Título
                </span>
              </div>
            </div>
          )}

          {/* Subtítulo: disciplina + ano/bimestre */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {content.curriculumRelation.subject && (
              <span className="px-3.5 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-200/60 print:bg-slate-50">
                {content.curriculumRelation.subject}
              </span>
            )}
            {content.curriculumRelation.yearAndQuarter && (
              <span className="px-3.5 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-200/60 print:bg-slate-50">
                {toStr(content.curriculumRelation.yearAndQuarter)}
              </span>
            )}
          </div>
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════════════════
          SEÇÕES DO CANVAS
      ══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-5 print:space-y-4">

        {/* ── SEÇÃO 1: Relação com o Currículo ─────────────────────────── */}
        <SectionCard
          number="1"
          title="Relação com o Currículo"
          icon={<BookOpen className="w-5 h-5 text-violet-400" />}
          headerColor="bg-violet-50/50 border-violet-100/50"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="ÁREA DO CONHECIMENTO"
                value={content.curriculumRelation.area}
                onChange={(val: string) => onEdit("curriculumRelation", "area", val)}
              />
              <Field
                label="ANO / BIMESTRE"
                value={content.curriculumRelation.yearAndQuarter}
                onChange={(val: string) => onEdit("curriculumRelation", "yearAndQuarter", val)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="TEMA"
                value={content.curriculumRelation.theme}
                onChange={(val: string) => onEdit("curriculumRelation", "theme", val)}
              />

              {/* Campo BNCC com badge indicando a fonte (PDF / Usuário / Web) */}
              <div className="relative group/field">
                <Field
                  label="HABILIDADE DA BNCC GERAL"
                  value={content.curriculumRelation.bnccSkills}
                  onChange={(val: string) => onEdit("curriculumRelation", "bnccSkills", val)}
                />

              </div>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!content.curriculumRelation.bnccSkillsComputing?.trim() && !content.curriculumRelation.bnccSkillsRegional?.trim() ? 'print:hidden' : ''}`}>
              <div className={!content.curriculumRelation.bnccSkillsComputing?.trim() ? "print:hidden" : ""}>
                <Field
                  label="HABILIDADE DA BNCC DA COMPUTAÇÃO"
                  value={content.curriculumRelation.bnccSkillsComputing}
                  onChange={(val: string) => onEdit("curriculumRelation", "bnccSkillsComputing", val)}
                />
              </div>
              <div className={!content.curriculumRelation.bnccSkillsRegional?.trim() ? "print:hidden" : ""}>
                <Field
                  label="HABILIDADE DA BNCC REGIONAL"
                  value={content.curriculumRelation.bnccSkillsRegional}
                  onChange={(val: string) => onEdit("curriculumRelation", "bnccSkillsRegional", val)}
                />
              </div>
            </div>
          </div>
        </SectionCard>


        {/* ── SEÇÃO 2: Estilo do Jogo ──────────────────────────────────── */}
        <SectionCard
          number="2"
          title="Estilo do Jogo"
          icon={<Gamepad2 className="w-5 h-5 text-purple-400" />}
          headerColor="bg-purple-50/50 border-purple-100/50"
        >
          <div className="space-y-3">
            {/* Tipo e público são readonly — definidos na criação e não editáveis aqui */}
            <Field
              label="TIPO DE JOGO"
              value={propGameType || content.gameStyle.genre}
              onChange={() => {}}
              readonly
            />
            <Field
              label="PÚBLICO"
              value={content.gameStyle.targetAudience}
              onChange={() => {}}
              readonly
            />
            <Field
              label="NARRATIVA CURTA"
              value={content.gameStyle.narrative}
              onChange={(val) => onEdit("gameStyle", "narrative", val)}
            />
          </div>
        </SectionCard>


        {/* ── SEÇÃO 3: Fluxo do Jogo ──────────────────────────────────── */}
        <SectionCard
          number="3"
          title="Fluxo do Jogo"
          icon={<ScrollText className="w-5 h-5 text-blue-600" />}
          headerColor="bg-blue-50 border-blue-100"
        >
          <div className="space-y-3">
            <Field
              label="FLUXO DO JOGO"
              value={content.gamePlot?.synopsis}
              onChange={(val) => onEdit("gamePlot", "synopsis", val)}
            />

            {/* Rótulo do campo de adversários/obstáculos varia por tipo de jogo */}
            <Field
              label={
                ["Jogo de Plataforma 2D", "Jogo de Tiro ao Alvo"].includes(
                  propGameType || content.gameStyle.genre || "",
                )
                  ? "CHEFES E INIMIGOS / OBSTÁCULOS"
                  : ["Roleta", "Tabuleiro"].includes(
                      propGameType || content.gameStyle.genre || "",
                    )
                  ? "CASAS DE AZAR / ELEMENTOS DE DIFICULDADE"
                  : "ADVERSÁRIOS / ELEMENTOS DE DIFICULDADE"
              }
              value={content.gamePlot?.characters}
              onChange={(val) => onEdit("gamePlot", "characters", val)}
            />
          </div>
        </SectionCard>


        {/* ── SEÇÃO 4: Mecânicas e Tarefas ────────────────────────────── */}
        {/* MechanicsSection lida internamente com todos os seus campos */}
        <MechanicsSection
          mechanics={content.gameMechanics}
          gameType={propGameType || content.gameStyle.genre}
          onEdit={(f, v) => onEdit("gameMechanics", f, v)}
        />


        {/* ── SEÇÃO 5: Conteúdo Programático + Lógica do Jogo ─────────── */}
        <SectionCard
          number="5"
          title="Conteúdo Programático"
          icon={<Library className="w-5 h-5 text-emerald-400" />}
          headerColor="bg-emerald-50/50 border-emerald-100/50"
        >
          <div className="space-y-12">

            {/* 5.0 - Conteúdo pedagógico (intro, vitória, derrota) */}
            <div className="space-y-3">
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50">
                <Field
                  label="INTRODUÇÃO"
                  value={toStr(content.programmaticContent?.intro)
                    // Remove cabeçalho técnico que a IA às vezes inclui por engano
                    .replace(/^\s*GUIA DE IMPLEMENTACAO PARA O DESENVOLVEDOR:?\s*/i, "")
                    .trim()}
                  onChange={(val) => onEdit("programmaticContent", "intro", val)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label="CONDIÇÃO DE VITÓRIA"
                  value={content.programmaticContent?.winCondition}
                  onChange={(val) => onEdit("programmaticContent", "winCondition", val)}
                />
                <Field
                  label="CONDIÇÃO DE DERROTA"
                  value={content.programmaticContent?.loseCondition}
                  onChange={(val) => onEdit("programmaticContent", "loseCondition", val)}
                />
              </div>
            </div>

            {/* 5.1 - Lógica do jogo (questões, alvos, palavras, etc.) */}
            <div className="pt-8 border-t-2 border-dashed border-slate-100">
              {content.gameLogic && (
                <GameLogicSection
                  gameLogic={content.gameLogic}
                  gameType={content.gameStyle.genre}
                  targetAudience={content.gameStyle.targetAudience}
                  subject={content.curriculumRelation?.subject || "Geral"}
                  theme={content.curriculumRelation?.theme || ""}
                  pdfBase64={pdfBase64}
                  pdfFileName={pdfFileName}
                  pdfTextContent={pdfTextContent}
                  onIsGenerating={onIsGenerating}
                  onEdit={(f: string, v: unknown) => onEdit("gameLogic", f, v)}
                  onAdd={(path: string, item: unknown) => onAdd("gameLogic", path, item)}
                  onRemove={(path: string, index: number) => onRemove("gameLogic", path, index)}
                />
              )}
            </div>

            {/* 5.2 - Preview interativo (específico por tipo de jogo) */}
            {renderGamePreview()}

          </div>
        </SectionCard>


        {/* ── SEÇÃO 6: Imagens de Referência ──────────────────────────── */}
        {/* Suporta até 5 imagens base64 enviadas pelo professor */}
        <ReferenceImagesSection
          images={content.gameLogic.referenceImages || []}
          onUpdate={(newImages: string[]) =>
            onEdit("gameLogic", "referenceImages", newImages)
          }
        />


        {/* ── SEÇÃO 7: Observações ao Desenvolvedor ───────────────────── */}
        <SectionCard
          number="7"
          title="Observações ao Desenvolvedor"
          icon={<ScrollText className="w-5 h-5 text-violet-500" />}
          headerColor="bg-violet-50/50 border-violet-100/50"
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-400 font-medium">
              Insira observações ou direcionamentos adicionais sobre o desenvolvimento do jogo.
            </p>
            <Field
              label=""
              value={content.gameLogic.developerNotes || ""}
              onChange={(val) => onEdit("gameLogic", "developerNotes", val)}
            />
          </div>
        </SectionCard>

      </div>


      {/* ══════════════════════════════════════════════════════════════════
          RODAPÉ: REFERÊNCIAS BIBLIOGRÁFICAS (ABNT)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="canvas-bibliography pt-12 border-t border-slate-200 mt-12 pb-12">
        <BibliographyField
          value={content.curriculumRelation.bibliography}
          onChange={(val) => onEdit("curriculumRelation", "bibliography", val)}
        />
      </div>

    </div>
  );
};

export default DocumentView;
