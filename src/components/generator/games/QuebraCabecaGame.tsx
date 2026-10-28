/**
 * Jogo de Quebra-Cabeça interativo.
 *
 * Cada quebra-cabeça tem:
 *  - Uma imagem (URL ou upload do professor)
 *  - Quantidade de peças configurável (6, 8, 9 ou 10)
 *  - Descrição contextual da imagem
 *  - Conjunto de questões pedagógicas (até 5) que aparecem ao encaixar peças
 *
 * Suporta até 3 quebra-cabeças simultâneos por canvas.
 */
import React, { useRef, useState } from "react";
import { Award, Check, XCircle, X } from "lucide-react";
import type { GeneratedContent } from "../../../types";
import { Field } from "../shared/Field";
import { InlineSelect } from "../shared/InlineSelect";
import { toStr } from "../shared/utils";

const EXAMPLE_PUZZLE_URL =
  "https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=600&q=80";

// ─── Quebra-cabeça individual ────────────────────────────────────────────────
interface SinglePuzzleProps {
  puzzle: any;
  pIdx: number;
  onUpdatePuzzle: (idx: number, updates: any) => void;
  onRemovePuzzle: (idx: number) => void;
  canRemove: boolean;
}

const SinglePuzzle: React.FC<SinglePuzzleProps> = ({
  puzzle,
  pIdx,
  onUpdatePuzzle,
  onRemovePuzzle,
  canRemove,
}) => {
  const [placedPieces, setPlacedPieces] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Define o layout do grid em função da quantidade de peças
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

  /** Faz upload da imagem do quebra-cabeça e a redimensiona para evitar payloads gigantes. */
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
        // Limita o tamanho máximo da imagem para 1000x1000
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

  /** Lida com clique em uma peça: encaixa e mostra o desafio correspondente. */
  const handlePieceClick = (idx: number) => {
    if (placedPieces.includes(idx)) {
      return;
    }
    setPlacedPieces((prev) => [...prev, idx]);
  };

  return (
    <div className="relative group/pcontainer p-6 mb-8 border-2 border-dashed border-violet-100 rounded-3xl bg-white shadow-sm hover:shadow-md transition-all print:break-inside-avoid">
      {canRemove && (
        <button
          onClick={() => onRemovePuzzle(pIdx)}
          className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-white text-slate-300 hover:text-violet-500 border border-slate-100 rounded-full shadow-md transition-all opacity-0 group-hover/pcontainer:opacity-100 z-30 cursor-pointer"
        >
          <XCircle className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center justify-between pb-3 mb-4 border-b border-violet-100">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
            <span className="text-violet-600 text-xs font-black"></span>
          </div>
          <div>
            <p className="text-[12.1px] font-black text-violet-700 uppercase tracking-widest">
              Quebra-Cabeça {pIdx + 1}
            </p>
            <p className="text-[9.9px] text-slate-400 font-medium mt-0.5">
              Preview Interativo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <InlineSelect
            value={puzzle.pieceCount || 8}
            onChange={(val) =>
              onUpdatePuzzle(pIdx, { pieceCount: Number(val) })
            }
            options={[
              { label: "6 Peças", value: 6, optionColor: "#7c3aed" },
              { label: "8 Peças", value: 8, optionColor: "#7c3aed" },
              { label: "9 Peças", value: 9, optionColor: "#7c3aed" },
              { label: "10 Peças", value: 10, optionColor: "#7c3aed" },
            ]}
            triggerClassName="bg-slate-50 border border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-white"
            size="md"
            align="right"
            className="export-hide"
          />
          {placedPieces.length > 0 && (
            <button
              onClick={() => setPlacedPieces([])}
              className="text-[9.9px] font-black text-violet-500 uppercase tracking-widest hover:text-violet-500 transition-colors px-3 py-1.5 bg-violet-50 rounded-lg border border-violet-100 cursor-pointer export-hide"
            >
              Reiniciar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Grid de peças ─────────────────────────────────────────────── */}
        <div
          className="relative rounded-3xl overflow-hidden border-2 border-violet-200 shadow-xl bg-slate-200"
          style={{ aspectRatio: "2/1" }}
        >
          <img
            src={puzzle.imageUrl || EXAMPLE_PUZZLE_URL}
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover opacity-60 export-full-opacity"
            style={{
              objectPosition: "center",
              maxWidth: "none",
              maxHeight: "none",
            }}
          />
          <div
            className="absolute inset-0 grid export-hide"
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
                  className={`relative cursor-pointer transition-all duration-500 group/piece overflow-hidden ${
                    placed
                      ? "ring-0"
                      : "hover:ring-2 hover:ring-violet-400 hover:ring-inset"
                  }`}
                >
                  <div
                    className={`absolute inset-0 border border-white/20 z-10 pointer-events-none ${
                      placed ? "opacity-0" : ""
                    }`}
                  />
                  {placed ? (
                    <div className="absolute inset-0 overflow-hidden animate-in fade-in duration-500 scale-100">
                      <div
                        className="absolute top-0 left-0 pointer-events-none"
                        style={{
                          width: `${COLS * 100}%`,
                          height: `${ROWS * 100}%`,
                          transform: `translate3d(-${
                            (idx % COLS) * (100 / COLS)
                          }%, -${
                            Math.floor(idx / COLS) * (100 / ROWS)
                          }%, 0)`,
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
                      <span className="text-2xl group-hover/piece:scale-110 transition-transform" />
                      <span className="text-[8.8px] font-black text-violet-500 uppercase tracking-widest opacity-0 group-hover/piece:opacity-100 transition-all">
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



        {/* ── Mensagem de vitória ───────────────────────────────────────── */}
        {placedPieces.length === TOTAL && (
          <div className="flex items-center justify-center p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-4">
              <Award className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest leading-none">
                  Desafio Concluído!
                </p>
                <p className="text-sm font-black text-slate-800 tracking-tight mt-1">
                  Imagens e conceitos dominados
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Descrição da imagem ───────────────────────────────────────── */}
        <div className="bg-violet-50 border border-violet-100 rounded-3xl p-6 shadow-sm mt-8">
          <Field
            label="O QUE ESTA IMAGEM REPRESENTA? (DESCRIÇÃO)"
            value={puzzle.description || ""}
            onChange={(val: string) =>
              onUpdatePuzzle(pIdx, { description: val })
            }
          />
        </div>

        {/* ── Upload de imagem para este quebra-cabeça ──────────────────── */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer border-2 border-dashed border-violet-200 rounded-3xl overflow-hidden hover:border-violet-400 transition-all duration-300 bg-white hover:bg-violet-50 p-6 flex items-center justify-center gap-4 text-center mt-4 export-hide"
        >
          <span className="text-3xl"> </span>
          <div className="text-left">
            <p className="text-[13.2px] font-black text-violet-700">
              Inserir Foto no Canvas (Quebra-Cabeça {pIdx + 1})
            </p>
            <p className="text-[9.9px] text-slate-400 font-medium mt-1">
              Clique para fazer upload da sua própria imagem
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
      </div>
    </div>
  );
};

// ─── Seção completa do jogo (lista de puzzles + questões vinculadas) ────────
interface QuebraCabecaGameProps {
  targets: any[];
  gameLogic: GeneratedContent["gameLogic"];
  onEdit: (field: string, value: any) => void;
  onAdd: (path: string, item: any) => void;
  onRemove: (path: string, index: number) => void;
}

export const QuebraCabecaGame: React.FC<QuebraCabecaGameProps> = ({
  targets,
  gameLogic,
  onEdit,
  onAdd,
  onRemove,
}) => {
  // Compatibilidade com versão antiga (puzzle único) + nova versão (array)
  const puzzles = gameLogic.puzzles || [
    {
      imageUrl: gameLogic.puzzleImageUrl || EXAMPLE_PUZZLE_URL,
      description:
        gameLogic.puzzleDescription ||
        "Monte o quebra-cabeça e responda às questões ao encaixar cada peça!",
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

  const MAX_TARGETS = 10;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center justify-between pb-3 mb-6 border-b border-violet-100">
          <div>
            <p className="text-sm font-black text-violet-700 uppercase tracking-widest">
              DESIGN DO QUEBRA-CABEÇA
            </p>
          </div>
          {puzzles.length < 3 && (
            <button
              onClick={handleAddPuzzle}
              className="print:hidden px-4 py-2 bg-violet-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-violet-700 transition cursor-pointer flex items-center gap-2 shadow-lg shadow-violet-500/30"
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

      {/* ── Questões vinculadas ao quebra-cabeça ────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
            Configurações e Questões ({targets.length})
          </p>
          <div className="flex items-center gap-4">
            {targets.length < MAX_TARGETS ? (
              <button
                onClick={() => {
                  onAdd("targets", {
                    title: `Questão ${targets.length + 1}`,
                    question: `Pergunta pedagógica sobre o tema (Ex: Qual a importância de...?)`,
                    options: [
                      "Texto da primeira alternativa explicativa...",
                      "Texto da segunda alternativa explicativa...",
                      "Texto da terceira alternativa explicativa...",
                    ],
                    answer: "Texto da primeira alternativa explicativa...",
                    isCorrect: true,
                  });
                }}
                className="print:hidden text-[9.9px] flex items-center gap-1 font-black uppercase tracking-widest bg-violet-100 text-violet-600 hover:bg-violet-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-lg leading-none">+</span> Adicionar Questão
              </button>
            ) : (
              <span className="text-[9.9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded">
                Limite Atingido ({MAX_TARGETS})
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 w-full">
          {targets.map((target, i) => {
            return (
              <div
                key={i}
                data-question-card
                className={`group/pz relative p-6 rounded-[2rem] border transition-all ${
                  target.isCorrect
                    ? "bg-violet-50/30 border-violet-100 shadow-sm"
                    : "bg-slate-50/50 border-slate-100"
                } hover:shadow-xl hover:bg-white print:break-inside-avoid`}
              >
                {/* Botão de remover só aparece quando há mais de 3 questões */}
                {targets.length > 3 && (
                  <button
                    onClick={() => onRemove("targets", i)}
                    className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-white border border-slate-100 rounded-full shadow-md z-20 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}


                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-6">
                    <Field
                      label={`QUESTÃO ${i + 1}`}
                      labelClassName="text-emerald-500 group-focus-within/field:text-emerald-600"
                      value={toStr(target.question || target.title)}
                      onChange={(val: string) => {
                        if (!targets[i]) {
                          onEdit(`targets[${i}]`, {
                            ...target,
                            question: val,
                            title: val,
                          });
                        } else {
                          onEdit(`targets[${i}].question`, val);
                          onEdit(`targets[${i}].title`, val);
                        }
                      }}
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
                      Alternativas e Resposta Correta (3 Opções)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(Array.isArray(target.options) &&
                      target.options.length >= 3
                        ? target.options
                        : [
                            "Digite o texto da alternativa...",
                            "Digite o texto da alternativa...",
                            "Digite o texto da alternativa...",
                          ]
                      )
                        .slice(0, 3)
                        .map((opt: string, oi: number) => (
                          <div
                            key={oi}
                            className={`relative p-1 rounded-2xl border-2 transition-all ${
                              target.answer &&
                              opt.trim().toLowerCase() ===
                                target.answer.trim().toLowerCase()
                                ? "border-emerald-400 bg-emerald-50/30"
                                : "border-slate-50"
                            }`}
                          >
                            <div className="pr-4">
                              <Field
                                label={`OPÇÃO ${oi + 1}`}
                                value={toStr(opt)}
                                onChange={(val: string) => {
                                  const currentTarget = targets[i] || target;
                                  const newOpts = [
                                    ...(currentTarget.options || [
                                      "Alternativa Correta",
                                      "Alternativa Incorreta 1",
                                      "Alternativa Incorreta 2",
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
                            </div>
                            <button
                              onClick={() => {
                                if (!targets[i])
                                  onEdit(`targets[${i}]`, {
                                    ...target,
                                    answer: opt,
                                  });
                                else onEdit(`targets[${i}].answer`, opt);
                              }}
                              className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                                target.answer &&
                                opt.trim().toLowerCase() ===
                                  target.answer.trim().toLowerCase()
                                  ? "bg-emerald-500 text-white scale-110"
                                  : "bg-white text-slate-300 hover:text-emerald-500 opacity-0 group-hover/pz:opacity-100"
                              }`}
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
                      value={toStr(
                        target.description || target.feedback || "",
                      )}
                      onChange={(val: string) => {
                        if (!targets[i]) {
                          onEdit(`targets[${i}]`, {
                            ...target,
                            description: val,
                            feedback: val,
                          });
                        } else {
                          onEdit(`targets[${i}].description`, val);
                          onEdit(`targets[${i}].feedback`, val);
                        }
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
