import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  Component,
} from "react";
import type { GeneratedContent } from "../../types";
import {
  BookOpen,
  Gamepad2,
  ScrollText,
  Library,
  PencilLine,
  Zap,
  Clock,
  Layers,
  BarChart2,
  XCircle,
  Lightbulb,
  Move,
  AlertTriangle,
  RefreshCw,
  Cog,
  Timer,
  LayoutList,
  Award,
  Gem,
  Target,
  Crosshair,
  Check,
  Grid,
  Circle,
  X,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";

// ─── Error Boundary: Impede tela branca em caso de crash no DocumentView ───
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
    console.error("DocumentView Error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 p-12">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-black text-slate-800 mb-2">
              Erro ao renderizar o canvas
            </h3>
            <p className="text-sm text-slate-500 mb-1">
              Ocorreu um erro inesperado ao exibir o conteúdo gerado.
            </p>
            <p className="text-xs font-mono text-rose-400 bg-rose-50 px-3 py-1.5 rounded-lg mt-2">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 cursor-pointer"
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

/**
 * Utilitário de segurança para garantir que NUNCA passamos um objeto (como o SyntheticEvent) como filho do React.
 * Se o valor for um objeto, ele será convertido em string vazia para evitar o erro #31.
 */
const toStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toStr).join(", ");
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
};
const safeString = toStr; // Alias para manter compatibilidade

/**
 * Compara se uma opção é a resposta correta de forma robusta,
 * lidando com prefixos (A, B, C), letras isoladas ou textos completos.
 */
const isCorrectAnswer = (
  opt: string,
  answer: string,
  index: number,
): boolean => {
  if (!opt || !answer) return false;
  const cleanOpt = opt.trim().toLowerCase();
  const cleanAns = answer.trim().toLowerCase();

  // Caso 1: A resposta é exatamente igual à opção
  if (cleanOpt === cleanAns) return true;

  // Caso 2: A resposta é apenas a letra (a, b, c...)
  const letters = ["a", "b", "c", "d", "e"];
  if (cleanAns === letters[index]) return true;

  // Caso 3: Removendo prefixos como "A) ", "1. ", etc de ambos
  const strip = (s: string) =>
    s
      .replace(/^[a-z0-9]\s*[\)\-\. ]\s*/i, "")
      .trim()
      .toLowerCase();
  return strip(opt) === strip(answer);
};

interface DocumentViewProps {
  content: GeneratedContent;
  title: string;
  gameType?: string;
  onEdit: (section: keyof GeneratedContent, field: string, value: any) => void;
  onAdd: (section: keyof GeneratedContent, path: string, item: any) => void;
  onRemove: (
    section: keyof GeneratedContent,
    path: string,
    index: number,
  ) => void;
}

