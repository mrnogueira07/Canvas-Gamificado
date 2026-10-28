/**
 * Sliding Puzzle (8-puzzle clássico) + Unblock (estilo Rush Hour).
 *
 * Dois modos pedagógicos:
 *  - Clássico: tabuleiro 3x3 com peças numeradas que deslizam
 *  - Unblock: o aluno move blocos até liberar a saída de uma "chave"
 *
 * Após resolver, o jogo libera as questões de fixação configuradas.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Move } from "lucide-react";
import { motion } from "framer-motion";

// ─── Modo Clássico (8-puzzle) ────────────────────────────────────────────────
const ClassicPuzzle: React.FC<{ onWin: () => void }> = ({ onWin }) => {
  const [tiles, setTiles] = useState<(number | null)[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);

  /** Verifica se a permutação é solucionável (inversões pares). */
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

  /** Embaralha o tabuleiro garantindo que seja solucionável e não esteja resolvido */
  const shuffle = useCallback(() => {
    const newTiles: (number | null)[] = [1, 2, 3, 4, 5, 6, 7, 8, null];
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    shuffle();
  }, [shuffle]);

  /** Move uma peça caso seja vizinha do espaço vazio */
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
        <span className="text-[11px] font-black text-amber-800 uppercase tracking-widest">
          Movimentos: {moves}
        </span>
        <button
          onClick={shuffle}
          className="text-[11px] font-black text-amber-600 uppercase tracking-widest hover:text-amber-800 transition-colors"
        >
          Reiniciar
        </button>
      </div>
      <div className="aspect-square bg-[#3d2b1f] rounded-[2rem] border-[12px] border-[#8b5a2b] p-3 grid grid-cols-3 gap-3 shadow-2xl relative">
        {tiles.map((val, i) => {
          const emptyIdx = tiles.indexOf(null);
          const movable = !won && emptyIdx !== -1 && (
            Math.abs(Math.floor(i / 3) - Math.floor(emptyIdx / 3)) + Math.abs((i % 3) - (emptyIdx % 3)) === 1
          );

          return (
            <motion.div
              key={val || "empty"}
              layout
              onClick={() => handleMove(i)}
              className={`flex items-center justify-center rounded-xl font-black text-2xl transition-all relative select-none ${
                val
                  ? `bg-[#eecfa1] text-[#5d3a1a] shadow-[inset_0_-4px_0_rgba(0,0,0,0.1),0_8px_15px_rgba(0,0,0,0.2)] border-t-2 border-[#ffebcd] ${
                      movable
                        ? "cursor-pointer hover:bg-[#ffe0b2] hover:scale-[1.04] active:scale-95 hover:ring-2 hover:ring-amber-500/40"
                        : "cursor-not-allowed opacity-90"
                    }`
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
          );
        })}
      </div>
      {won && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-3 bg-emerald-50 border border-emerald-100 rounded-xl"
        >
          <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">
            🎉 Puzzle Resolvido!
          </p>
        </motion.div>
      )}
    </div>
  );
};

// ─── Modo Unblock (Rush-Hour-like) ───────────────────────────────────────────
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
      x: 1,
      y: 2,
      len: 2,
      axis: "h",
      isTarget: true,
      color: "from-violet-500 to-violet-600",
    },
    { id: "b1", x: 3, y: 0, len: 3, axis: "v", color: "bg-slate-700" },
    { id: "b2", x: 4, y: 0, len: 2, axis: "v", color: "bg-slate-700" },
    { id: "b3", x: 0, y: 0, len: 2, axis: "h", color: "bg-slate-600" },
    { id: "b4", x: 0, y: 1, len: 2, axis: "v", color: "bg-slate-700" },
    { id: "b5", x: 1, y: 3, len: 2, axis: "h", color: "bg-slate-600" },
    { id: "b6", x: 0, y: 4, len: 2, axis: "v", color: "bg-slate-700" },
    { id: "b7", x: 2, y: 4, len: 2, axis: "h", color: "bg-slate-600" },
    { id: "b8", x: 4, y: 4, len: 2, axis: "v", color: "bg-slate-700" },
  ];

  const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS);
  const [won, setWon] = useState(false);

  /** Verifica se uma célula (x,y) está livre, exceto pelo bloco corrente */
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

  /** Move um bloco em uma direção (+1 ou -1), respeitando colisões */
  const moveBlock = (id: string, dir: number) => {
    if (won) return;
    setBlocks((prev) => {
      const block = prev.find((b) => b.id === id);
      if (!block) return prev;

      const nextX = block.axis === "h" ? block.x + dir : block.x;
      const nextY = block.axis === "v" ? block.y + dir : block.y;

      // Determina se é a célula da frente ou de trás que precisa estar livre
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

        // Vitória: bloco-chave atinge a borda direita
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
        <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Clique nas pontas para mover
        </span>
        <button
          onClick={() => {
            setBlocks(INITIAL_BLOCKS);
            setWon(false);
          }}
          className="text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors"
        >
          Reiniciar
        </button>
      </div>
      <div className="aspect-square bg-slate-900 rounded-[2rem] border-[8px] border-slate-800 p-3 relative shadow-2xl overflow-hidden">
        {/* Grid de fundo */}
        <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 p-3 opacity-10">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>

        {blocks.map((b) => (
          <motion.div
            key={b.id}
            layout
            className={`absolute rounded-2xl shadow-lg border border-white/10 ${
              b.isTarget ? "z-20" : "z-10"
            } ${b.isTarget ? `bg-gradient-to-r ${b.color}` : b.color}`}
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
                <span className="text-[11px] font-black text-white tracking-[0.2em]">
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
            {/* Setas de controle (cada metade move em uma direção) */}
            <div
              className={`absolute inset-0 flex ${
                b.axis === "h" ? "flex-row" : "flex-col"
              } justify-between`}
            >
              <div
                className={`${
                  b.axis === "h" ? "w-1/2 h-full" : "w-full h-1/2"
                } cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-center group/btn relative`}
                onClick={() => moveBlock(b.id, -1)}
              >
                <span className="text-[11px] font-black text-white/50 opacity-30 group-hover/btn:opacity-100 transition-opacity absolute pointer-events-none">
                  {b.axis === "h" ? "◀" : "▲"}
                </span>
              </div>
              <div
                className={`${
                  b.axis === "h" ? "w-1/2 h-full" : "w-full h-1/2"
                } cursor-pointer hover:bg-white/10 transition-colors flex items-center justify-center group/btn relative`}
                onClick={() => moveBlock(b.id, 1)}
              >
                <span className="text-[11px] font-black text-white/50 opacity-30 group-hover/btn:opacity-100 transition-opacity absolute pointer-events-none">
                  {b.axis === "h" ? "▶" : "▼"}
                </span>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Zona de saída */}
        <div className="absolute top-[33.33%] -right-1 w-12 h-[16.66%] bg-emerald-500/20 border-2 border-dashed border-emerald-400/50 rounded-l-2xl flex items-center justify-center backdrop-blur-sm z-0">
          <Check
            className={`w-5 h-5 text-emerald-400 ${
              won ? "scale-125" : "animate-pulse"
            }`}
          />
        </div>
      </div>
      {won && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-3 bg-slate-50 border border-slate-100 rounded-xl"
        >
          <p className="text-[11px] font-black text-violet-600 uppercase tracking-widest italic">
            🎯 Estratégia Dominada! Saída Liberada.
          </p>
        </motion.div>
      )}
    </div>
  );
};

// ─── Preview principal (ambos modos lado a lado) ─────────────────────────────
interface SlidingPuzzlePreviewProps {
  targets: any[];
}

export const SlidingPuzzlePreview: React.FC<SlidingPuzzlePreviewProps> = ({
  targets,
}) => {
  const [classicSolved, setClassicSolved] = useState(false);
  const [unblockSolved, setUnblockSolved] = useState(false);

  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden print:break-inside-avoid"
      id="sliding-puzzle-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-violet-50/50 border-violet-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Move className="w-5 h-5 text-violet-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-violet-300 font-black text-lg">7.1</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[12.1px]">
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
            <span className="text-[8.8px] font-black uppercase tracking-widest">
              Desafio Ativo
            </span>
          </motion.div>
        )}
      </div>
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-amber-800 uppercase tracking-widest text-center">
              Modo Clássico (Madeira)
            </h4>
            <ClassicPuzzle onWin={() => setClassicSolved(true)} />
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-black text-violet-600 uppercase tracking-widest text-center">
              Modo Unblock (Estratégia)
            </h4>
            <UnblockPuzzle onWin={() => setUnblockSolved(true)} />
          </div>
        </div>

        <div className="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center max-w-2xl mx-auto space-y-3">
          <p className="text-[12.1px] font-black text-slate-800 uppercase tracking-widest">
            Mecânica de Jogo
          </p>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            O jogador clica nos quadrados numerados ou partes da imagem para
            movê-los para o espaço vazio, buscando reorganizar o tabuleiro até
            formar o{" "}
            <span className="text-violet-500 font-bold">Quebra-Cabeças</span>{" "}
            final. Ao completar o quadro, o sistema libera as{" "}
            <span className="text-violet-500 font-bold">
              {targets?.length || 3} questões
            </span>{" "}
            de fixação sobre o conteúdo.
          </p>
        </div>
      </div>
    </div>
  );
};
