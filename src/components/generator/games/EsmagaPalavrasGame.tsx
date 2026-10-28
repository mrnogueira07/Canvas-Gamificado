/**
 * Jogo Esmaga Palavras (Word Smash).
 *
 * Cada item representa uma palavra-chave que aparece no grid e deve ser
 * "esmagada" pelo aluno. O campo description fornece a definição/contexto
 * pedagógico exibido como dica.
 *
 * Limite recomendado: 10 palavras por canvas.
 */
import React from "react";
import { Grid, Type, Trash2, AlertCircle, CheckCircle, BookOpen } from "lucide-react";
import { Field } from "../shared/Field";
import type { GameTarget } from "../../../types";

// ─── Editor de itens (linha por linha) ───────────────────────────────────────
interface EsmagaPalavrasTargetsProps {
  targets: GameTarget[];
  onEdit: (field: string, value: unknown) => void;
  onRemove: (path: string, index: number) => void;
}

export const EsmagaPalavrasGame: React.FC<EsmagaPalavrasTargetsProps> = ({
  targets,
  onEdit,
  onRemove,
}) => {
  return (
    <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {targets.map((target, i) => {
        const wordValue = (target.title || target.question || "").trim();
        const hasSpaces = wordValue.includes(" ");
        const isWordEmpty = wordValue.length === 0;
        const wordLength = wordValue.replace(/\s/g, "").length;
        const isDescEmpty = !(target.description || target.feedback || "").trim();

        return (
          <div
            key={i}
            data-question-card
            className="p-6 bg-gradient-to-b from-white to-slate-50/50 rounded-3xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] relative group/esmaga transition-all duration-300 hover:border-amber-400/40 hover:-translate-y-1 print:break-inside-avoid overflow-hidden"
          >
            {/* Top gradient line decor */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

            {/* Card Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/10">
                  <Type className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase leading-none">
                    Item {i + 1}
                  </span>
                  <span className="text-[13.2px] font-extrabold text-slate-700 mt-0.5">
                    Esmaga Palavra
                  </span>
                </div>
              </div>

              {onRemove && (
                <button
                  onClick={() => onRemove("targets", i)}
                  className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center border border-slate-100 hover:border-red-100 opacity-0 group-hover/esmaga:opacity-100 transition-all duration-200 shadow-sm"
                  title="Excluir palavra"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Fields container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Word Input Card */}
              <div className="bg-amber-50/30 p-4.5 rounded-2xl border border-amber-100/50 space-y-2">
                <Field
                  label="PALAVRA NO GRID (ESMAGA)"
                  value={target.title || target.question || ""}
                  onChange={(v) => {
                    // Remove múltiplos espaços extras
                    const cleanVal = v.replace(/\s+/g, ' ');
                    onEdit(`targets[${i}].title`, cleanVal);
                    onEdit(`targets[${i}].question`, cleanVal);
                  }}
                  prefix="#"
                />

                {/* Real-time word validation badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {isWordEmpty ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-[10.45px] font-extrabold shadow-sm">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Digite a palavra
                    </div>
                  ) : hasSpaces ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10.45px] font-extrabold shadow-sm animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 animate-bounce" />
                      Sem espaços (palavra única!)
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10.45px] font-extrabold shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Palavra pronta ({wordLength} letras)
                    </div>
                  )}
                </div>
              </div>

              {/* Description Input Card */}
              <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-dashed border-slate-200/80 space-y-2">
                <Field
                  label="DESCRIÇÃO / CONTEXTO PEDAGÓGICO"
                  value={target.description || target.feedback || ""}
                  onChange={(v) => {
                    onEdit(`targets[${i}].description`, v);
                    onEdit(`targets[${i}].feedback`, v);
                  }}
                />

                {/* Description validation badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {isDescEmpty ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10.45px] font-extrabold shadow-sm animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                      Descrição obrigatória!
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10.45px] font-extrabold shadow-sm">
                      <BookOpen className="w-3.5 h-3.5" />
                      Descrição preenchida
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Preview visual do jogo ──────────────────────────────────────────────────
const STATIC_GRID_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQR".split("");

interface EsmagaPalavrasPreviewProps {
  targets: GameTarget[];
}

export const EsmagaPalavrasPreview: React.FC<EsmagaPalavrasPreviewProps> = ({
  targets,
}) => {
  const words = targets
    .map((t) => (t.title || t.question || "").toUpperCase().replace(/\s/g, ""))
    .filter((w) => w.length > 0)
    .slice(0, 12);

  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden print:break-inside-avoid"
      id="esmaga-palavras-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-amber-50/50 border-amber-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Grid className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-amber-300 font-black text-lg">W</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[12.1px]">
              Preview Esmaga Palavras
            </span>
          </div>
        </div>
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          {/* Mockup visual do grid */}
          <div className="aspect-square bg-slate-50 rounded-2xl border-4 border-slate-100 p-4 grid grid-cols-10 gap-1 relative overflow-hidden">
            {STATIC_GRID_LETTERS.map((letter, i) => (
              <div
                key={i}
                className="flex items-center justify-center text-[8.8px] font-black text-slate-300 bg-white rounded shadow-sm"
              >
                {letter}
              </div>
            ))}
            {/* Overlay simulando palavra encontrada */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 bg-amber-400/20 border-2 border-amber-400 rounded-lg px-4 py-2 rotate-12 flex items-center gap-2 backdrop-blur-sm">
              <span className="text-amber-700 font-black text-[11px] tracking-widest">
                PALAVRA
              </span>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
          </div>

          {/* Lista de palavras */}
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-3">
                Palavras para Encontrar
              </h4>
              <div className="flex flex-wrap gap-2">
                {words.map((w, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white rounded-lg text-[9.9px] font-black text-slate-600 border border-amber-200 shadow-sm"
                  >
                    {w}
                  </span>
                ))}
                {words.length === 0 && (
                  <span className="text-slate-400 text-[11px] italic font-medium">
                    Nenhuma palavra cadastrada...
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
              O aluno deve localizar as palavras-chave no grid baseando-se nas
              dicas pedagógicas fornecidas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
