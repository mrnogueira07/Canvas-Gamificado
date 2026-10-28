/**
 * Jogo de Plataforma 2D.
 *
 * Estrutura pedagógica:
 *  - 3 a 10 perguntas de percurso (aparecem ao longo das fases)
 *  - Até 5 dicas temáticas espalhadas pelo cenário
 *
 * Cada pergunta possui enunciado + 3 alternativas (1 correta + 2 distratores).
 */
import React from "react";
import { XCircle } from "lucide-react";
import { Field } from "../shared/Field";
import { isCorrectAnswer } from "../shared/utils";

interface PlataformaGameProps {
  targets: any[];
  hints: string[];
  onEdit: (field: string, value: any) => void;
  onAdd: (path: string, item: any) => void;
  onRemove: (path: string, index: number) => void;
}

export const PlataformaGame: React.FC<PlataformaGameProps> = ({
  targets,
  hints,
  onEdit,
  onAdd,
  onRemove,
}) => {
  // Adiciona uma nova dica temática (até o limite de 5)
  const handleAddHint = () => {
    const defaultHint =
      hints.length > 0
        ? hints[Math.floor(Math.random() * hints.length)]
        : "Dica pedagógica importante sobre o conteúdo";
    onAdd("thematicHints", defaultHint);
  };

  return (
    <div className="canvas-platform-editor space-y-12">
      {/* ── Perguntas de Percurso (3 a 10 itens) ───────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">
              Perguntas de Percurso{" "}
              <span className="text-emerald-400">({targets.length}/10)</span>
            </p>
            <p className="text-xs text-slate-400 font-bold uppercase italic">
              Aparecem durante as fases (Estilo Questão Final)
            </p>
            <p className="text-xs text-emerald-600 font-bold uppercase italic print:hidden bg-emerald-50 px-2 py-1 rounded inline-block mt-1">
              ⚠️ Limite Máximo: 10 questões
            </p>
          </div>
          {/* O botão de adicionar questão está no cabeçalho do GameLogicSection */}
          {targets.length === 0 && (
            <span className="text-[9.9px] text-slate-400 italic">
              Use o botão acima ↑ para adicionar perguntas
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {targets.map((t, i) => (
            <div
              key={`${t.question || t.title || ''}-${i}`}
              data-question-card
              className="canvas-question-card group/plat p-4 bg-emerald-50/20 border border-emerald-100 rounded-2xl shadow-sm hover:shadow-md transition-all relative print:break-inside-avoid"
            >
              <button
                onClick={(e) => { e.stopPropagation(); onRemove("targets", i); }}
                className="absolute -top-2 -right-2 text-slate-300 hover:text-violet-500 transition-colors opacity-0 group-hover/plat:opacity-100 bg-white rounded-full shadow-md z-20"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-3">
                  <Field
                    label={`QUESTÃO ${i + 1}`}
                    value={t.question || t.title}
                    onChange={(val) => {
                      onEdit(`targets[${i}].question`, val);
                      onEdit(`targets[${i}].title`, val);
                    }}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(t.options && t.options.length > 0
                      ? t.options
                      : [
                          "Alternativa Correta",
                          "Alternativa Incorreta 1",
                          "Alternativa Incorreta 2",
                        ]
                    ).map((opt: string, optIdx: number) => {
                      const isCorrect =
                        isCorrectAnswer(opt, t.answer || "", optIdx) ||
                        (t.answer === undefined && optIdx === 0);
                      return (
                        <div
                          key={optIdx}
                          className={`canvas-answer-card p-1.5 rounded-xl border transition-all cursor-pointer ${
                            isCorrect
                              ? "canvas-answer-correct bg-emerald-100 border-emerald-300"
                              : "bg-white border-slate-100"
                          }`}
                          onClick={() => onEdit(`targets[${i}].answer`, opt)}
                        >
                          <Field
                            label={isCorrect ? "CORRETA" : "INCORRETA"}
                            value={opt}
                            onChange={(val) => {
                              const wasCorrect = isCorrect;
                              const currentOpts =
                                t.options && t.options.length > 0
                                  ? t.options
                                  : [
                                      "Alternativa Correta",
                                      "Alternativa Incorreta 1",
                                      "Alternativa Incorreta 2",
                                    ];
                              const newOpts = [...currentOpts];
                              newOpts[optIdx] = val;
                              onEdit(`targets[${i}].options`, newOpts);
                              if (wasCorrect)
                                onEdit(`targets[${i}].answer`, val);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dicas Temáticas (até 5) ───────────────────────────────────────── */}
      <div className="canvas-hints-group space-y-3 pt-8 border-t border-dashed border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-black text-amber-600 uppercase tracking-widest">
              Dicas Temáticas{" "}
              <span className="text-amber-400">({hints.length}/5)</span>
            </p>
            <p className="text-xs text-slate-400 font-bold uppercase italic">
              Dicas espalhadas pelo cenário
            </p>
            <p className="text-xs text-amber-600 font-bold uppercase italic print:hidden bg-amber-50 px-2 py-1 rounded inline-block mt-1">
              ⚠️ Limite Máximo: 5 dicas
            </p>
          </div>
          {hints.length < 5 && (
            <button
              onClick={handleAddHint}
              className="print:hidden text-[9.9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 hover:bg-amber-100 transition-all"
            >
              + Adicionar Dica
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hints.map((h, i) => (
            <div
              key={`hint-${i}`}
              className="canvas-hint-card group/hint p-4 bg-amber-50/30 border border-amber-100 rounded-2xl relative print:break-inside-avoid"
            >
              <button
                onClick={(e) => { e.stopPropagation(); onRemove("thematicHints", i); }}
                className="absolute -top-2 -right-2 text-slate-300 hover:text-violet-500 opacity-0 group-hover/hint:opacity-100 bg-white rounded-full"
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
