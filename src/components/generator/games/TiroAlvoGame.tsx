/**
 * Jogo de Tiro ao Alvo.
 *
 * Cada questão é composta por 3 alvos: 1 correto e 2 inimigos/distratores.
 * A IA gera múltiplas questões e a UI agrupa os alvos por enunciado.
 *
 * Limite máximo: 15 alvos (≈ 5 perguntas com 3 alvos cada).
 */
import React from "react";
import { Crosshair, Target, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Field } from "../shared/Field";
import { toStr } from "../shared/utils";

interface TiroAlvoGameProps {
  targets: any[];
  gameType: string;
  onEdit: (field: string, value: any) => void;
  onRemove: (path: string, index: number) => void;
}

export const TiroAlvoGame: React.FC<TiroAlvoGameProps> = ({
  targets,
  gameType,
  onEdit,
  onRemove,
}) => {
  const handleSwap = (idxA: number, idxB: number) => {
    const newTargets = [...targets];
    const temp = newTargets[idxA];
    newTargets[idxA] = newTargets[idxB];
    newTargets[idxB] = temp;
    onEdit("targets", newTargets);
  };
  /**
   * Agrupa alvos por questão. Cada grupo tem o enunciado + os 3 alvos
   * associados (índices originais preservados para edição/remoção).
   */
  const buildGroups = () => {
    const groups: {
      question: string;
      items: any[];
      originalIndices: number[];
    }[] = [];

    targets.forEach((t, idx) => {
      // Normalização agressiva para agrupar mesmo com espaços/pontuação diferentes
      const qRaw = (
        t.question ||
        (t as any).pergunta ||
        (t as any).enunciado ||
        ""
      ).trim();
      const normalizedQ =
        qRaw.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        `_auto_group_${Math.floor(idx / 3)}`;

      let group = groups.find(
        (g) =>
          g.question.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedQ,
      );
      if (!group) {
        group = {
          question: qRaw || `Pergunta ${Math.floor(idx / 3) + 1}`,
          items: [],
          originalIndices: [],
        };
        groups.push(group);
      }
      group.items.push(t);
      group.originalIndices.push(idx);
    });

    // Fallback: se algo deu errado no agrupamento, força grupos de 3 em 3
    if (
      gameType === "Jogo de Tiro ao Alvo" &&
      groups.length > Math.ceil(targets.length / 3) &&
      targets.length > 0
    ) {
      const forcedGroups: typeof groups = [];
      for (let i = 0; i < targets.length; i += 3) {
        const t = targets[i];
        forcedGroups.push({
          question:
            t?.question ||
            (t as any)?.pergunta ||
            (t as any)?.enunciado ||
            `Pergunta ${Math.floor(i / 3) + 1}`,
          items: targets.slice(i, i + 3),
          originalIndices: Array.from(
            { length: Math.min(3, targets.length - i) },
            (_, k) => i + k,
          ),
        });
      }
      return forcedGroups;
    }

    return groups;
  };

  const renderGroup = (group: any, groupIdx: number) => (
    <div
      key={groupIdx}
      data-question-card
      className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{ animationDelay: `${groupIdx * 100}ms` }}
    >
      <div className="flex items-center gap-4 bg-blue-50/80 p-4 rounded-2xl border border-blue-100/50 shadow-sm relative overflow-hidden">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0 relative z-10">
          {groupIdx + 1}
        </div>
        <div className="flex-1 relative z-10">
          <Field
            label={`QUESTÃO ${groupIdx + 1}`}
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
            // Remove em ordem decrescente para não bagunçar os índices
            const indicesToRemove = [...group.originalIndices].reverse();
            indicesToRemove.forEach((idx: number) => onRemove("targets", idx));
          }}
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-violet-500 hover:bg-slate-50 rounded-xl transition-all"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
        {group.items.map((target: any, itemIdx: number) => {
          const originalIdx = group.originalIndices[itemIdx];
          const isCorrect = target.isCorrect;
          return (
            <div
              key={itemIdx}
              className={`group/hit relative p-4 rounded-2xl border transition-all duration-300 ${
                isCorrect
                  ? "bg-emerald-50/20 border-emerald-100 hover:border-emerald-300 shadow-sm"
                  : "bg-slate-50/20 border-slate-100 hover:border-rose-200 shadow-sm"
              } flex flex-col justify-between gap-3`}
            >
              {/* Cabeçalho do alvo com ações de troca e indicador de correção */}
              <div className="flex items-center justify-between border-b border-dashed pb-2 border-slate-200/60">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                      isCorrect
                        ? "bg-emerald-500 text-white"
                        : "bg-violet-500 text-white"
                    }`}
                  >
                    {isCorrect ? (
                      <Target className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className={`text-[9.9px] font-black uppercase tracking-wider ${isCorrect ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {isCorrect ? "Alvo Correto" : `Inimigo ${itemIdx}`}
                  </span>
                </div>

                {/* Ações de movimentação horizontal */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleSwap(originalIdx, group.originalIndices[itemIdx - 1])}
                    disabled={itemIdx === 0}
                    className="p-1 text-slate-400 hover:text-violet-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-all"
                    title="Mover para esquerda"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleSwap(originalIdx, group.originalIndices[itemIdx + 1])}
                    disabled={itemIdx === group.items.length - 1}
                    className="p-1 text-slate-400 hover:text-violet-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-all"
                    title="Mover para direita"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Campos de Input do Alvo */}
              <div className="space-y-3">
                <Field
                  label="Texto do Alvo"
                  value={target.title}
                  onChange={(val: string) =>
                    onEdit(`targets[${originalIdx}].title`, val)
                  }
                />
                <Field
                  label="Explicação / Feedback"
                  value={toStr(target.description || target.feedback || "")}
                  onChange={(val: string) => {
                    onEdit(`targets[${originalIdx}].description`, val);
                    onEdit(`targets[${originalIdx}].feedback`, val);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-1">
          <p className="text-[12.1px] font-black text-violet-600/80 uppercase tracking-widest">
            Configuração de Desafios — {Math.ceil(targets.length / 3)} Fase(s)
          </p>
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[12.1px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-2.5 py-1 rounded w-fit">
              🎯 Padrão: 1 Alvo Correto e 2 Distratores
            </span>
            <span className="text-[12.1px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-2.5 py-1 rounded w-fit">
              ⚠ Limite: 5 perguntas (15 alvos no total)
            </span>
          </div>
        </div>
        <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-[11px] font-black text-violet-600 uppercase tracking-widest leading-none">
            Mira Ativa
          </span>
        </div>
      </div>

      <div className="space-y-16">
        {buildGroups().map((group, groupIdx) => renderGroup(group, groupIdx))}
      </div>
    </div>
  );
};
