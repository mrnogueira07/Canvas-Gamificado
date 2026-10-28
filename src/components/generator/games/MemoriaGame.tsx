/**
 * Jogo da Memória.
 *
 * Cada item é um par carta + verso:
 *  - Frente (title/question): conceito ou termo curto
 *  - Verso (description/answer): descrição visual ou definição do conceito
 *
 * Limite recomendado: 8 pares (= 16 cartas no tabuleiro).
 */
import React from "react";
import { XCircle } from "lucide-react";
import { Field } from "../shared/Field";
import { toStr } from "../shared/utils";

interface MemoriaGameProps {
  targets: any[];
  onEdit: (field: string, value: any) => void;
  onRemove: (path: string, index: number) => void;
}

export const MemoriaGame: React.FC<MemoriaGameProps> = ({
  targets,
  onEdit,
  onRemove,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-black text-teal-600/80 uppercase tracking-widest">
            Pares de Cartas — {targets.length} par{targets.length !== 1 ? "es" : ""}
          </p>
        <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              ⚠ Máximo de 8 pares — ao atingir o limite, o botão de adicionar será desativado automaticamente
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-4">
        {targets.map((target, i) => (
          <div
            key={i}
            data-question-card
            className="group/mem bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-teal-200 transition-all relative print:break-inside-avoid"
          >
            <button
              onClick={() => onRemove("targets", i)}
              className="absolute -top-2 -right-2 text-slate-300 hover:text-violet-500 transition-colors opacity-0 group-hover/mem:opacity-100 bg-white rounded-full shadow-md z-20"
            >
              <XCircle className="w-5 h-5" />
            </button>
            {/* Cabeçalho do par */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center text-[11px] font-black shrink-0">
                {i + 1}
              </div>
              <div className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-100">
                <span className="text-[9.9px] font-black uppercase tracking-widest text-teal-600">
                  Carta
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Frente da carta */}
              <div className="relative bg-teal-50/30 border border-teal-100 rounded-xl p-3 hover:bg-white transition-all">
                <Field
                  label="Frente (Título)"
                  value={toStr(target.title || target.question || "")}
                  onChange={(val: string) => {
                    onEdit(`targets[${i}].title`, val);
                    onEdit(`targets[${i}].question`, val);
                  }}
                />
              </div>
              {/* Verso da carta */}
              <div className="relative bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-3 hover:bg-white transition-all">
                <Field
                  label="Verso (Sugestão de Imagem)"
                  value={toStr(
                    target.description ||
                      target.feedback ||
                      (target as any).verso ||
                      (target as any).pair ||
                      (target as any).answer ||
                      "",
                  )}
                  onChange={(val: string) => {
                    onEdit(`targets[${i}].description`, val);
                    onEdit(`targets[${i}].feedback`, val);
                    onEdit(`targets[${i}].answer`, val);
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
