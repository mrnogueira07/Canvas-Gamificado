/**
 * Lista de alvos no estilo "casa de pergunta" — usado pelos jogos que seguem
 * o padrão de pergunta + 3 alternativas:
 *
 *   - Roleta, Tabuleiro, Arrastar e Soltar, Quiz, Jogo da Velha, Sliding Puzzle
 *
 * Para os jogos do tipo "casa" (Roleta/Tabuleiro), itens marcados como Dica
 * ou conceito informativo aparecem com visual ambar. Para os demais, todos
 * os itens são tratados como desafios pedagógicos.
 */
import React, { useState } from "react";
import { Check, Lightbulb, X, XCircle, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Field } from "./Field";
import { isCorrectAnswer, toStr } from "./utils";

const processImageFile = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    if (file.size > 10 * 1024 * 1024) {
      alert(`Imagem ${file.name} muito grande. Limite de 10MB.`);
      return resolve(null);
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        let w = img.width;
        let h = img.height;
        if (w > h ? w > MAX : h > MAX) {
          if (w > h) {
            h = (h * MAX) / w;
            w = MAX;
          } else {
            w = (w * MAX) / h;
            h = MAX;
          }
        }
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL("image/jpeg", 0.7));
        } else {
          alert("Erro ao processar imagem.");
          resolve(null);
        }
      };
      img.onerror = () => {
        alert("Erro ao processar imagem.");
        resolve(null);
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      alert("Erro ao ler arquivo.");
      resolve(null);
    };
    reader.readAsDataURL(file);
  });

interface HouseQuizTargetsProps {
  targets: any[];
  gameType: string;
  onEdit?: (field: string, value: any) => void;
  onRemove?: (path: string, index: number) => void;
}