export const DocumentView: React.FC<DocumentViewProps> = ({
  content,
  title: projectTitle,
  gameType: propGameType,
  onEdit,
  onAdd,
  onRemove,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const startEditTitle = () => {
    setTitleDraft(projectTitle);
    setIsEditingTitle(true);
  };

  const confirmEditTitle = () => {
    onEdit("curriculumRelation" as any, "_projectTitle", titleDraft);
    setIsEditingTitle(false);
  };

  const cancelEditTitle = () => setIsEditingTitle(false);

  return (
    <div
      className="w-full mx-auto max-w-4xl space-y-8 p-6 md:p-12 text-slate-800 transition-all duration-500"
      id="document-view"
    >
      {/* Header / Banner Principal */}
      <div 
        className="relative group mb-8 overflow-hidden rounded-[2rem] p-10 text-center shadow-[0_15px_40px_rgba(0,0,0,0.2)] export-compact-header"
        style={{ 
          backgroundColor: '#2e1065', 
          border: '1px solid rgba(88, 28, 135, 0.5)'
        }}
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/hexellence.png')] opacity-10" />
        <div 
          className="absolute inset-0 opacity-60" 
          style={{ background: 'linear-gradient(to bottom right, #581c87, transparent, #701a75)' }}
        />
        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <span 
              className="px-4 py-1.5 backdrop-blur-md rounded-full font-black text-[9px] uppercase tracking-[0.4em] shadow-inner"
              style={{ 
                backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                border: '1px solid rgba(99, 102, 241, 0.2)',
                color: '#818cf8' 
              }}
            >
              Plano de Aula Gamificado
            </span>
          </div>

          {isEditingTitle ? (
            <div className="flex flex-col items-center gap-6">
              <textarea
                autoFocus
                className="w-full bg-slate-800/50 text-white text-2xl md:text-4xl font-black uppercase text-center outline-none border-2 border-indigo-500 rounded-3xl resize-none py-4 leading-tight tracking-tight px-8 shadow-2xl"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                >
                  SALVAR
                </button>
                <button
                  onClick={cancelEditTitle}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 cursor-pointer"
                >
                  DESCARTAR
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={startEditTitle}
              className="w-full group/btn relative flex flex-col items-center"
            >
              <h1 className="text-3xl md:text-5xl font-black text-white uppercase leading-tight tracking-tight transition-all group-hover/btn:scale-[1.01] drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)] max-w-2xl">
                {projectTitle || "DEFINIR TÍTULO"}
              </h1>
              <div className="mt-4 flex items-center justify-center gap-3 text-indigo-400 opacity-0 group-hover/btn:opacity-100 transition-all transform translate-y-2 group-hover/btn:translate-y-0">
                <PencilLine className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                  Editar Título
                </span>
              </div>
            </button>
          )}

          <div className="mt-10 flex flex-col items-center gap-1.5">
            <p className="text-slate-200 font-black text-xs uppercase tracking-[0.4em] drop-shadow-md">
              {content.curriculumRelation.subject}
            </p>
            <div className="flex items-center gap-3 text-indigo-300/60 font-bold text-[9px] uppercase tracking-[0.3em]">
              {/* Dividimos o ano/bimestre em duas partes com proteção extra */}
              <span>
                {toStr(content.curriculumRelation.yearAndQuarter).split(
                  " - ",
                )[0] || ""}
              </span>
              <div className="w-1 h-1 rounded-full bg-indigo-500/30" />
              <span>
                {toStr(content.curriculumRelation.yearAndQuarter).split(
                  " - ",
                )[1] || ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seções do Canvas */}
      <div className="grid grid-cols-1 gap-8">
        {/* 1. Currículo */}
        <SectionCard
          number="1"
          title="Relação com o Currículo"
          icon={<BookOpen className="w-5 h-5 text-indigo-400" />}
          headerColor="bg-indigo-50/50 border-indigo-100/50"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field
                label="ÁREA DO CONHECIMENTO"
                value={content.curriculumRelation.area}
                onChange={(val: string) =>
                  onEdit("curriculumRelation", "area", val)
                }
              />
              <Field
                label="ANO / BIMESTRE"
                value={content.curriculumRelation.yearAndQuarter}
                onChange={(val: string) =>
                  onEdit("curriculumRelation", "yearAndQuarter", val)
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative group/field">
                <Field
                  label="TEMA"
                  value={content.curriculumRelation.theme}
                  onChange={(val: string) =>
                    onEdit("curriculumRelation", "theme", val)
                  }
                />
              </div>
              <div className="relative group/field">
                <div className="relative group/field">
                  <Field
                    label="HABILIDADE BNCC"
                    value={content.curriculumRelation.bnccSkills}
                    onChange={(val: string) =>
                      onEdit("curriculumRelation", "bnccSkills", val)
                    }
                  />
                  {(() => {
                    const bnccValue = (
                      content.curriculumRelation.bnccSkills || ""
                    ).replace(/\s/g, "");
                    const isMedium =
                      content.gameStyle.targetAudience === "Ensino Médio";
                    const efRegex = /^[A-Z]{2}\d{2}[A-Z]{2}\d{2}$/;
                    const emRegex = /^[A-Z]{2}\d{2}[A-Z]{3}\d{3}$/;
                    const isValid = isMedium
                      ? emRegex.test(bnccValue)
                      : efRegex.test(bnccValue);

                    return (
                      <>
                        {content.curriculumRelation.bnccSource && (
                          <div
                            className={`absolute -top-3 right-0 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm border ${
                              !isValid
                                ? "bg-rose-50 text-rose-600 border-rose-100"
                                : content.curriculumRelation.bnccSource ===
                                    "pdf"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : content.curriculumRelation.bnccSource ===
                                      "user"
                                    ? "bg-amber-50 text-amber-600 border-amber-100"
                                    : "bg-blue-50 text-blue-600 border-blue-100"
                            }`}
                          >
                            {!isValid
                              ? "Formato Inválido"
                              : content.curriculumRelation.bnccSource === "pdf"
                                ? "Retirado do PDF"
                                : content.curriculumRelation.bnccSource ===
                                    "user"
                                  ? "Alterado pelo usuário"
                                  : "Retirado da Web"}
                          </div>
                        )}
                        {!isValid && (
                          <div className="absolute -bottom-6 left-1 flex items-center gap-1 text-[8px] font-bold text-rose-500 uppercase tracking-wider animate-bounce">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {isMedium
                              ? "Padrão: 2 Letras, 2 Números, 3 Letras, 3 Números"
                              : "Padrão: 2 Letras, 2 Números, 2 Letras, 2 Números"}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="relative group/field">
              <Field
                label="DESCRIÇÃO DA HABILIDADE"
                value={content.curriculumRelation.skillsDescription}
                onChange={(val: string) =>
                  onEdit("curriculumRelation", "skillsDescription", val)
                }
              />
            </div>
          </div>
        </SectionCard>

        {/* 2 & 3. Estilo e Fluxo (Agora em colunas separadas para evitar side-by-side) */}
        <SectionCard
          number="2"
          title="Estilo do Jogo"
          icon={<Gamepad2 className="w-5 h-5 text-purple-400" />}
          headerColor="bg-purple-50/50 border-purple-100/50"
        >
          <div className="space-y-6">
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

        <SectionCard
          number="3"
          title="Fluxo do Jogo"
          icon={<ScrollText className="w-5 h-5 text-blue-600" />}
          headerColor="bg-blue-50 border-blue-100"
        >
          <div className="space-y-6">
            <Field
              label="FLUXO DO JOGO"
              value={content.gamePlot?.synopsis}
              onChange={(val) => onEdit("gamePlot", "synopsis", val)}
            />
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

        {/* 4. Mecânicas e Tarefas */}
        <MechanicsSection
          mechanics={content.gameMechanics}
          gameType={propGameType || content.gameStyle.genre}
          onEdit={(f, v) => onEdit("gameMechanics", f, v)}
        />

        {/* 5. Conteúdo Programático + Lógica */}
        <SectionCard
          number="5"
          title="Conteúdo Programático"
          icon={<Library className="w-5 h-5 text-emerald-400" />}
          headerColor="bg-emerald-50/50 border-emerald-100/50"
        >
          <div className="space-y-12">
            {/* Bloco de Conteúdo */}
            <div className="space-y-6">
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50">
                <Field
                  label="INTRODUÇÃO"
                  value={toStr(content.programmaticContent?.intro)
                    .replace(
                      /^\s*GUIA DE IMPLEMENTAÇÃO PARA O DESENVOLVEDOR:?\s*/i,
                      "",
                    )
                    .trim()}
                  onChange={(val) =>
                    onEdit("programmaticContent", "intro", val)
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field
                  label="CONDIÇÃO DE VITÓRIA"
                  value={content.programmaticContent?.winCondition}
                  onChange={(val) =>
                    onEdit("programmaticContent", "winCondition", val)
                  }
                />
                <Field
                  label="CONDIÇÃO DE DERROTA"
                  value={content.programmaticContent?.loseCondition}
                  onChange={(val) =>
                    onEdit("programmaticContent", "loseCondition", val)
                  }
                />
              </div>
            </div>

            {/* Bloco de Lógica (Sub-sessão) */}
            <div className="pt-8 border-t-2 border-dashed border-slate-100">
              {content.gameLogic && (
                <GameLogicSection
                  gameLogic={content.gameLogic}
                  gameType={content.gameStyle.genre}
                  onEdit={(f: string, v: any) => onEdit("gameLogic", f, v)}
                  onAdd={(path: string, item: any) =>
                    onAdd("gameLogic", path, item)
                  }
                  onRemove={(path: string, index: number) =>
                    onRemove("gameLogic", path, index)
                  }
                />
              )}
            </div>
          </div>
        </SectionCard>

        {/* Extra: Drag & Drop Canvas */}
        {(() => {
          const gt = String(propGameType || content.gameStyle?.genre || "");
          if (gt.toLowerCase().includes("arrastar"))
            return <DragAndDropCanvas />;
          if (gt === "Roleta")
            return (
              <RoletaPreview
                targets={content.gameLogic.targets}
                onUpdate={(idx, field, val) => {
                  const currentTargets = content.gameLogic.targets || [];
                  const newTargets = currentTargets.length > 0 
                    ? [...currentTargets] 
                    : [
                        { title: "Pergunta 1", isCorrect: true, points: 15, options: ["Correta", "Incorreta"], answer: "Correta" },
                        { title: "Dica Pedagógica", isCorrect: true, points: 0, description: "Conteúdo importante sobre o tema" },
                        { title: "Penalidade", isCorrect: false, points: -10, feedback: "Tente novamente!" },
                        { title: "Pergunta 2", isCorrect: true, points: 15, options: ["Sim", "Não"], answer: "Sim" },
                        { title: "Dica", isCorrect: true, points: 0, description: "Informação complementar" },
                        { title: "Penalidade", isCorrect: false, points: -10 },
                        { title: "Pergunta 3", isCorrect: true, points: 15, options: ["Opção A", "Opção B"], answer: "Opção A" },
                        { title: "Bônus Especial", isCorrect: true, points: 25 },
                        { title: "Pergunta 4", isCorrect: true, points: 15, options: ["Certo", "Errado"], answer: "Certo" },
                        { title: "Pergunta 5", isCorrect: true, points: 15, options: ["Verdadeiro", "Falso"], answer: "Verdadeiro" },
                      ].slice(0, 10);
                  
                  newTargets[idx] = { ...newTargets[idx], [field]: val };
                  onEdit("gameLogic", "targets", newTargets);
                }}
                onRemove={(idx) => {
                  const currentTargets = [...(content.gameLogic.targets || [])];
                  if (currentTargets.length === 0) return; // Nada para remover se for fallback
                  currentTargets.splice(idx, 1);
                  onEdit("gameLogic", "targets", currentTargets);
                }}
                onAdd={() => {
                  const currentTargets: any[] = (content.gameLogic.targets && content.gameLogic.targets.length > 0)
                    ? [...content.gameLogic.targets]
                    : [
                        { title: "Pergunta 1", isCorrect: true, points: 15, options: ["Correta", "Incorreta"], answer: "Correta" },
                        { title: "Dica Pedagógica", isCorrect: true, points: 0, description: "Conteúdo importante sobre o tema" },
                        { title: "Penalidade", isCorrect: false, points: -10, feedback: "Tente novamente!" },
                        { title: "Pergunta 2", isCorrect: true, points: 15, options: ["Sim", "Não"], answer: "Sim" },
                        { title: "Dica", isCorrect: true, points: 0, description: "Informação complementar" },
                        { title: "Penalidade", isCorrect: false, points: -10 },
                        { title: "Pergunta 3", isCorrect: true, points: 15, options: ["Opção A", "Opção B"], answer: "Opção A" },
                        { title: "Bônus Especial", isCorrect: true, points: 25 },
                        { title: "Pergunta 4", isCorrect: true, points: 15, options: ["Certo", "Errado"], answer: "Certo" },
                        { title: "Pergunta 5", isCorrect: true, points: 15, options: ["Verdadeiro", "Falso"], answer: "Verdadeiro" },
                      ].slice(0, 10);
                  
                  currentTargets.push({
                    title: "Nova Pergunta: Escreva o enunciado aqui",
                    description: "Forneça uma dica ou explicação adicional para o aluno.",
                    isCorrect: true,
                    points: 15,
                    options: ["Alternativa Correta", "Alternativa Incorreta"],
                    answer: "Alternativa Correta",
                    feedback: "Parabéns! Resposta certa."
                  });
                  onEdit("gameLogic", "targets", currentTargets);
                }}
              />
            );
          if (gt === "Jogo da Velha")
            return <TicTacToePreview targets={content.gameLogic.targets} />;
          if (gt === "Sliding Puzzle")
            return <SlidingPuzzlePreview targets={content.gameLogic.targets} />;
          return null;
        })()}

        {/* Exemplos de Imagens (Até 5 Imagens) */}
        <ReferenceImagesSection
          images={content.gameLogic.referenceImages || []}
          onUpdate={(newImages: string[]) => onEdit("gameLogic", "referenceImages", newImages)}
        />
      </div>

      {/* Referências */}
      <div className="pt-12 border-t border-slate-200 mt-12 pb-12">
        <Field
          label="REFERÊNCIA BIBLIOGRÁFICA"
          value={content.curriculumRelation.bibliography}
          onChange={(val) => onEdit("curriculumRelation", "bibliography", val)}
        />
      </div>
    </div>
  );
};

const SectionCard: React.FC<{
  number: string;
  title: string;
  icon: React.ReactNode;
  headerColor: string;
  children: React.ReactNode;
  className?: string;
}> = ({ number, title, icon, headerColor, children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden transition-all hover:shadow-[0_10px_30px_rgb(0,0,0,0.04)] ${className}`}>
    <div
      className={`px-8 py-4 flex items-center gap-4 border-b border-slate-50 ${headerColor}`}
    >
      <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-slate-200 font-black text-lg">{number}</span>
        <span className="text-slate-600 font-black uppercase tracking-widest text-[10px]">
          {title}
        </span>
      </div>
    </div>
    <div className="p-8 md:p-10">{children}</div>
  </div>
);

// --- Seção: Plataforma 2D ---
const PlatformerSection: React.FC<{
  targets: any[];
  hints: string[];
  onEdit: (field: string, value: any) => void;
  onAdd: (path: string, item: any) => void;
  onRemove: (path: string, index: number) => void;
}> = ({ targets, hints, onEdit, onAdd, onRemove }) => {
  const handleAddHint = () => {
    const defaultHint =
      hints.length > 0
        ? hints[Math.floor(Math.random() * hints.length)]
        : "Dica pedagógica importante sobre o conteúdo";
    onAdd("thematicHints", defaultHint);
  };

  return (
    <div className="space-y-12">
      {/* Perguntas Durante o Jogo - Estilo similar às Questões Finais */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              Perguntas de Percurso (3 a 5 itens)
            </p>
            <p className="text-[9px] text-slate-400 font-bold uppercase italic">
              Aparecem durante as fases (Estilo Questão Final)
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {targets.map((t, i) => (
            <div
              key={i}
              className="group/plat p-4 bg-emerald-50/20 border border-emerald-100 rounded-2xl shadow-sm hover:shadow-md transition-all relative"
            >
              <button
                onClick={() => onRemove("targets", i)}
                className="absolute -top-2 -right-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/plat:opacity-100 bg-white rounded-full shadow-md z-20"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-3">
                  <Field
                    label="ENUNCIADO ELABORADO"
                    value={t.question || t.title}
                    onChange={(val) => onEdit(`targets[${i}].question`, val)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(t.options || ["Sim", "Não"]).map(
                      (opt: string, optIdx: number) => (
                        <div
                          key={optIdx}
                          className={`p-1.5 rounded-xl border transition-all cursor-pointer ${opt === t.answer ? "bg-emerald-100 border-emerald-300" : "bg-white border-slate-100"}`}
                          onClick={() => onEdit(`targets[${i}].answer`, opt)}
                        >
                          <Field
                            label={optIdx === 0 ? "CORRETA" : "INCORRETA"}
                            value={opt}
                            onChange={(val) => {
                              const wasCorrect = opt === t.answer;
                              const newOpts = [
                                ...(t.options || ["Sim", "Não"]),
                              ];
                              newOpts[optIdx] = val;
                              onEdit(`targets[${i}].options`, newOpts);
                              if (wasCorrect)
                                onEdit(`targets[${i}].answer`, val);
                            }}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dicas Temáticas */}
      <div className="space-y-6 pt-8 border-t border-dashed border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
              Dicas Temáticas (Total 5)
            </p>
            <p className="text-[9px] text-slate-400 font-bold uppercase italic">
              Dicas espalhadas pelo cenário
            </p>
          </div>
          {hints.length < 5 && (
            <button
              onClick={handleAddHint}
              className="text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 hover:bg-amber-100 transition-all"
            >
              + Adicionar Dica
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hints.map((h, i) => (
            <div
              key={i}
              className="group/hint p-4 bg-amber-50/30 border border-amber-100 rounded-2xl relative"
            >
              <button
                onClick={() => onRemove("thematicHints", i)}
                className="absolute -top-2 -right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover/hint:opacity-100 bg-white rounded-full"
              >
                <XCircle className="w-4 h-4" />
              </button>
              <Field
                label={`DICA ${i + 1}`}
                value={h}
                onChange={(val) => onEdit(`thematicHints[${i}]`, val)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Seção: Quebra-Cabeça Interativo ---
const EXAMPLE_PUZZLE_URL =
  "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=600&q=80";

const SinglePuzzle: React.FC<{
  puzzle: any;
  pIdx: number;
  onUpdatePuzzle: (idx: number, updates: any) => void;
  onRemovePuzzle: (idx: number) => void;
  canRemove: boolean;
}> = ({ puzzle, pIdx, onUpdatePuzzle, onRemovePuzzle, canRemove }) => {
  const [placedPieces, setPlacedPieces] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pieceCount = puzzle.pieceCount || 8;
  let COLS = 4;
  let ROWS = 2;
  if (pieceCount === 6) {
    COLS = 3;
    ROWS = 2;
  } else if (pieceCount === 9) {
    COLS = 3;
    ROWS = 3;
  } else if (pieceCount === 10) {
    COLS = 5;
    ROWS = 2;
  }
  const TOTAL = COLS * ROWS;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("A imagem é muito grande. Escolha uma foto com menos de 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);
        const optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.4);

        onUpdatePuzzle(pIdx, { imageUrl: optimizedDataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handlePieceClick = (idx: number) => {
    if (placedPieces.includes(idx)) return;
    setPlacedPieces((prev) => [...prev, idx]);
  };

  return (
    <div className="relative group/pcontainer p-6 mb-8 border-2 border-dashed border-violet-100 rounded-3xl bg-white shadow-sm hover:shadow-md transition-all">
      {canRemove && (
        <button
          onClick={() => onRemovePuzzle(pIdx)}
          className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-white text-slate-300 hover:text-rose-500 border border-slate-100 rounded-full shadow-md transition-all opacity-0 group-hover/pcontainer:opacity-100 z-30 cursor-pointer"
        >
          <XCircle className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center justify-between pb-3 mb-4 border-b border-violet-100">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
            <span className="text-violet-600 text-xs font-black">🧩</span>
          </div>
          <div>
            <p className="text-[11px] font-black text-violet-700 uppercase tracking-widest">
              Quebra-Cabeça {pIdx + 1}
            </p>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">
              Preview Interativo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={puzzle.pieceCount || 8}
            onChange={(e) =>
              onUpdatePuzzle(pIdx, { pieceCount: Number(e.target.value) })
            }
            className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] uppercase font-black tracking-widest rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
          >
            <option value={6}>6 Peças</option>
            <option value={8}>8 Peças</option>
            <option value={9}>9 Peças</option>
            <option value={10}>10 Peças</option>
          </select>
          {placedPieces.length > 0 && (
            <button
              onClick={() => setPlacedPieces([])}
              className="text-[9px] font-black text-violet-500 uppercase tracking-widest hover:text-rose-500 transition-colors px-3 py-1.5 bg-violet-50 rounded-lg border border-violet-100 cursor-pointer"
            >
              ↺ Reiniciar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Grid */}
        <div
          className="relative rounded-3xl overflow-hidden border-2 border-violet-200 shadow-xl bg-slate-200"
          style={{ aspectRatio: "2/1" }}
        >
          <img
            src={puzzle.imageUrl || EXAMPLE_PUZZLE_URL}
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            style={{
              objectPosition: "center",
              maxWidth: "none",
              maxHeight: "none",
            }}
          />
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            }}
          >
            {Array.from({ length: TOTAL }).map((_, idx) => {
              const placed = placedPieces.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => handlePieceClick(idx)}
                  className={`relative cursor-pointer transition-all duration-500 group/piece overflow-hidden ${placed ? "ring-0" : "hover:ring-2 hover:ring-violet-400 hover:ring-inset"}`}
                >
                  <div
                    className={`absolute inset-0 border border-white/20 z-10 pointer-events-none ${placed ? "opacity-0" : ""}`}
                  />
                  {placed ? (
                    <div className="absolute inset-0 overflow-hidden animate-in fade-in duration-500 scale-100">
                      <div
                        className="absolute top-0 left-0 pointer-events-none"
                        style={{
                          width: `${COLS * 100}%`,
                          height: `${ROWS * 100}%`,
                          transform: `translate3d(-${(idx % COLS) * (100 / COLS)}%, -${Math.floor(idx / COLS) * (100 / ROWS)}%, 0)`,
                        }}
                      >
                        <img
                          src={puzzle.imageUrl || EXAMPLE_PUZZLE_URL}
                          alt=""
                          className="w-full h-full object-cover"
                          style={{
                            display: "block",
                            maxWidth: "none",
                            maxHeight: "none",
                            objectPosition: "center",
                          }}
                        />
                      </div>
                      <div className="absolute inset-0 bg-emerald-400/10 flex items-center justify-center opacity-0 group-hover/piece:opacity-100 transition-opacity z-10">
                        <div className="bg-emerald-500 text-white rounded-full p-2 shadow-lg transform scale-90 group-hover/piece:scale-100 transition-transform">
                          <Check className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-violet-50/60 group-hover/piece:bg-violet-100/80 transition-all flex flex-col items-center justify-center gap-1 backdrop-blur-[2px]">
                      <span className="text-2xl group-hover/piece:scale-110 transition-transform">
                        🧩
                      </span>
                      <span className="text-[8px] font-black text-violet-500 uppercase tracking-widest opacity-0 group-hover/piece:opacity-100 transition-all">
                        Encaixar
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Barra de progresso */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
            <div
              className="h-full bg-emerald-400 transition-all duration-700 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
              style={{ width: `${(placedPieces.length / TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* Mensagem de Vitória */}
        {placedPieces.length === TOTAL && (
          <div className="flex items-center justify-center p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-4">
              <Award className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">
                  Desafio Concluído!
                </p>
                <p className="text-sm font-black text-slate-800 tracking-tight mt-1">
                  Imagens e conceitos dominados
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Image for this puzzle */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer border-2 border-dashed border-violet-200 rounded-3xl overflow-hidden hover:border-violet-400 transition-all duration-300 bg-violet-50/30 hover:bg-violet-50 p-6 flex items-center justify-center gap-4 text-center mt-6"
        >
          <span className="text-3xl">📷</span>
          <div className="text-left">
            <p className="text-[12px] font-black text-violet-700">
              Substituir Imagem (Quebra-Cabeça {pIdx + 1})
            </p>
            <p className="text-[9px] text-slate-400 font-medium mt-1">
              Clique para carregar foto (Máx 10MB)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {/* Descrição */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm mt-4 mb-2">
          <Field
            label="DESCRIÇÃO DA IMAGEM / CONTEXTO"
            value={puzzle.description || ""}
            onChange={(val: string) =>
              onUpdatePuzzle(pIdx, { description: val })
            }
          />
        </div>
      </div>
    </div>
  );
};

const PuzzleSection: React.FC<{
  targets: any[];
  gameLogic: any;
  onEdit: (field: string, value: any) => void;
  onAdd: (path: string, item: any) => void;
  onRemove: (path: string, index: number) => void;
}> = ({ targets, gameLogic, onEdit, onAdd, onRemove }) => {
  // Suporte legado a único puzzle + suporte a lista
  const puzzles = gameLogic.puzzles || [
    {
      imageUrl: gameLogic.puzzleImageUrl || EXAMPLE_PUZZLE_URL,
      description:
        gameLogic.puzzleDescription ||
        "Monte o quebra-cabeça e responda as questões ao encaixar cada peça!",
      pieceCount: gameLogic.puzzlePieceCount || 8,
    },
  ];

  const handleUpdatePuzzle = (idx: number, updates: any) => {
    const newPuzzles = [...puzzles];
    newPuzzles[idx] = { ...newPuzzles[idx], ...updates };
    onEdit("puzzles", newPuzzles);
  };

  const handleRemovePuzzle = (idx: number) => {
    if (puzzles.length <= 1) return;
    const newPuzzles = puzzles.filter((_: any, i: number) => i !== idx);
    onEdit("puzzles", newPuzzles);
  };

  const handleAddPuzzle = () => {
    if (puzzles.length >= 3) return;
    const newPuzzles = [
      ...puzzles,
      {
        imageUrl: EXAMPLE_PUZZLE_URL,
        description: "Escreva uma descrição ou contexto para esta imagem",
        pieceCount: 8,
      },
    ];
    onEdit("puzzles", newPuzzles);
  };

  const MAX_TARGETS = puzzles.length >= 3 ? 10 : 5;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center justify-between pb-3 mb-6 border-b border-violet-100">
          <div>
            <p className="text-[11px] font-black text-violet-700 uppercase tracking-widest">
              {puzzles.length > 1
                ? "Múltiplos Quebra-Cabeças"
                : "Quebra-Cabeça"}{" "}
              ({puzzles.length}/3)
            </p>
          </div>
          {puzzles.length < 3 && (
            <button
              onClick={handleAddPuzzle}
              className="px-4 py-2 bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-violet-700 transition cursor-pointer flex items-center gap-2 shadow-lg shadow-violet-500/30"
            >
              <span className="text-lg leading-none">+</span> Adicionar
              Quebra-Cabeça
            </button>
          )}
        </div>

        {puzzles.map((p: any, idx: number) => (
          <SinglePuzzle
            key={idx}
            puzzle={p}
            pIdx={idx}
            onUpdatePuzzle={handleUpdatePuzzle}
            onRemovePuzzle={handleRemovePuzzle}
            canRemove={puzzles.length > 1}
          />
        ))}
      </div>

      {/* Peças / Questões vinculadas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
            Configurações e Questões ({targets.length})
          </p>
          <div className="flex items-center gap-4">
            {targets.length < MAX_TARGETS ? (
              <button
                onClick={() => {
                  onAdd("targets", {
                    title: `Questão ${targets.length + 1}`,
                    question: `Nova pergunta ${targets.length + 1}?`,
                    options: ["Opção A", "Opção B"],
                    answer: "Opção A",
                    isCorrect: true,
                  });
                }}
                className="text-[9px] flex items-center gap-1 font-black uppercase tracking-widest bg-violet-100 text-violet-600 hover:bg-violet-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-lg leading-none">+</span> QuestÃO
              </button>
            ) : (
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded">
                Limite Atingido ({MAX_TARGETS})
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {targets.map((target, i) => {
            const hasQuestion =
              !!target.question ||
              (target.options && target.options.length > 0);
            return (
              <div
                key={i}
                className={`group/pz relative p-6 rounded-[2rem] border transition-all ${target.isCorrect ? "bg-indigo-50/30 border-indigo-100 shadow-sm" : "bg-rose-50/50 border-rose-100"} hover:shadow-xl hover:bg-white`}
              >
                {targets.length > 3 && (
                  <button
                    onClick={() => onRemove("targets", i)}
                    className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 bg-white rounded-full shadow-md z-20 transition-all opacity-0 group-hover/pz:opacity-100 cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-200">
                      #{i + 1}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${target.isCorrect ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"}`}
                    >
                      {hasQuestion ? "❓ Questionário" : "💡 Conteúdo"}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <Field
                      label="Pergunta Desafio"
                      value={toStr(target.question || target.title)}
                      onChange={(val: string) => {
                        if (!targets[i])
                          onEdit(`targets[${i}]`, { ...target, question: val });
                        else onEdit(`targets[${i}].question`, val);
                      }}
                    />
                  </div>

                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
                        Alternativas e Resposta Correta (2 Opções)
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(Array.isArray(target.options) && target.options.length >= 2
                          ? target.options
                          : ["Opção A", "Opção B"]
                        )
                          .slice(0, 2)
                          .map((opt: string, oi: number) => (
                            <div
                              key={oi}
                              className={`relative p-1 rounded-2xl border-2 transition-all ${opt === target.answer ? "border-emerald-400 bg-emerald-50/30" : "border-slate-50"}`}
                            >
                              <Field
                                label={`ALT ${String.fromCharCode(65 + oi)}`}
                                value={toStr(opt)}
                                onChange={(val: string) => {
                                  const currentTarget = targets[i] || target;
                                  const newOpts = [
                                    ...(currentTarget.options || [
                                      "Opção A",
                                      "Opção B",
                                    ]),
                                  ];
                                  const wasCorrect = opt === currentTarget.answer;
                                  newOpts[oi] = val;
                                if (!targets[i])
                                  onEdit(`targets[${i}]`, {
                                    ...currentTarget,
                                    options: newOpts,
                                    answer: wasCorrect
                                      ? val
                                      : currentTarget.answer,
                                  });
                                else {
                                  onEdit(`targets[${i}].options`, newOpts);
                                  if (wasCorrect)
                                    onEdit(`targets[${i}].answer`, val);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                if (!targets[i])
                                  onEdit(`targets[${i}]`, {
                                    ...target,
                                    answer: opt,
                                  });
                                else onEdit(`targets[${i}].answer`, opt);
                              }}
                              className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${opt === target.answer ? "bg-emerald-500 text-white scale-110" : "bg-white text-slate-300 hover:text-emerald-500 opacity-0 group-hover/pz:opacity-100"}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <Field
                      label="Feedback Educativo (Ao acertar)"
                      value={toStr(target.description || target.feedback || "")}
                      onChange={(val: string) => {
                        if (!targets[i])
                          onEdit(`targets[${i}]`, {
                            ...target,
                            description: val,
                          });
                        else onEdit(`targets[${i}].description`, val);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Seção 6: Lógica do Jogo ---
const GameLogicSection: React.FC<{
  gameLogic: GeneratedContent["gameLogic"];
  gameType: string;
  onEdit: (field: string, value: any) => void;
  onAdd: (path: string, item: any) => void;
  onRemove: (path: string, index: number) => void;
}> = ({ gameLogic, gameType, onEdit, onAdd, onRemove }) => {
  const {
    howToPlay,
    timeLimit,
    levels,
    difficulty,
    targets = [],
    questionPool = [],
    thematicHints = [],
  } = gameLogic;

  const handleAddTarget = () => {
    // Limites por tipo de jogo
    if (gameType === "Roleta" && targets.length >= 10) return;
    if (gameType === "Jogo de Tiro ao Alvo" && targets.length >= 25) return;
    if (gameType === "Jogo de Plataforma 2D" && targets.length >= 5) return;

    if (gameType === "Jogo de Tiro ao Alvo") {
      // Pega uma questão real do banco para preencher automaticamente
      const poolQuestion =
        questionPool.length > 0
          ? questionPool[Math.floor(Math.random() * questionPool.length)]
          : null;

      const questionText =
        poolQuestion?.question ||
        `Pergunta ${Math.floor(targets.length / 2) + 1}`;

      // O `answer` pode ser só uma letra ("A") — buscamos o texto completo nas options
      let correctTitle = "Resposta Correta";
      let wrongTitle = "Resposta Incorreta";

      if (poolQuestion) {
        const rawAnswer = (poolQuestion.answer || "").trim();
        const options: string[] = poolQuestion.options || [];

        // Tenta achar option que começa com a letra da resposta (ex: "A)" ou é exatamente o texto)
        const correctOption =
          options.find(
            (o: string) =>
              o === rawAnswer ||
              o.toUpperCase().startsWith(rawAnswer.toUpperCase() + ")") ||
              o.toUpperCase().startsWith(rawAnswer.toUpperCase() + "."),
          ) ||
          options[0] ||
          rawAnswer ||
          "Resposta Correta";

        correctTitle = correctOption;

        // Pega uma errada diferente da correta
        const wrongOptions = options.filter((o: string) => o !== correctOption);
        wrongTitle =
          wrongOptions.length > 0
            ? wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
            : "Resposta Incorreta";
      }

      const newGroup = [
        {
          title: correctTitle,
          question: questionText,
          description: "Excelente! Esta resposta está correta.",
          isCorrect: true,
          points: 20,
          feedback: "",
        },
        {
          title: wrongTitle,
          question: questionText,
          description: "Esta opção está incorreta conforme o conteúdo.",
          isCorrect: false,
          points: -10,
          feedback: "",
        },
      ];
      newGroup.forEach((item) => onAdd("targets", item));
      return;
    }

    if (gameType === "Jogo de Plataforma 2D") {
      const poolQuestion =
        questionPool.length > 0
          ? questionPool[Math.floor(Math.random() * questionPool.length)]
          : null;

      let finalOptions = ["Sim", "Não"];
      let finalAnswer = "Sim";

      if (poolQuestion) {
        const correctAnswer = poolQuestion.answer || poolQuestion.options[0];
        const otherOptions = poolQuestion.options.filter(
          (o: string) => o !== correctAnswer,
        );
        const wrongAnswer =
          otherOptions.length > 0
            ? otherOptions[Math.floor(Math.random() * otherOptions.length)]
            : "Alternativa Incorreta";

        // Garantir que a resposta correta esteja entre as duas opções
        finalOptions = [correctAnswer, wrongAnswer].sort(
          () => Math.random() - 0.5,
        );
        finalAnswer = correctAnswer;
      }

      onAdd("targets", {
        question: poolQuestion
          ? poolQuestion.question
          : "Enunciado pedagógico sobre o conteúdo central",
        options: finalOptions,
        answer: finalAnswer,
        isCorrect: true,
        points: 15,
      });
      return;
    }

    // Se temos um banco de questões, pegamos a próxima disponível ou uma aleatória
    const poolQuestion =
      questionPool.length > 0
        ? questionPool[Math.floor(Math.random() * questionPool.length)]
        : null;

    const isRoleta = gameType === "Roleta";
    const isTabuleiro = gameType === "Tabuleiro";
    const isEsmaga = gameType === "Esmaga Palavras";
    const finalOptions: string[] = poolQuestion
      ? isRoleta
        ? (() => {
            const correct = poolQuestion.answer || poolQuestion.options[0];
            const others = poolQuestion.options.filter(o => o !== correct);
            return [correct, others[0] || "Opção B", others[1] || "Opção C", others[2] || "Opção D"].sort(() => Math.random() - 0.5);
          })()
        : isTabuleiro
          ? poolQuestion.options.slice(0, 3)
          : poolQuestion.options
      : isRoleta
        ? ["Resposta A", "Resposta B", "Resposta C", "Resposta D"]
        : isTabuleiro
          ? ["A", "B", "C"]
          : ["Opção A", "Opção B"];

    const newTarget = {
      title: poolQuestion
        ? poolQuestion.question
        : isRoleta || isTabuleiro
          ? "NOVA PERGUNTA DO JOGO"
          : isEsmaga
            ? "NOVA PALAVRA"
            : "Novo Alvo",
      question: poolQuestion ? poolQuestion.question : "",
      description:
        (isRoleta || isTabuleiro || isEsmaga) && !poolQuestion
          ? "Clique para editar o conteúdo."
          : "",
      options: finalOptions,
      answer: poolQuestion ? poolQuestion.answer : finalOptions[0],
      isCorrect: true,
      points: 15,
      feedback: "",
    };

    onAdd("targets", newTarget);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between pb-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-orange-50 rounded-xl">
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-orange-500 font-black text-lg">5.1</span>
              <h3 className="text-slate-800 font-black uppercase tracking-widest text-[11px]">
                Lógica do Jogo
              </h3>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-left-2 duration-500">
              {gameType}
            </span>
          </div>
        </div>
        <button
          onClick={handleAddTarget}
          disabled={
            (gameType === "Roleta" && targets.length >= 10) ||
            (gameType === "Jogo de Tiro ao Alvo" && targets.length >= 25) ||
            (gameType === "Jogo de Plataforma 2D" && targets.length >= 5)
          }
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-lg active:scale-95 ${
            (gameType === "Roleta" && targets.length >= 10) ||
            (gameType === "Jogo de Tiro ao Alvo" && targets.length >= 25) ||
            (gameType === "Jogo de Plataforma 2D" && targets.length >= 5)
              ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/20"
          }`}
        >
          <Zap
            className={`w-3.5 h-3.5 ${(gameType === "Roleta" && targets.length >= 10) || (gameType === "Jogo de Tiro ao Alvo" && targets.length >= 25) || (gameType === "Jogo de Plataforma 2D" && targets.length >= 5) ? "text-slate-100" : "fill-white"}`}
          />
          {gameType === "Roleta" || gameType === "Tabuleiro"
            ? targets.length >= 10
              ? "Limite de Casas Atingido"
              : "+ Adicionar Casa"
            : gameType === "Esmaga Palavras"
              ? targets.length >= 30
                ? "Limite de Palavras Atingido"
                : "+ Adicionar Palavra"
              : gameType === "Jogo de Tiro ao Alvo"
                ? targets.length >= 25
                  ? "Limite de Alvos Atingido"
                  : "+ Adicionar Alvo"
                : gameType === "Jogo de Plataforma 2D"
                  ? targets.length >= 5
                    ? "Limite de Questões Atingido"
                    : "+ Adicionar Pergunta"
                  : "+ Novo Elemento"}
        </button>
      </div>
      <div className="p-8 md:p-10 space-y-10">
        <Field
          label="COMO JOGAR"
          value={howToPlay}
          onChange={(val: string) => onEdit("howToPlay", val)}
        />

        {/* Renderização especial por Tipo de Jogo */}
        {gameType === "Memória" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-teal-600/80 uppercase tracking-widest">
                  Pares de Cartas — {targets.length} par
                  {targets.length !== 1 ? "es" : ""}
                </p>
                <p className="text-[9px] text-teal-400 font-bold uppercase italic">
                  🃏 Total de 16 cartas no tabuleiro
                </p>
              </div>
              <div className="bg-teal-50 px-4 py-2 rounded-2xl border border-teal-100">
                <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest leading-none">
                  Modo Memória Ativo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {targets.map((target, i) => (
                <div
                  key={i}
                  className="group/mem bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-teal-200 transition-all relative"
                >
                  <button
                    onClick={() => onRemove("targets", i)}
                    className="absolute -top-2 -right-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/mem:opacity-100 bg-white rounded-full shadow-md z-20"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                  {/* Cabeçalho do Par */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                      {i + 1}
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-100">
                      <span className="text-[9px] font-black uppercase tracking-widest text-teal-600">
                        Carta
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative bg-teal-50/30 border border-teal-100 rounded-xl p-3 hover:bg-white transition-all">
                      <Field
                        label="Frente (Título)"
                        value={toStr(target.title)}
                        onChange={(val: string) =>
                          onEdit(`targets[${i}].title`, val)
                        }
                      />
                    </div>
                    <div className="relative bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-3 hover:bg-white transition-all">
                      <Field
                        label="Verso (Par)"
                        value={toStr(
                          target.description || target.feedback || "",
                        )}
                        onChange={(val: string) =>
                          onEdit(`targets[${i}].description`, val)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : gameType === "Jogo de Tiro ao Alvo" ? (
          <div className="space-y-12">
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black text-rose-600/80 uppercase tracking-widest">
                  Configuração de Desafios — {Math.ceil(targets.length / 5)}{" "}
                  Fase(s)
                </p>
                <p className="text-[9px] text-rose-400 font-bold uppercase italic">
                  🎯 Perguntas com 1 Alvo Correto e 1 Inimigo
                </p>
              </div>
              <div className="bg-rose-50 px-4 py-2 rounded-2xl border border-rose-100 flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none">
                  Mira Ativa
                </span>
              </div>
            </div>

            <div className="space-y-16">
              {(() => {
                // Agrupa alvos por questão para exibição organizada
                const groups: {
                  question: string;
                  items: any[];
                  originalIndices: number[];
                }[] = [];
                targets.forEach((t, idx) => {
                  // Normalização agressiva para agrupar mesmo com espaços ou pontuação diferente
                  const qRaw = (
                    t.question ||
                    (t as any).pergunta ||
                    (t as any).enunciado ||
                    ""
                  ).trim();
                  const normalizedQ =
                    qRaw.toLowerCase().replace(/[^a-z0-9]/g, "") ||
                    `_auto_group_${Math.floor(idx / 5)}`;

                  let group = groups.find(
                    (g) =>
                      g.question.toLowerCase().replace(/[^a-z0-9]/g, "") ===
                      normalizedQ,
                  );
                  if (!group) {
                    group = {
                      question: qRaw || `Pergunta ${Math.floor(idx / 5) + 1}`,
                      items: [],
                      originalIndices: [],
                    };
                    groups.push(group);
                  }
                  group.items.push(t);
                  group.originalIndices.push(idx);
                });

                // Se agrupou errado, forçamos agrupamento por 2 (padrão atual do jogo)
                if (
                  gameType === "Jogo de Tiro ao Alvo" &&
                  groups.length > Math.ceil(targets.length / 2) &&
                  targets.length > 0
                ) {
                  const forcedGroups: typeof groups = [];
                  for (let i = 0; i < targets.length; i += 2) {
                    const t = targets[i];
                    forcedGroups.push({
                      question:
                        t?.question ||
                        (t as any)?.pergunta ||
                        (t as any)?.enunciado ||
                        `Pergunta ${Math.floor(i / 2) + 1}`,
                      items: targets.slice(i, i + 2),
                      originalIndices: Array.from(
                        { length: Math.min(2, targets.length - i) },
                        (_, k) => i + k,
                      ),
                    });
                  }
                  return forcedGroups.map((group, groupIdx) =>
                    renderGroup(group, groupIdx),
                  );
                }

                return groups.map((group, groupIdx) =>
                  renderGroup(group, groupIdx),
                );

                function renderGroup(group: any, groupIdx: number) {
                  return (
                    <div
                      key={groupIdx}
                      className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700"
                      style={{ animationDelay: `${groupIdx * 100}ms` }}
                    >
                      <div className="flex items-center gap-4 bg-blue-50/80 p-4 rounded-2xl border border-blue-100/50 shadow-sm relative overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0 relative z-10">
                          {groupIdx + 1}
                        </div>
                        <div className="flex-1 relative z-10">
                          <Field
                            label="DESAFIO / PERGUNTA"
                            value={group.question}
                            onChange={(val: string) => {
                              group.originalIndices.forEach((idx: number) =>
                                onEdit(`targets[${idx}].question`, val),
                              );
                            }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const indicesToRemove = [
                              ...group.originalIndices,
                            ].reverse();
                            indicesToRemove.forEach((idx: number) =>
                              onRemove("targets", idx),
                            );
                          }}
                          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-4xl">
                        {group.items.map((target: any, itemIdx: number) => {
                          const originalIdx = group.originalIndices[itemIdx];
                          return (
                            <div
                              key={itemIdx}
                              className={`group/hit relative p-2 px-3 rounded-xl border transition-all duration-300 ${
                                target.isCorrect
                                  ? "bg-emerald-50/30 border-emerald-100 hover:border-emerald-300"
                                  : "bg-rose-50/30 border-rose-100 hover:border-rose-300"
                              } flex items-center gap-2`}
                            >
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${target.isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}
                              >
                                {target.isCorrect ? (
                                  <Target className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                              </div>
                              <div className="flex-1 space-y-1">
                                <Field
                                  label={target.isCorrect ? "ALVO CORRETO" : "INIMIGO / DISTRATOR"}
                                  value={target.title}
                                  onChange={(val: string) =>
                                    onEdit(`targets[${originalIdx}].title`, val)
                                  }
                                />
                                <div className="mt-2 bg-white/80 p-3 rounded-xl border border-slate-200 shadow-inner">
                                  <Field
                                    label="Explicação / Feedback"
                                    value={toStr(
                                      target.description ||
                                        target.feedback ||
                                        "",
                                    )}
                                    onChange={(val: string) =>
                                      onEdit(
                                        `targets[${originalIdx}].description`,
                                        val,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        ) : gameType === "Jogo de Plataforma 2D" ? (
          <PlatformerSection
            targets={targets}
            hints={thematicHints}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ) : (gameType || "").toLowerCase().includes("quebra") ? (
          <PuzzleSection
            targets={targets}
            gameLogic={gameLogic}
            onEdit={onEdit}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ) : gameType === "Roleta" ? (
          null
        ) : (
          <HouseQuizTargets
            targets={targets}
            gameType={gameType}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-slate-100">
          <SummaryItem
            icon={<Clock className="w-4 h-4 text-slate-400" />}
            label="Tempo Sugerido"
            value={timeLimit}
            onChange={(val: string) => onEdit("timeLimit", val)}
          />
          <SummaryItem
            icon={<Layers className="w-4 h-4 text-slate-400" />}
            label="Total de Fases"
            value={levels}
            onChange={(val: string) => onEdit("levels", val)}
          />
          <SummaryItem
            icon={<BarChart2 className="w-4 h-4 text-slate-400" />}
            label="Dificuldade"
            value={difficulty}
            onChange={(val: string) => onEdit("difficulty", val)}
          />
        </div>
      </div>
    </div>
  );
};

// --- Seção 4: Mecânicas e Tarefas ---
const MechanicsSection: React.FC<{
  mechanics?: {
    technicalRules: string;
    timeControl: string;
    challengesPerPhase: string;
    feedbackSystem: string;
    scoringSystem: string;
    collectibleItems: string;
  };
  gameType: string;
  onEdit: (field: string, value: any) => void;
}> = ({ mechanics, gameType, onEdit }) => {
  const isPlatformer = gameType.toLowerCase().includes("plataforma");

  // Fallbacks por tipo de jogo para campos vazios / projetos antigos
  const fallbacks: Record<string, Record<string, string>> = {
    "Roleta": {
      technicalRules: "O aluno gira a roleta e responde à pergunta da casa onde a seta parar. Casas Dica revelam informações extras e casas de Penalidade subtraem pontos. Modo equipes ou individual com rodadas alternadas.",
      timeControl: "30 segundos por pergunta. Após 3 erros consecutivos, reduz para 20 segundos. Duração máxima: 20 minutos.",
      challengesPerPhase: "Fase 1: casas de Quiz e Dica. Fase 2: surgem casas de Penalidade. Fase 3: casas bônus com perguntas difíceis.",
      scoringSystem: "+15 por resposta correta. -10 em casas penalidade. +25 em casas bônus. Mínimo 30 pts para avançar.",
    },
    "Quiz": {
      technicalRules: "O aluno escolhe uma das 2 alternativas e recebe feedback imediato. Perguntas exibidas em sequência sem possibilidade de revisitar.",
      timeControl: "30 segundos por pergunta. Tempo total: 2 a 3 minutos para 5 perguntas.",
      challengesPerPhase: "5 perguntas de dificuldade crescente: 2 básicas, 2 intermediárias e 1 avançada.",
      scoringSystem: "+15 por acerto. +5 bônus em menos de 10 segundos. Máximo: 100 pontos.",
    },
    "Tabuleiro": {
      technicalRules: "Jogadores avançam peças lançando dados. Na casa de pergunta, respondem para permanecer. Casas especiais aceleram ou regridem o jogador.",
      timeControl: "20 segundos por pergunta. Partida: 20 a 30 minutos para 2-4 jogadores.",
      challengesPerPhase: "Zona inicial (básico), zona média (azar) e zona final (difícil + bônus).",
      scoringSystem: "+20 casas bônus. -10 casas armadilha. +15 resposta correta. Maior pontuação vence.",
    },
    "Memória": {
      technicalRules: "Cartas viradas para baixo — vira 2 por vez. Par (conceito + definição) permanece aberto. Quem achar mais pares vence.",
      timeControl: "15 segundos para avaliar cada par. Duração: 5 a 8 minutos. Modo desafio: 3 minutos.",
      challengesPerPhase: "Fase 1: 4 pares básicos. Fase 2: 6 pares medianos. Fase 3: 8 pares avançados.",
      scoringSystem: "+10 por par. +5 bônus na primeira tentativa. -2 por erro. Máximo: 60 pontos.",
    },
    "Jogo de Tiro ao Alvo": {
      technicalRules: "Alvos corretos e inimigos surgem na tela. Clique no correto para ganhar pontos. Inimigos atingidos subtraem pontos.",
      timeControl: "45 segundos por rodada. Cada alvo visível por 5 segundos. 3 rodadas crescentes.",
      challengesPerPhase: "Fase 1: 1 correto e 1 inimigo. Fase 2: mais rápido. Fase 3: alvos menores e 2 inimigos.",
      scoringSystem: "+15 por acerto. -10 por inimigo. +5 bônus em acertos consecutivos. Máximo: 75 pontos.",
    },
    "Jogo de Plataforma 2D": {
      technicalRules: "Personagem corre, pula e coleta itens evitando inimigos. Para superar chefes, responde perguntas pedagógicas que surgem na tela.",
      timeControl: "3 minutos por fase. Total: 3 fases = 9 minutos.",
      challengesPerPhase: "Fase 1: 1 inimigo simples + 1 pergunta. Fase 2: 2 inimigos + 2 perguntas. Fase 3: chefe + 2 avançadas.",
      scoringSystem: "+10 item coletado. +20 inimigo derrotado. +50 chefe vencido. -10 por vida perdida. Máximo: 200 pts.",
    },
    "Jogo da Velha": {
      technicalRules: "Para marcar uma casa do 3x3, o aluno responde corretamente. Quem formar linha/coluna/diagonal vence. Erro cede a vez.",
      timeControl: "30 segundos por pergunta. Sem resposta, a vez passa. Partida: 5 a 10 minutos.",
      challengesPerPhase: "5 perguntas — bordas fáceis, centro difícil. Cada casa aborda um subtema.",
      scoringSystem: "+15 por acerto. +30 bônus por linha/coluna/diagonal. -5 por erro. Máximo: 75 pontos.",
    },
    "Esmaga Palavras": {
      technicalRules: "Palavras-chave surgem e o aluno clica apenas nas que correspondem à definição exibida. Palavras erradas subtraem pontos.",
      timeControl: "60 segundos por rodada. Cada palavra visível por 3 segundos. 3 rodadas crescentes.",
      challengesPerPhase: "Fase 1: palavras simples. Fase 2: palavras similares. Fase 3: mistura acelerada.",
      scoringSystem: "+10 por correta. -5 por incorreta. +15 bônus fase sem erros. Máximo: 75 pontos.",
    },
    "Enigmas Movimento": {
      technicalRules: "O aluno resolve enigmas respondendo perguntas de direção. Correta move o personagem na direção indicada; errada move na oposta.",
      timeControl: "60 segundos por enigma. Total: 5 minutos. Ignorar enigma = -5 pontos.",
      challengesPerPhase: "5 enigmas por fase: simples, combinados e sequências de movimento.",
      scoringSystem: "+15 por enigma resolvido. +5 bônus por rapidez. -5 por ignorar. Máximo: 100 pontos.",
    },
  };

  const getFallback = (field: string): string => {
    const gameKey = Object.keys(fallbacks).find(k => gameType.includes(k)) || "";
    return fallbacks[gameKey]?.[field] || "";
  };

  const getFieldValue = (field: string): string => {
    const val = (mechanics as any)?.[field] || "";
    if (!val || val.startsWith("[GERE:")) return getFallback(field);
    return val;
  };

  const fields: {
    icon: React.ReactNode;
    label: string;
    field: string;
    description: string;
  }[] = [
    {
      icon: <Cog className="w-4 h-4 text-orange-500" />,
      label: "REGRAS TÉCNICAS",
      field: "technicalRules",
      description: "Ações repetitivas e regras estruturais do jogo",
    },
    {
      icon: <Timer className="w-4 h-4 text-orange-500" />,
      label: "CONTROLE DE TEMPO",
      field: "timeControl",
      description: "Tempo por rodada, fase ou duração total",
    },
    {
      icon: <LayoutList className="w-4 h-4 text-orange-500" />,
      label: "DESAFIOS POR FASE",
      field: "challengesPerPhase",
      description: "Quantidade e organização dos desafios em cada fase",
    },
    {
      icon: <Award className="w-4 h-4 text-orange-500" />,
      label: "SISTEMA DE PONTUAÇÃO",
      field: "scoringSystem",
      description: "Regras de pontuação, bônus e penalidades",
    },
  ];

  return (
    <SectionCard
      number="4"
      title="Mecânicas e Tarefas"
      icon={<Cog className="w-5 h-5 text-orange-500" />}
      headerColor="bg-orange-50/60 border-orange-100/60"
    >
      <p className="text-xs text-slate-400 font-medium leading-relaxed mb-8 px-1">
        Estipula as regras técnicas e as ações repetitivas do jogo. Define
        controles de tempo, desafios e feedback.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {fields.map((f, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              {f.icon}
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none">
                {f.label}
              </span>
            </div>
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 transition-all focus-within:bg-white focus-within:shadow-md group">
              <Field
                label=""
                value={getFieldValue(f.field)}
                onChange={(val: string) => onEdit(f.field, val)}
              />
              <p className="text-[9px] text-slate-400 mt-2 opacity-0 group-focus-within:opacity-100 transition-opacity italic">
                {f.description}
              </p>
            </div>
          </div>
        ))}

        {isPlatformer && (
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2 px-1">
              <Gem className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none">
                ITENS COLETÁVEIS
              </span>
            </div>
            <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100/50 transition-all focus-within:bg-white focus-within:shadow-md group">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[8px] font-bold uppercase tracking-wider">
                  Modo Plataforma
                </span>
              </div>
              <Field
                label=""
                value={mechanics?.collectibleItems || ""}
                onChange={(val: string) => onEdit("collectibleItems", val)}
              />
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
};

// ─── DragAndDropCanvas ────────────────────────────────────────────────────────
interface Shape {
  id: string;
  type: "square" | "circle" | "triangle" | "hexagon" | "trapezoid";
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
}

const INITIAL_SHAPES: Shape[] = [
  {
    id: "sq",
    type: "square",
    x: 60,
    y: 60,
    size: 70,
    color: "#6366f1",
    label: "Quadrado",
  },
  {
    id: "ci",
    type: "circle",
    x: 220,
    y: 70,
    size: 70,
    color: "#f43f5e",
    label: "Círculo",
  },
  {
    id: "tr",
    type: "triangle",
    x: 370,
    y: 55,
    size: 80,
    color: "#10b981",
    label: "Triângulo",
  },
  {
    id: "hx",
    type: "hexagon",
    x: 520,
    y: 60,
    size: 70,
    color: "#f59e0b",
    label: "Hexágono",
  },
  {
    id: "tp",
    type: "trapezoid",
    x: 670,
    y: 70,
    size: 75,
    color: "#8b5cf6",
    label: "Trapézio",
  },
];

// Polyfill para roundRect (não disponível em todos os browsers)
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  isActive: boolean,
) {
  const { type, x, y, size, color } = shape;
  ctx.save();
  ctx.shadowColor = isActive ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.12)";
  ctx.shadowBlur = isActive ? 24 : 10;
  ctx.shadowOffsetY = isActive ? 8 : 3;
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 3;

  const halfSize = size / 2;

  ctx.beginPath();
  if (type === "square") {
    drawRoundedRect(ctx, x - halfSize, y - halfSize, size, size, 14);
  } else if (type === "circle") {
    ctx.arc(x, y, halfSize, 0, Math.PI * 2);
  } else if (type === "triangle") {
    ctx.moveTo(x, y - halfSize);
    ctx.lineTo(x + halfSize, y + halfSize);
    ctx.lineTo(x - halfSize, y + halfSize);
    ctx.closePath();
  } else if (type === "hexagon") {
    for (let k = 0; k < 6; k++) {
      const angle = (Math.PI / 3) * k - Math.PI / 6;
      const px = x + halfSize * Math.cos(angle);
      const py = y + halfSize * Math.sin(angle);
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (type === "trapezoid") {
    const top = size * 0.55;
    ctx.moveTo(x - top / 2, y - halfSize * 0.7);
    ctx.lineTo(x + top / 2, y - halfSize * 0.7);
    ctx.lineTo(x + halfSize, y + halfSize * 0.7);
    ctx.lineTo(x - halfSize, y + halfSize * 0.7);
    ctx.closePath();
  }

  ctx.fill();
  ctx.stroke();

  // Label
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `bold ${Math.round(size * 0.17)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(shape.label, x, type === "triangle" ? y + halfSize * 0.25 : y);

  ctx.restore();
}

const HouseQuizTargets: React.FC<{ targets: any[], gameType: string, onEdit?: any, onRemove?: any }> = ({ targets, gameType, onEdit, onRemove }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 export-compact-grid">
    {targets.map((target, i) => {
      const targetTitleLabel = (target.title || "").toUpperCase();
      const isHouseType = gameType === "Roleta" || gameType === "Tabuleiro";
      const isDragDrop = gameType === "Arrastar e Soltar";
      const isQuizMode = gameType === "Quiz" || gameType === "Jogo da Velha" || gameType === "Sliding Puzzle";
      
      const isHouseTip = (isHouseType || isDragDrop) && 
        (targetTitleLabel === "DICA" || targetTitleLabel === "INFORMAÇÃO" || targetTitleLabel === "CONCEITO" || targetTitleLabel === "INFORMATIVO" || !target.options || target.options.length === 0) && 
        target.isCorrect;
      
      const isHouseQuiz = (isHouseType || isDragDrop || isQuizMode) && target.isCorrect && !isHouseTip;

      return (
        <div 
          key={i} 
          className={`p-4 rounded-[1.5rem] border transition-all duration-300 relative group/target export-compact-target ${
            target.isCorrect ? (isHouseTip ? "bg-amber-50/50 border-amber-100" : "bg-emerald-50/50 border-emerald-100") : "bg-rose-50/50 border-rose-100"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit && onRemove && (isHouseType || isDragDrop) && (target as any)._toggleType?.(i)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                    target.isCorrect ? (isHouseTip ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600") : "bg-rose-100 text-rose-500"
                  }`}
                >
                  {target.isCorrect ? (isHouseTip ? <Lightbulb className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />) : <X className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">
                  {target.isCorrect ? (isHouseTip ? "Informação" : "Pergunta") : "Penalidade"}
                </span>
             </div>
             {onRemove && (
               <button onClick={() => onRemove("targets", i)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover/target:opacity-100 transition-opacity">
                 <XCircle className="w-4 h-4" />
               </button>
             )}
          </div>
          <div className="space-y-2">
            {onEdit ? (
              <Field label="" value={target.title} onChange={(v) => onEdit(`targets[${i}].title`, v)} />
            ) : (
              <p className="text-[11px] font-bold text-slate-800 line-clamp-2">{target.title}</p>
            )}
            
            {isHouseQuiz && target.options && (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {target.options.slice(0, 2).map((opt: string, optIdx: number) => {
                  const isCorrect = isCorrectAnswer(opt, target.answer || "", optIdx) || (target.answer === undefined && optIdx === 0);
                  return (
                    <div 
                      key={optIdx} 
                      onClick={() => onEdit && onEdit(`targets[${i}].answer`, opt)}
                      className={`px-2 py-1 rounded-lg border text-[9px] font-medium transition-all ${
                        isCorrect ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" : "bg-slate-50 border-slate-100 text-slate-400"
                      } ${onEdit ? "cursor-pointer" : ""}`}
                    >
                      {onEdit ? (
                        <Field label="" value={opt} onChange={(v) => {
                          const newOpts = [...target.options];
                          newOpts[optIdx] = v;
                          onEdit(`targets[${i}].options`, newOpts);
                        }} />
                      ) : opt}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

function hitTest(shape: Shape, mx: number, my: number): boolean {
  const { type, x, y, size } = shape;
  const halfSize = size / 2;
  if (type === "circle") {
    return Math.hypot(mx - x, my - y) <= halfSize;
  }
  // AABB for all others
  return (
    mx >= x - halfSize &&
    mx <= x + halfSize &&
    my >= y - halfSize &&
    my <= y + halfSize
  );
}

const DragAndDropCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<Shape[]>(INITIAL_SHAPES);
  const shapesRef = useRef<Shape[]>(INITIAL_SHAPES);
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Keep ref in sync
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 20);
    ctx.fill();

    // Drop Zones (Encaixe Aqui - Shape Specific Ghosts)
    INITIAL_SHAPES.forEach((s) => {
      const dropX = s.x;
      const dropY = s.y + 160; // Deslocamento para baixo

      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(241, 245, 249, 0.5)";

      const size = s.size;
      const halfSize = size / 2;

      ctx.beginPath();
      if (s.type === "square") {
        drawRoundedRect(
          ctx,
          dropX - halfSize,
          dropY - halfSize,
          size,
          size,
          14,
        );
      } else if (s.type === "circle") {
        ctx.arc(dropX, dropY, halfSize, 0, Math.PI * 2);
      } else if (s.type === "triangle") {
        ctx.moveTo(dropX, dropY - halfSize);
        ctx.lineTo(dropX + halfSize, dropY + halfSize);
        ctx.lineTo(dropX - halfSize, dropY + halfSize);
        ctx.closePath();
      } else if (s.type === "hexagon") {
        for (let k = 0; k < 6; k++) {
          const angle = (Math.PI / 3) * k - Math.PI / 6;
          const px = dropX + halfSize * Math.cos(angle);
          const py = dropY + halfSize * Math.sin(angle);
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else if (s.type === "trapezoid") {
        const top = size * 0.55;
        ctx.moveTo(dropX - top / 2, dropY - halfSize * 0.7);
        ctx.lineTo(dropX + top / 2, dropY - halfSize * 0.7);
        ctx.lineTo(dropX + halfSize, dropY + halfSize * 0.7);
        ctx.lineTo(dropX - halfSize, dropY + halfSize * 0.7);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Label for zone
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 8px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ENCAIXE", dropX, dropY);
    });

    // Grid
    ctx.strokeStyle = "rgba(148,163,184,0.1)";
    ctx.lineWidth = 1;
    for (let gx = 40; gx < canvas.width; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
    for (let gy = 40; gy < canvas.height; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }

    // Draw non-active shapes first, then active on top
    const activeId = dragRef.current?.id;
    shapesRef.current
      .filter((s) => s.id !== activeId)
      .forEach((s) => drawShape(ctx, s, false));
    if (activeId) {
      const active = shapesRef.current.find((s) => s.id === activeId);
      if (active) drawShape(ctx, active, true);
    }
  }, []);

  useEffect(() => {
    draw();
  }, [shapes, draw]);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const { x, y } = getPos(e, canvas);
      // Hit test from top (last in array = topmost visually)
      const hit = [...shapesRef.current]
        .reverse()
        .find((s) => hitTest(s, x, y));
      if (!hit) return;
      dragRef.current = { id: hit.id, offsetX: x - hit.x, offsetY: y - hit.y };
      // Bring to top
      setShapes((prev) => {
        const rest = prev.filter((s) => s.id !== hit.id);
        const found = prev.find((s) => s.id === hit.id)!;
        return [...rest, found];
      });
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const { x, y } = getPos(e, canvas);
      const { id, offsetX, offsetY } = dragRef.current;
      setShapes((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, x: x - offsetX, y: y - offsetY } : s,
        ),
      );
    };

    const onUp = () => {
      dragRef.current = null;
      draw();
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [draw]);

  const handleReset = () => {
    setShapes(INITIAL_SHAPES);
    shapesRef.current = INITIAL_SHAPES;
  };

  // Export canvas as PNG dataURL for PDF printing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    (canvas as any).__getExportDataURL = () => canvas.toDataURL("image/png");
  });

  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden"
      id="drag-drop-canvas-section"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-violet-50/50 border-violet-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Move className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-violet-200 font-black text-lg">6</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[11px]">
              Canvas Drag &amp; Drop
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            Arraste as formas livremente
          </span>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-violet-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-600 transition-all active:scale-95 cursor-pointer"
          >
            Resetar
          </button>
        </div>
      </div>
      <div className="p-8">
        <div className="flex gap-3 mb-4">
          {INITIAL_SHAPES.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: s.color }}
              />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="w-full rounded-2xl border border-slate-100 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
        />
        <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest text-center mt-4">
          Clique e arraste qualquer forma para reposicioná-la
        </p>
      </div>
    </div>
  );
};

// --- RoletaPreview ---
export const RoletaPreview: React.FC<{
  targets: any[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}> = ({ targets, onUpdate, onRemove, onAdd }) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [landed, setLanded] = useState<number | null>(null);

  // Monta segmentos: usa os targets ou gera defaults (Sempre entre 8 e 10 casas)
  const segments = (targets && targets.length > 0 ? targets : [
    { title: "Pergunta 1", isCorrect: true, points: 15, options: ["Correta", "Incorreta"], answer: "Correta" },
    { title: "Dica Pedagógica", isCorrect: true, points: 0, description: "Conteúdo importante sobre o tema" },
    { title: "Penalidade", isCorrect: false, points: -10, feedback: "Tente novamente!" },
    { title: "Pergunta 2", isCorrect: true, points: 15, options: ["Sim", "Não"], answer: "Sim" },
    { title: "Dica", isCorrect: true, points: 0, description: "Informação complementar" },
    { title: "Penalidade", isCorrect: false, points: -10 },
    { title: "Pergunta 3", isCorrect: true, points: 15, options: ["Opção A", "Opção B"], answer: "Opção A" },
    { title: "Bônus Especial", isCorrect: true, points: 25 },
    { title: "Pergunta 4", isCorrect: true, points: 15, options: ["Certo", "Errado"], answer: "Certo" },
    { title: "Pergunta 5", isCorrect: true, points: 15, options: ["Verdadeiro", "Falso"], answer: "Verdadeiro" },
  ]).slice(0, 10);

  const segCount = segments.length;
  const segAngle = 360 / segCount;

  // Cores por tipo de casa
  const getColor = (t: any, i: number) => {
    const title = (t.title || "").toLowerCase();
    if (title.includes("dica") || title.includes("tip")) return ["#f59e0b", "#d97706"];
    if (title.includes("penali") || title.includes("perd") || t.isCorrect === false) return ["#f43f5e", "#e11d48"];
    if (title.includes("bônus") || title.includes("bonus")) return ["#10b981", "#059669"];
    // quiz / pergunta alternados
    const colors = [["#6366f1", "#4f46e5"], ["#8b5cf6", "#7c3aed"], ["#3b82f6", "#2563eb"]];
    return colors[i % colors.length];
  };

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setLanded(null);
    const extraSpins = 5 + Math.floor(Math.random() * 5); // 5-9 full rotations
    const targetAngle = Math.floor(Math.random() * 360);
    const total = extraSpins * 360 + targetAngle;
    setRotation(prev => prev + total);
    setTimeout(() => {
      setSpinning(false);
      // Calcula qual segmento ficou no topo (seta aponta para cima = 270 deg do svg)
      const finalAngle = (rotation + total) % 360;
      const landed = Math.floor(((360 - finalAngle + 270) % 360) / segAngle) % segCount;
      setLanded(landed);
    }, 3500);
  };

  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden"
      id="roleta-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-amber-50/50 border-amber-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-amber-300 font-black text-lg">5</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[11px]">
              Preview Roleta Interativa
            </span>
          </div>
        </div>
        <button
          onClick={handleSpin}
          disabled={spinning}
          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer shadow-md ${
            spinning
              ? "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
              : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-300/40"
          }`}
        >
          {spinning ? "Girando..." : "🎰 Girar!"}
        </button>
      </div>

      <div className="p-8 flex flex-col md:flex-row items-center gap-12 justify-center">
        {/* Wheel */}
        <div className="relative flex-shrink-0">
          {/* Arrow pointer */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-slate-800 drop-shadow-md" />
          </div>

          {/* Wheel SVG */}
          <svg
            width={240}
            height={240}
            viewBox="0 0 240 240"
            style={{
              transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "120px 120px",
            }}
          >
            {segments.map((seg, i) => {
              const startAngle = i * segAngle - 90;
              const endAngle = startAngle + segAngle;
              const r = 110;
              const cx = 120;
              const cy = 120;
              const toRad = (d: number) => (d * Math.PI) / 180;
              const x1 = cx + r * Math.cos(toRad(startAngle));
              const y1 = cy + r * Math.sin(toRad(startAngle));
              const x2 = cx + r * Math.cos(toRad(endAngle));
              const y2 = cy + r * Math.sin(toRad(endAngle));
              const largeArc = segAngle > 180 ? 1 : 0;
              const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              const [fill, stroke] = getColor(seg, i);
              // Text angle
              const midAngle = startAngle + segAngle / 2;
              const tr = r * 0.65;
              const tx = cx + tr * Math.cos(toRad(midAngle));
              const ty = cy + tr * Math.sin(toRad(midAngle));
              const label = (seg.title || "Casa").slice(0, 14);

              return (
                <g key={i}>
                  <path d={pathD} fill={fill} stroke={stroke} strokeWidth={2} />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={segCount > 8 ? 7 : 9}
                    fontWeight="900"
                    fill="white"
                    transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            {/* Center hub */}
            <circle cx={120} cy={120} r={16} fill="#1e293b" stroke="#334155" strokeWidth={3} />
            <circle cx={120} cy={120} r={8} fill="#f8fafc" />
          </svg>

          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full border-[6px] border-slate-800 shadow-[0_8px_32px_rgba(0,0,0,0.25)] pointer-events-none"
            style={{ borderRadius: "50%" }}
          />
        </div>

        {/* Legend + Result */}
        <div className="space-y-6 max-w-xs w-full">
          {/* Landed result */}
          {landed !== null && !spinning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-2xl border-2 text-center"
              style={{
                background: getColor(segments[landed], landed)[0] + "15",
                borderColor: getColor(segments[landed], landed)[0],
              }}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: getColor(segments[landed], landed)[0] }}>
                Casa Escolhida
              </p>
              <p className="text-sm font-black text-slate-800 leading-tight">
                {segments[landed].title || "—"}
              </p>
              {segments[landed].options?.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {segments[landed].options.slice(0, 2).map((opt: string, oi: number) => (
                    <div key={oi} className={`px-2 py-1.5 rounded-lg text-[9px] font-bold border ${
                      opt === segments[landed].answer
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : "bg-slate-50 text-slate-500 border-slate-200"
                    }`}>
                      {opt}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Casa types legend */}
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipos de Casa</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Pergunta", color: "#6366f1" },
                { label: "Dica", color: "#f59e0b" },
                { label: "Penalidade", color: "#f43f5e" },
                { label: "Bônus", color: "#10b981" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mechanics hint */}
          <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl">
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Mecânica</p>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              O aluno gira a roleta e cai em uma das{" "}
              <span className="text-amber-600 font-bold">{segCount} casas</span>. Casas de{" "}
              <span className="text-indigo-500 font-bold">Pergunta</span> exigem resposta correta para pontuar.
              Casas de <span className="text-amber-500 font-bold">Dica</span> revelam conteúdo pedagógico.
              Casas de <span className="text-rose-500 font-bold">Penalidade</span> subtraem pontos.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
              📋 Conteúdo das {segments.length} Casas
            </p>
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors shadow-sm"
            >
              <Plus className="w-3 h-3" /> Adicionar Casa
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {segments.map((seg: any, i: number) => {
              const [color] = getColor(seg, i);
              const title = (seg.title || "").toLowerCase();
              const isDica = title.includes("dica") || title.includes("tip");
              const isPenal = title.includes("penali") || title.includes("perd") || seg.isCorrect === false;
              const isBonus = title.includes("bônus") || title.includes("bonus");
              const isQuiz = !isDica && !isPenal && !isBonus;
              const typeLabel = isPenal ? "Penalidade" : isDica ? "Dica" : isBonus ? "Bônus" : "Pergunta";

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative rounded-2xl border overflow-hidden transition-all hover:shadow-md"
                  style={{ borderColor: color + "40", background: color + "07" }}
                >
                  {/* Accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
                  <div className="pl-5 pr-4 py-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-md text-[8px] font-black flex items-center justify-center text-white shrink-0"
                          style={{ background: color }}
                        >
                          {i + 1}
                        </span>
                        <select
                          value={typeLabel}
                          onChange={(e) => {
                            const nt = e.target.value;
                            let newTitle = seg.title || "";
                            // Remove old tags if present to avoid "Dica Dica"
                            newTitle = newTitle.replace(/^(Dica|Penalidade|Bônus|Pergunta):\s*/i, "");
                            
                            // Adjust title based on type selection if needed
                            let updatedTitle = newTitle;
                            if (nt === "Dica" && !newTitle.toLowerCase().includes("dica")) updatedTitle = `Dica: ${newTitle}`;
                            if (nt === "Penalidade" && !newTitle.toLowerCase().includes("penali")) updatedTitle = `Penalidade: ${newTitle}`;
                            if (nt === "Bônus" && !newTitle.toLowerCase().includes("bônus")) updatedTitle = `Bônus: ${newTitle}`;
                            
                            onUpdate(i, "title", updatedTitle);
                            onUpdate(i, "isCorrect", nt !== "Penalidade");
                            // Adjust points automatically
                            if (nt === "Penalidade") onUpdate(i, "points", -10);
                            if (nt === "Bônus") onUpdate(i, "points", 25);
                            if (nt === "Dica") onUpdate(i, "points", 0);
                            if (nt === "Pergunta") onUpdate(i, "points", 15);
                          }}
                          className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border outline-none bg-white cursor-pointer"
                          style={{ color, borderColor: color + "40" }}
                        >
                          <option value="Pergunta">Pergunta</option>
                          <option value="Dica">Dica</option>
                          <option value="Penalidade">Penalidade</option>
                          <option value="Bônus">Bônus</option>
                        </select>
                      </div>
                      <button
                        onClick={() => onRemove(i)}
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                        title="Remover casa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Pergunta / Título */}
                    <div className="mb-1.5 min-h-[1.5em] group/edit">
                      <Field
                        value={seg.title}
                        onChange={(val) => onUpdate(i, "title", val)}
                        label=""
                      />
                    </div>

                    {/* Descrição / Dica */}
                    <div className="mb-2 min-h-[1em] opacity-80 group/edit">
                      <Field
                        value={seg.description}
                        onChange={(val) => onUpdate(i, "description", val)}
                        label=""
                      />
                    </div>

                    {/* Alternativas — apenas casas de Pergunta */}
                    {isQuiz && seg.options && seg.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        {seg.options.slice(0, 2).map((opt: string, oi: number) => {
                          const correct =
                            seg.answer
                              ? opt.trim().toLowerCase() === seg.answer.trim().toLowerCase()
                              : oi === 0;
                          return (
                            <div
                              key={oi}
                              className={`px-2 py-1.5 rounded-lg text-[9px] font-bold border flex items-baseline gap-1 ${
                                correct
                                  ? "bg-emerald-500 text-white border-emerald-600"
                                  : "bg-white text-slate-500 border-slate-200 shadow-sm"
                              }`}
                            >
                              {correct ? <Check className="w-2.5 h-2.5 shrink-0" /> : <div className="w-2.5 h-2.5 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <Field
                                  value={opt}
                                  onChange={(val) => {
                                    const newOpts = [...(seg.options || [])];
                                    newOpts[oi] = val;
                                    onUpdate(i, "options", newOpts);
                                    if (correct) onUpdate(i, "answer", val);
                                  }}
                                  label=""
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pontos */}
                    {typeof seg.points === "number" && seg.points !== 0 && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                            seg.points > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {seg.points > 0 ? `+${seg.points}` : seg.points} pts
                        </span>
                        {seg.feedback && (
                          <span className="text-[9px] text-slate-400 italic truncate max-w-[180px]">
                            {seg.feedback}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
    </div>
  );
};


// --- TicTacToePreview ---
export const TicTacToePreview: React.FC<{ targets: any[] }> = ({ targets }) => {
  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden"
      id="jogo-da-velha-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-indigo-50/50 border-indigo-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Grid className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-indigo-300 font-black text-lg">7.1</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[11px]">
              Preview Jogo da Velha
            </span>
          </div>
        </div>
      </div>
      <div className="p-8 flex flex-col items-center">
        <div className="grid grid-cols-3 gap-0 bg-slate-200 p-1 rounded-2xl border-4 border-slate-100 shadow-xl overflow-hidden mb-8">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-20 h-20 md:w-24 md:h-24 bg-white border border-slate-100 flex items-center justify-center transition-all hover:bg-slate-50 group"
            >
              {i === 0 && (
                <Circle className="w-10 h-10 text-indigo-500 animate-in zoom-in-50 duration-500" />
              )}
              {i === 4 && (
                <X className="w-10 h-10 text-rose-500 animate-in zoom-in-50 duration-500" />
              )}
              {i !== 0 && i !== 4 && (
                <span className="text-[10px] font-black text-slate-200 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                  Questão
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="max-w-md text-center space-y-2">
          <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none">
            Mecânica do Desafio
          </p>
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
            Para conquistar uma casa o aluno deve responder a uma das{" "}
            <span className="text-indigo-500 font-bold">
              {targets?.length || 5} questões pedagógicas
            </span>{" "}
            geradas. O objetivo é formar uma linha, coluna ou diagonal com as
            respostas corretas.
          </p>
        </div>
      </div>
    </div>
  );
};

// --- ClassicPuzzle (Helper) ---
const ClassicPuzzle: React.FC<{ onWin: () => void }> = ({ onWin }) => {
  const [tiles, setTiles] = useState<(number | null)[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);

  const isSolvable = (arr: (number | null)[]) => {
    let inversions = 0;
    const flat = arr.filter((n) => n !== null) as number[];
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[i] > flat[j]) inversions++;
      }
    }
    return inversions % 2 === 0;
  };

  const shuffle = useCallback(() => {
    let newTiles: (number | null)[] = [1, 2, 3, 4, 5, 6, 7, 8, null];
    do {
      for (let i = newTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newTiles[i], newTiles[j]] = [newTiles[j], newTiles[i]];
      }
    } while (
      !isSolvable(newTiles) ||
      newTiles.join(",") === "1,2,3,4,5,6,7,8,null"
    );

    setTiles(newTiles);
    setMoves(0);
    setWon(false);
  }, []);

  useEffect(() => {
    shuffle();
  }, [shuffle]);

  const handleMove = (index: number) => {
    if (won) return;
    const emptyIdx = tiles.indexOf(null);
    const row = Math.floor(index / 3);
    const col = index % 3;
    const eRow = Math.floor(emptyIdx / 3);
    const eCol = emptyIdx % 3;

    if (Math.abs(row - eRow) + Math.abs(col - eCol) === 1) {
      const next = [...tiles];
      [next[index], next[emptyIdx]] = [next[emptyIdx], next[index]];
      setTiles(next);
      setMoves((m) => m + 1);
      if (next.join(",") === "1,2,3,4,5,6,7,8,null") {
        setWon(true);
        onWin();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-amber-900/10 px-4 py-2 rounded-xl border border-amber-900/20">
        <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">
          Movimentos: {moves}
        </span>
        <button
          onClick={shuffle}
          className="text-[10px] font-black text-amber-600 uppercase tracking-widest hover:text-amber-800 transition-colors"
        >
          Reiniciar
        </button>
      </div>
      <div className="aspect-square bg-[#3d2b1f] rounded-[2rem] border-[12px] border-[#8b5a2b] p-3 grid grid-cols-3 gap-3 shadow-2xl relative">
        {tiles.map((val, i) => (
          <motion.div
            key={val || "empty"}
            layout
            onClick={() => handleMove(i)}
            className={`flex items-center justify-center rounded-xl font-black text-2xl transition-all relative ${
              val
                ? "bg-[#eecfa1] text-[#5d3a1a] shadow-[inset_0_-4px_0_rgba(0,0,0,0.1),0_8px_15px_rgba(0,0,0,0.2)] border-t-2 border-[#ffebcd] cursor-pointer hover:bg-[#f5deb3]"
                : "bg-[#2a1b12] shadow-inner"
            }`}
          >
            {val}
            {!val && !won && (
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <Move className="w-8 h-8 text-[#eecfa1]" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
      {won && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-3 bg-emerald-50 border border-emerald-100 rounded-xl"
        >
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
            🎉 Puzzle Resolvido!
          </p>
        </motion.div>
      )}
    </div>
  );
};

// --- UnblockPuzzle (Helper) ---
interface Block {
  id: string;
  x: number;
  y: number;
  len: number;
  axis: "h" | "v";
  isTarget?: boolean;
  color: string;
}

const UnblockPuzzle: React.FC<{ onWin: () => void }> = ({ onWin }) => {
  const INITIAL_BLOCKS: Block[] = [
    {
      id: "target",
      x: 0,
      y: 2,
      len: 2,
      axis: "h",
      isTarget: true,
      color: "from-rose-500 to-rose-600",
    },
    { id: "b1", x: 2, y: 0, len: 3, axis: "v", color: "bg-slate-700" },
    { id: "b2", x: 3, y: 1, len: 2, axis: "h", color: "bg-slate-600" },
    { id: "b3", x: 0, y: 0, len: 2, axis: "v", color: "bg-slate-700" },
    { id: "b4", x: 4, y: 2, len: 3, axis: "v", color: "bg-slate-700" },
    { id: "b5", x: 0, y: 4, len: 2, axis: "h", color: "bg-slate-600" },
    { id: "b6", x: 2, y: 4, len: 2, axis: "h", color: "bg-slate-600" },
    { id: "b7", x: 5, y: 0, len: 2, axis: "v", color: "bg-slate-700" },
  ];

  const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS);
  const [won, setWon] = useState(false);

  const isSpaceFree = (
    x: number,
    y: number,
    currentBlocks: Block[],
    excludeId: string,
  ) => {
    if (x < 0 || x >= 6 || y < 0 || y >= 6) return false;
    return !currentBlocks.some((b) => {
      if (b.id === excludeId) return false;
      if (b.axis === "h") {
        return y === b.y && x >= b.x && x < b.x + b.len;
      } else {
        return x === b.x && y >= b.y && y < b.y + b.len;
      }
    });
  };

  const moveBlock = (id: string, dir: number) => {
    if (won) return;
    setBlocks((prev) => {
      const block = prev.find((b) => b.id === id);
      if (!block) return prev;

      const nextX = block.axis === "h" ? block.x + dir : block.x;
      const nextY = block.axis === "v" ? block.y + dir : block.y;

      // Check head/tail based on direction
      const checkX =
        dir > 0
          ? block.axis === "h"
            ? block.x + block.len
            : block.x
          : block.axis === "h"
            ? block.x - 1
            : block.x;
      const checkY =
        dir > 0
          ? block.axis === "v"
            ? block.y + block.len
            : block.y
          : block.axis === "v"
            ? block.y - 1
            : block.y;

      if (isSpaceFree(checkX, checkY, prev, id)) {
        const newBlocks = prev.map((b) =>
          b.id === id ? { ...b, x: nextX, y: nextY } : b,
        );

        // Win check for target
        const target = newBlocks.find((b) => b.isTarget);
        if (target && target.x + target.len === 6) {
          setWon(true);
          onWin();
        }
        return newBlocks;
      }
      return prev;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-slate-900/10 px-4 py-2 rounded-xl border border-slate-900/20">
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Clique nas pontas para mover
        </span>
        <button
          onClick={() => {
            setBlocks(INITIAL_BLOCKS);
            setWon(false);
          }}
          className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors"
        >
          Reiniciar
        </button>
      </div>
      <div className="aspect-square bg-slate-900 rounded-[2rem] border-[8px] border-slate-800 p-3 relative shadow-2xl overflow-hidden">
        {/* Board Grid */}
        <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 p-3 opacity-10">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>

        {blocks.map((b) => (
          <motion.div
            key={b.id}
            layout
            className={`absolute rounded-2xl shadow-lg border border-white/10 ${b.isTarget ? "z-20" : "z-10"} ${b.isTarget ? `bg-gradient-to-r ${b.color}` : b.color}`}
            style={{
              left: `calc(12px + (100% - 24px) / 6 * ${b.x})`,
              top: `calc(12px + (100% - 24px) / 6 * ${b.y})`,
              width:
                b.axis === "h"
                  ? `calc((100% - 24px) / 6 * ${b.len} - 4px)`
                  : `calc((100% - 24px) / 6 - 4px)`,
              height:
                b.axis === "v"
                  ? `calc((100% - 24px) / 6 * ${b.len} - 4px)`
                  : `calc((100% - 24px) / 6 - 4px)`,
              margin: "2px",
            }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-1 pointer-events-none">
              {b.isTarget && (
                <span className="text-[10px] font-black text-white tracking-[0.2em]">
                  {won ? "SAÍDA!" : "CHAVE"}
                </span>
              )}
              {!b.isTarget && (
                <div className="space-y-1 opacity-20">
                  <div className="w-4 h-0.5 bg-white/50 rounded" />
                  <div className="w-4 h-0.5 bg-white/50 rounded" />
                  <div className="w-4 h-0.5 bg-white/50 rounded" />
                </div>
              )}
            </div>
            {/* Control Arrows */}
            <div
              className={`absolute inset-0 flex ${b.axis === "h" ? "flex-row" : "flex-col"} justify-between`}
            >
              <div
                className="w-1/2 h-full cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => moveBlock(b.id, -1)}
              />
              <div
                className="w-1/2 h-full cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => moveBlock(b.id, 1)}
              />
            </div>
          </motion.div>
        ))}

        {/* Exit Zone */}
        <div className="absolute top-[33.33%] -right-1 w-12 h-[16.66%] bg-emerald-500/20 border-2 border-dashed border-emerald-400/50 rounded-l-2xl flex items-center justify-center backdrop-blur-sm z-0">
          <Check
            className={`w-5 h-5 text-emerald-400 ${won ? "scale-125" : "animate-pulse"}`}
          />
        </div>
      </div>
      {won && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-3 bg-rose-50 border border-rose-100 rounded-xl"
        >
          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest italic">
            🎯 Estratégia Dominada! Saída Liberada.
          </p>
        </motion.div>
      )}
    </div>
  );
};

// --- SlidingPuzzlePreview ---
export const SlidingPuzzlePreview: React.FC<{ targets: any[] }> = ({ targets }) => {
  const [classicSolved, setClassicSolved] = useState(false);
  const [unblockSolved, setUnblockSolved] = useState(false);

  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden"
      id="sliding-puzzle-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-indigo-50/50 border-indigo-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Move className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-indigo-300 font-black text-lg">7.1</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[11px]">
              Preview Sliding Puzzle
            </span>
          </div>
        </div>
        {(classicSolved || unblockSolved) && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-1 bg-emerald-500 text-white rounded-full"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[8px] font-black uppercase tracking-widest">
              Desafio Ativo
            </span>
          </motion.div>
        )}
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Visual Grid Mockup (3x3 Sliding) - Estilo Madeira */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest text-center">
              Modo Clássico (Madeira)
            </h4>
            <ClassicPuzzle onWin={() => setClassicSolved(true)} />
          </div>

          {/* Visual Grid Mockup (Unblock) - Estilo Moderno/Industrial */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest text-center">
              Modo Unblock (Estratégia)
            </h4>
            <UnblockPuzzle onWin={() => setUnblockSolved(true)} />
          </div>
        </div>

        <div className="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center max-w-2xl mx-auto space-y-3">
          <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
            Mecânica de Jogo
          </p>
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
            O jogador clica nos quadrados numerados ou partes da imagem para
            movê-los para o espaço vazio, buscando reorganizar o tabuleiro até
            formar o{" "}
            <span className="text-indigo-500 font-bold">Quebra-Cabeças</span>{" "}
            final. Ao completar o quadro, o sistema libera as{" "}
            <span className="text-indigo-500 font-bold">
              {targets?.length || 3} questões
            </span>{" "}
            de fixação sobre o conteúdo.
          </p>
          {(classicSolved || unblockSolved) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pt-4 border-t border-slate-200 mt-4"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-200 animate-bounce">
                  <Award className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">
                    Questions Liberadas!
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    Mostrando {targets?.length || 3} desafios pedagógicos abaixo
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- WordSmashPreview ---
export const WordSmashPreview: React.FC<{ targets: any[] }> = ({ targets }) => {
  const words = targets
    .map((t) => (t.title || t.description || "").toUpperCase())
    .filter((w) => w.length > 0)
    .slice(0, 12);

  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden"
      id="esmaga-palavras-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-amber-50/50 border-amber-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Grid className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-amber-300 font-black text-lg">W</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[11px]">
              Preview Esmaga Palavras
            </span>
          </div>
        </div>
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Visual Grid Mockup */}
          <div className="aspect-square bg-slate-50 rounded-2xl border-4 border-slate-100 p-4 grid grid-cols-10 gap-1 relative overflow-hidden">
            {Array.from({ length: 100 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-center text-[8px] font-black text-slate-300 bg-white rounded shadow-sm"
              >
                {String.fromCharCode(65 + Math.floor(Math.random() * 26))}
              </div>
            ))}
            {/* Overlay "Found" Words */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 bg-amber-400/20 border-2 border-amber-400 rounded-lg px-4 py-2 rotate-12 flex items-center gap-2 backdrop-blur-sm">
              <span className="text-amber-700 font-black text-[10px] tracking-widest">
                PALAVRA
              </span>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
          </div>

          {/* Word List */}
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">
                Palavras para Encontrar
              </h4>
              <div className="flex flex-wrap gap-2">
                {words.map((w, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white rounded-lg text-[9px] font-black text-slate-600 border border-amber-200 shadow-sm"
                  >
                    {w}
                  </span>
                ))}
                {words.length === 0 && (
                  <span className="text-slate-400 text-[10px] italic font-medium">
                    Nenhuma palavra cadastrada...
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
              O aluno deve localizar as palavras-chave no grid baseando-se nas
              dicas pedagógicas fornecidas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente para itens de resumo (Tempo, Fases, Dificuldade).
 * Usa safeString para garantir que os valores nunca quebrem o React.
 */
const SummaryItem: React.FC<{
  icon: any;
  label: string;
  value: any;
  onChange: any;
}> = ({ icon, label, value, onChange }) => (
  <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100/50 hover:bg-white transition-all">
    <div className="flex items-center gap-2 mb-2 ml-1">
      {icon}
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {safeString(label)}
      </span>
    </div>
    <Field label="" value={safeString(value)} onChange={onChange} />
  </div>
);

const Field: React.FC<{
  label: string;
  value?: string;
  onChange: (v: string) => void;
  readonly?: boolean;
}> = ({ label, value, onChange, readonly = false }) => {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);

  // Converte SEMPRE para string segura — nunca renderiza objetos/eventos
  const safeValue = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    // Objeto ou array: converte para JSON como fallback
    try {
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    } catch {
      return "";
    }
  };

  const strValue = safeValue(value);

  useEffect(() => {
    if (!divRef.current || focused) return;
    divRef.current.innerText = strValue;
  }, [strValue, focused]);

  return (
    <div className="w-full group/field">
      {label && (
        <div className="flex items-center justify-between mb-1.5 ml-1">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {label}
          </h4>
          {!readonly && (
            <PencilLine className="w-3 h-3 text-indigo-400 opacity-0 group-hover/field:opacity-100 transition-opacity mr-4" />
          )}
        </div>
      )}
      <div
        ref={divRef}
        contentEditable={!readonly}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const newVal = divRef.current?.innerText || "";
          if (newVal !== strValue) onChange(newVal);
        }}
        className={`text-[15px] font-medium leading-relaxed outline-none p-2 rounded-xl transition-all relative border ${
          readonly
            ? "text-slate-500 italic bg-transparent border-transparent"
            : "border-slate-300/40 hover:bg-white hover:border-indigo-300/50 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:shadow-md bg-slate-50/30"
        }`}
      />
    </div>
  );
};

// ─── ReferenceImagesSection ────────────────────────────────────────────────────────
const ReferenceImagesSection: React.FC<{
  images: string[];
  onUpdate: (images: string[]) => void;
}> = ({ images, onUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (images.length + files.length > 5) {
      alert("Você pode adicionar no máximo 5 imagens.");
      return;
    }

    const processedImages: string[] = [];

    const filePromises = Array.from(files).map((file) => {
      return new Promise<void>((resolve) => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`A imagem ${file.name} é muito grande. Escolha fotos menores.`);
          resolve();
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
              if (dataUrl && dataUrl.length > 10) {
                processedImages.push(dataUrl);
              }
            }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = reader.result as string;
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });
    });

    await Promise.all(filePromises);

    if (processedImages.length > 0) {
      // Passa a repassar as imagens antigas + as novas redimensionadas
      onUpdate([...images, ...processedImages].slice(0, 5));
    }

    // reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    const updated = [...images];
    updated.splice(index, 1);
    onUpdate(updated);
  };

  return (
    <SectionCard
      number="6"
      title="Exemplos de Imagens"
      icon={<Layers className="w-5 h-5 text-pink-500" />}
      headerColor="bg-pink-50/50 border-pink-100/50"
      className="export-hide"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">
              Adicione fotos de referência, moldes ou exemplos (até 5 imagens para o PDF).
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= 5}
            className={`px-4 py-2 bg-pink-50 text-pink-600 border border-pink-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:bg-pink-100 ${images.length >= 5 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            + Adicionar Imagem ({images.length}/5)
          </button>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-4">
            {images.map((imgUrl, i) => (
              <div key={i} className="relative group border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm" style={{ aspectRatio: "16/9" }}>
                <img src={imgUrl} className="w-full h-full object-cover object-center" alt={`Exemplo ${i + 1}`} />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white text-slate-400 hover:text-rose-500 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
};

export default DocumentView;
