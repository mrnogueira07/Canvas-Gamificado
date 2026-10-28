/**
 * Jogo da Velha (Tic-Tac-Toe) pedagógico.
 *
 * Preview interativo: cada casa do tabuleiro 3x3 corresponde a uma questão.
 * Para "marcar" uma casa o aluno precisa responder corretamente — quem
 * formar linha/coluna/diagonal de respostas certas vence.
 */
import React from "react";
import { Circle, Grid, X } from "lucide-react";

interface JogoDaVelhaGameProps {
  targets: any[];
}

export const JogoDaVelhaPreview: React.FC<JogoDaVelhaGameProps> = ({
  targets,
}) => {
  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden print:break-inside-avoid"
      id="jogo-da-velha-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-violet-50/50 border-violet-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Grid className="w-5 h-5 text-violet-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-violet-300 font-black text-lg">7.1</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[12.1px]">
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
                <Circle className="w-10 h-10 text-violet-500 animate-in zoom-in-50 duration-500" />
              )}
              {i === 4 && (
                <X className="w-10 h-10 text-violet-500 animate-in zoom-in-50 duration-500" />
              )}
              {i !== 0 && i !== 4 && (
                <span className="text-[11px] font-black text-slate-200 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                  Questão
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="max-w-md text-center space-y-2">
          <p className="text-[12.1px] font-black text-slate-800 uppercase tracking-widest leading-none">
            Mecânica do Desafio
          </p>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            Para conquistar uma casa o aluno deve responder a uma das{" "}
            <span className="text-violet-500 font-bold">
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