export const HouseQuizTargets: React.FC<HouseQuizTargetsProps> = ({
  targets,
  gameType,
  onEdit,
  onRemove,
}) => {
  const [showImagePanel, setShowImagePanel] = useState<Record<number, boolean>>({});
  const [imageUrlInput, setImageUrlInput] = useState<Record<number, string>>({});

  const handleFileChange = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await processImageFile(file);
    if (base64 && onEdit) {
      onEdit(`targets[${idx}].image`, base64);
      setShowImagePanel((prev) => ({ ...prev, [idx]: false }));
    }
    e.target.value = "";
  };

  const handleApplyUrl = (idx: number) => {
    const url = imageUrlInput[idx]?.trim();
    if (!url) return;
    if (onEdit) {
      onEdit(`targets[${idx}].image`, url);
      setShowImagePanel((prev) => ({ ...prev, [idx]: false }));
      setImageUrlInput((prev) => ({ ...prev, [idx]: "" }));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 export-compact-grid">
    {targets.map((target, i) => {
      const targetTitleLabel = (target.title || "").toUpperCase();
      const isHouseType = gameType === "Roleta" || gameType === "Tabuleiro";
      const isDragDropOrQuiz =
        gameType === "Arrastar e Soltar" || gameType === "Quiz";
      const isQuizMode =
        gameType === "Jogo da Velha" || gameType === "Sliding Puzzle";

      // Casas de "Dica" / "Informação" / "Conceito" / "Curiosidade" são apenas informativas
      const isHouseTip =
        (isHouseType || isDragDropOrQuiz) &&
        (targetTitleLabel === "DICA" ||
          targetTitleLabel === "INFORMACAO" ||
          targetTitleLabel === "CONCEITO" ||
          targetTitleLabel === "INFORMATIVO" ||
          targetTitleLabel === "CURIOSIDADE" ||
          !target.options ||
          target.options.length === 0) &&
        target.isCorrect;

      const isHouseQuiz =
        (isHouseType || isDragDropOrQuiz || isQuizMode) &&
        target.isCorrect &&
        !isHouseTip;

      // Calcular o número correto da questão apenas entre as perguntas válidas
      let questionNumber = 0;
      if (target.isCorrect !== false && !isHouseTip) {
        questionNumber = targets.slice(0, i + 1).filter(t => {
          const tTitle = (t.title || "").toUpperCase();
          const tIsHouseTip =
            (gameType === "Roleta" || gameType === "Tabuleiro" || isDragDropOrQuiz) &&
            (tTitle === "DICA" ||
              tTitle === "INFORMACAO" ||
              tTitle === "CONCEITO" ||
              tTitle === "INFORMATIVO" ||
              tTitle === "CURIOSIDADE" ||
              !t.options ||
              t.options.length === 0) &&
            t.isCorrect;
          return t.isCorrect !== false && !tIsHouseTip;
        }).length;
      }

      return (
        <div
          key={i}
          data-question-card
          className={`p-4 rounded-[1.5rem] border transition-all duration-300 relative group/target export-compact-target print:break-inside-avoid ${
            isHouseTip
              ? "bg-white border-amber-200/50 shadow-sm"
              : isHouseQuiz
              ? "bg-white border-emerald-200/50 shadow-sm"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!onEdit) return;
                  const isSliding = gameType === "Sliding Puzzle";
                  const isHouse = gameType === "Roleta" || gameType === "Tabuleiro";
                  
                  if (!isSliding && !isHouse) return;

                  const currentIsCorrect = target.isCorrect !== false;

                  if (isSliding && currentIsCorrect) {
                    const penaltyCount = targets.filter(t => t.isCorrect === false).length;
                    if (penaltyCount >= 5) {
                      alert("Limite máximo de 5 penalidades atingido!");
                      return;
                    }
                  }

                  if (gameType === "Tabuleiro" && !currentIsCorrect) {
                    // Contar questões existentes para limitar em 5
                    const questionCount = targets.filter(t => {
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
                    
                    if (questionCount >= 5) {
                      alert("Limite máximo de 5 questões no tabuleiro atingido!");
                      return;
                    }
                  }

                  const nextIsCorrect = !currentIsCorrect;
                  onEdit(`targets[${i}].isCorrect`, nextIsCorrect);

                  if (!nextIsCorrect) {
                    onEdit(`targets[${i}].options`, []);
                    onEdit(`targets[${i}].answer`, "");
                    onEdit(`targets[${i}].title`, "Penalidade");
                  } else {
                    onEdit(`targets[${i}].options`, ["Alternativa Correta", "Distrator 1", "Distrator 2"]);
                    onEdit(`targets[${i}].answer`, "Alternativa Correta");
                    onEdit(`targets[${i}].title`, `Pergunta ${i + 1}`);
                  }
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black ${
                  target.isCorrect !== false
                    ? isHouseTip
                      ? "bg-amber-100 text-amber-600"
                      : "bg-emerald-100 text-emerald-600"
                    : "bg-slate-100 text-slate-400"
                } ${((gameType === "Sliding Puzzle" || isHouseType) && onEdit) ? "cursor-pointer hover:scale-105" : "cursor-default"} transition-transform`}
              >
                {target.isCorrect !== false ? (
                  isHouseTip ? (
                    <Lightbulb className="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
              <span
                className={`text-[11px] font-black tracking-[0.2em] uppercase ${
                  isHouseTip
                    ? "text-amber-600"
                    : target.isCorrect !== false
                    ? "text-emerald-600"
                    : "text-rose-500"
                }`}
              >
                {isHouseTip 
                  ? (target.title || "CURIOSIDADE").toUpperCase() 
                  : target.isCorrect !== false 
                  ? `QUESTÃO ${questionNumber}` 
                  : "PENALIDADE"}
              </span>
            </div>
            {onRemove && (
              <button
                onClick={() => onRemove("targets", i)}
                className="text-slate-300 hover:text-violet-500 opacity-0 group-hover/target:opacity-100 transition-opacity"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {onEdit ? (
              <div className="space-y-2">
                <Field
                  label=""
                  value={target.question || target.title || ""}
                  onChange={(v) => {
                    onEdit(`targets[${i}].question`, v);
                    onEdit(`targets[${i}].title`, v);
                  }}
                />
                {isDragDropOrQuiz && (
                  <div className="mt-1">
                    {target.image ? (
                      <div className="relative w-full max-w-xs aspect-video bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-2 mx-auto group/img">
                        <img src={target.image} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => onEdit(`targets[${i}].image`, "")}
                          className="absolute top-2 right-2 p-1.5 bg-white hover:bg-rose-50 text-rose-500 rounded-lg shadow border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                          title="Remover imagem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {!showImagePanel[i] ? (
                          <button
                            type="button"
                            onClick={() => setShowImagePanel((prev) => ({ ...prev, [i]: true }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-500 hover:text-violet-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            + Adicionar Imagem
                          </button>
                        ) : (
                          <div className="p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                Adicionar Imagem
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowImagePanel((prev) => ({ ...prev, [i]: false }))}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id={`file-input-${i}`}
                                onChange={(e) => handleFileChange(i, e)}
                              />
                              <label
                                htmlFor={`file-input-${i}`}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Upload
                              </label>

                              <div className="flex-1 flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Cole o link da imagem..."
                                  value={imageUrlInput[i] || ""}
                                  onChange={(e) =>
                                    setImageUrlInput((prev) => ({ ...prev, [i]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleApplyUrl(i);
                                    }
                                  }}
                                  className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-violet-400 transition-all font-medium text-slate-700 placeholder-slate-300"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleApplyUrl(i)}
                                  className="px-3 py-1.5 bg-violet-500 text-white rounded-lg text-xs font-bold hover:bg-violet-600 transition-colors cursor-pointer"
                                >
                                  Aplicar
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/40 p-4 rounded-2xl border border-slate-200/50 shadow-sm space-y-2">
                <p className="text-[14.3px] font-bold text-slate-800 leading-relaxed">
                  {target.question || target.title}
                </p>
                {isDragDropOrQuiz && target.image && (
                  <div className="w-full max-w-sm aspect-video bg-slate-50 border border-slate-100 rounded-xl overflow-hidden mt-2 mx-auto">
                    <img src={target.image} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}

            {isHouseQuiz && (
              <div className="grid grid-cols-1 gap-2 pt-2">
                {(Array.isArray(target.options) && target.options.length >= 3
                  ? target.options
                  : [
                      "Digite o texto da alternativa...",
                      "Digite o texto da alternativa...",
                      "Digite o texto da alternativa...",
                    ]
                )
                  .slice(0, 3)
                  .map((opt: string, optIdx: number) => {
                    const isCorrect =
                      isCorrectAnswer(opt, target.answer || "", optIdx) ||
                      (target.answer === undefined && optIdx === 0);
                    return (
                      <div
                        key={optIdx}
                        onClick={() =>
                          onEdit && onEdit(`targets[${i}].answer`, opt)
                        }
                        className={`rounded-[1.25rem] border transition-all duration-500 relative overflow-hidden ${
                          isCorrect
                            ? "bg-emerald-500 border-emerald-600 shadow-[0_8px_20px_rgba(16,185,129,0.25)] scale-[1.02] z-10"
                            : "bg-white border-slate-100 hover:border-violet-200 hover:bg-slate-50/50"
                        } ${onEdit ? "cursor-pointer" : ""}`}
                      >
                        {onEdit ? (
                          <Field
                            label=""
                            prefix={`${String.fromCharCode(65 + optIdx)})`}
                            value={opt}
                            onChange={(v) => {
                              const baseOpts =
                                Array.isArray(target.options) &&
                                target.options.length >= 3
                                  ? target.options
                                  : [
                                      "Digite o texto da alternativa...",
                                      "Digite o texto da alternativa...",
                                      "Digite o texto da alternativa...",
                                    ];
                              const newOpts = [...baseOpts];
                              newOpts[optIdx] = v;
                              onEdit(`targets[${i}].options`, newOpts);
                              if (isCorrect) {
                                onEdit(`targets[${i}].answer`, v);
                              }
                            }}
                            isCorrect={isCorrect}
                          />
                        ) : (
                          <div
                            className={`p-4 flex items-center justify-between gap-3 ${
                              isCorrect ? "text-white" : "text-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <span
                                className={`font-black text-xs px-2 py-1 rounded-lg ${
                                  isCorrect
                                    ? "bg-white/20 text-white"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="text-sm font-bold tracking-tight">
                                {toStr(opt)}
                              </span>
                            </div>
                            {isCorrect && (
                              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg">
                                <Check className="w-4 h-4 text-emerald-500 font-bold" />
                              </div>
                            )}
                          </div>
                        )}
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
};
