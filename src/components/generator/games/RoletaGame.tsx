/**
 * Jogo da Roleta.
 *
 * Estrutura:
 *  - Casas de Pergunta (roxo escuro) extraídas de `questions` (targets)
 *  - Casas de Dica (amber) / Penalidade (rose) extraídas de `roletaSegments`
 *
 * O aluno gira a roleta e cai em uma dessas casas.
 * O painel ao lado exibe o conteúdo completo de acordo com o tipo de casa.
 */
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, Trash2, Zap, Lightbulb, AlertTriangle, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Field } from "../shared/Field";

interface RoletaPreviewProps {
  roletaSegments: any[];
  questions: any[];
  onUpdate: (
    index: number,
    fieldOrPatch: string | Record<string, any>,
    value?: any,
  ) => void;
  onRemove: (index: number) => void;
  onAdd: (type: "Dica" | "Penalidade") => void;
}

export const RoletaPreview: React.FC<RoletaPreviewProps> = ({
  roletaSegments,
  questions,
  onUpdate,
  onRemove,
  onAdd,
}) => {
  const [landed, setLanded] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Lock scroll on body when modal is open
  useEffect(() => {
    if (showAddModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAddModal]);

  // Fallback para 4 segmentos padrão de dicas e penalidades caso esteja vazio
  const defaultSegments = [
    {
      title: "Dica Pedagógica 1",
      isCorrect: true,
      points: 0,
      description: "Conteúdo importante sobre o tema",
    },
    {
      title: "Emboscada Inimiga!",
      isCorrect: false,
      points: -10,
      description: "Opa, entrei na trincheira inimiga e fui pego! Preciso recuar.",
    },
    {
      title: "Dica de Ouro",
      isCorrect: true,
      points: 10,
      description: "Informação chave do tema",
    },
    {
      title: "Armadilha Oculta",
      isCorrect: false,
      points: -15,
      description: "Pisei em uma armadilha temática! Volte duas casas e tente focar mais.",
    },
  ];

  // 1. Mapear as perguntas pedagógicas (Section 5.1)
  const questionSectors = (questions || []).map((q, idx) => ({
    type: "question" as "question" | "dica" | "penalidade",
    originalIndex: idx,
    title: q.title || `Pergunta ${idx + 1}`,
    description: q.question || q.title || "",
    options: q.options || [],
    answer: q.answer || "",
    feedback: q.feedback || "",
    isCorrect: true,
    points: q.points || 0,
  }));

  // 2. Mapear dicas e penalidades (Section 5.2)
  const rawSegments = roletaSegments && roletaSegments.length > 0 ? roletaSegments : defaultSegments;
  const segmentSectors = rawSegments.map((seg, idx) => ({
    type: (seg.isCorrect === false ? "penalidade" : "dica") as "question" | "dica" | "penalidade",
    originalIndex: idx,
    title: seg.title || (seg.isCorrect === false ? "Penalidade" : "Dica"),
    description: seg.description || seg.feedback || "",
    options: seg.options || [],
    answer: seg.answer || "",
    feedback: seg.feedback || "",
    isCorrect: seg.isCorrect !== false,
    points: typeof seg.points === "number" ? seg.points : (seg.isCorrect === false ? -10 : 5),
  }));

  // 3. Mesclar alternando Pergunta -> Dica/Penalidade
  const combinedSectors: any[] = [];
  const maxSectors = Math.max(questionSectors.length, segmentSectors.length);
  for (let i = 0; i < maxSectors; i++) {
    if (i < questionSectors.length) {
      combinedSectors.push(questionSectors[i]);
    }
    if (i < segmentSectors.length) {
      combinedSectors.push(segmentSectors[i]);
    }
  }

  const segCount = combinedSectors.length || 1;
  const segAngle = 360 / segCount;

  // Cores por tipo de casa (Roxo escuro para perguntas, Amber/Rose para dicas/penalidades)
  const getSectorColor = (sector: any) => {
    if (!sector) return ["#64748b", "#475569"];
    if (sector.type === "question") {
      return ["#4c1d95", "#2e1065"]; // Roxo escuro premium (Violet-900 / Violet-950)
    }
    if (sector.type === "penalidade") {
      return ["#f43f5e", "#be123c"]; // Rose-500 / Rose-700
    }
    return ["#f59e0b", "#b45309"]; // Amber-500 / Amber-700
  };



  return (
    <div
      className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden print:break-inside-avoid relative"
      id="roleta-preview"
    >
      <div className="px-8 py-5 flex items-center justify-between border-b bg-amber-50/50 border-amber-100/50">
        <div className="flex items-center gap-4">
          <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-amber-500 font-black text-lg">5.2</span>
            <span className="text-slate-700 font-black uppercase tracking-widest text-[12.1px]">
              Preview Roleta Interativa
            </span>
          </div>
        </div>
      </div>

      <div className="p-8 flex flex-col md:flex-row items-center gap-12 justify-center bg-slate-50/30">
        {/* ── Roda SVG ────────────────────────────────────────────────── */}
        <div className="relative flex-shrink-0">
          {/* Sleek triangular pointer pointing down */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md border-2 border-slate-800">
              <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
            </div>
            <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[14px] border-l-transparent border-r-transparent border-t-amber-500 drop-shadow-md -mt-1" />
          </div>

          <svg
            width={240}
            height={240}
            viewBox="0 0 240 240"
            className="drop-shadow-xl select-none"
          >
            <defs>
              <radialGradient id="centerGold" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="70%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
              <radialGradient id="innerShadow" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="transparent" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
              </radialGradient>
            </defs>

            {/* Slices */}
            <g
              style={{
                transformOrigin: "120px 120px",
              }}
            >
              {combinedSectors.map((seg, i) => {
                const startAngle = i * segAngle - 90;
                const endAngle = startAngle + segAngle;
                const r = 104; // Inside the border ring
                const cx = 120;
                const cy = 120;
                const toRad = (d: number) => (d * Math.PI) / 180;
                const x1 = cx + r * Math.cos(toRad(startAngle));
                const y1 = cy + r * Math.sin(toRad(startAngle));
                const x2 = cx + r * Math.cos(toRad(endAngle));
                const y2 = cy + r * Math.sin(toRad(endAngle));
                const largeArc = segAngle > 180 ? 1 : 0;
                const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                const [fill] = getSectorColor(seg);
                const midAngle = startAngle + segAngle / 2;
                const tr = r * 0.62;
                const tx = cx + tr * Math.cos(toRad(midAngle));
                const ty = cy + tr * Math.sin(toRad(midAngle));

                // Clean prefix and slice to fit well inside wheel
                const label = (seg.title || "Casa")
                  .replace(/^(Pergunta|Questão|Dica|Penalidade)\s*\d*:\s*/i, "")
                  .slice(0, 11);

                return (
                  <g
                    key={i}
                    onClick={() => setLanded(i)}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <path
                      d={pathD}
                      fill={fill}
                      stroke={landed === i ? "#ffffff" : "#ffffff"}
                      strokeWidth={landed === i ? 3 : 1.5}
                      strokeOpacity={landed === i ? 0.95 : 0.25}
                    />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={segCount > 8 ? 6 : (segCount > 6 ? 7 : 8)}
                      fontWeight="900"
                      fill="white"
                      transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Static Outer Border (Ring) */}
            <circle
              cx={120}
              cy={120}
              r={112}
              fill="none"
              stroke="#1e293b"
              strokeWidth={12}
            />

            {/* Static flashing light bulbs (dots) around the ring */}
            {Array.from({ length: 16 }).map((_, idx) => {
              const angle = (idx * 360) / 16;
              const rad = (angle * Math.PI) / 180;
              const lx = 120 + 112 * Math.cos(rad);
              const ly = 120 + 112 * Math.sin(rad);
              const isEven = idx % 2 === 0;
              return (
                <circle
                  key={idx}
                  cx={lx}
                  cy={ly}
                  r={2.5}
                  fill={isEven ? "#ffffff" : "#fbbf24"}
                  className="animate-pulse"
                  style={{
                    animationDelay: `${idx * 0.15}s`,
                    animationDuration: "1s",
                  }}
                />
              );
            })}

            {/* Static central axis pin / Cap */}
            <circle
              cx={120}
              cy={120}
              r={18}
              fill="#1e293b"
              stroke="url(#centerGold)"
              strokeWidth={1.5}
            />
            <circle cx={120} cy={120} r={10} fill="url(#centerGold)" />
            <circle cx={120} cy={120} r={4} fill="#ffffff" />
            <circle cx={120} cy={120} r={10} fill="url(#innerShadow)" />
          </svg>

          {/* Static Outer Rim Drop Shadow */}
          <div
            className="absolute inset-0 rounded-full border-[6px] border-slate-800 shadow-[0_8px_32px_rgba(0,0,0,0.15)] pointer-events-none"
            style={{ borderRadius: "50%" }}
          />
        </div>

        {/* ── Resultado + Legenda + Mecânica ─────────────────────────── */}
        <div className="space-y-4 max-w-xs w-full">
          {/* Casa em que parou */}
          {landed !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 rounded-2xl border-2 text-center shadow-md bg-white max-h-[320px] overflow-y-auto"
              style={{
                borderColor: getSectorColor(combinedSectors[landed])[0],
              }}
            >
              {(() => {
                const sector = combinedSectors[landed];
                const isQuest = sector.type === "question";
                const isPenal = sector.type === "penalidade";

                if (isQuest) {
                  return (
                    <div className="text-left space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                          <HelpCircle className="w-4 h-4" />
                        </div>
                        <span className="text-[9.9px] font-black text-purple-700 uppercase tracking-widest">
                          Pergunta Pedagógica
                        </span>
                      </div>

                      <p className="text-xs font-black text-slate-800 leading-snug">
                        {sector.title}
                      </p>
                      
                      <p className="text-[12.1px] text-slate-600 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {sector.description}
                      </p>

                      {sector.options && sector.options.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {sector.options.slice(0, 4).map((opt: string, oi: number) => {
                            const isCorrect = sector.answer && opt.trim().toLowerCase() === sector.answer.trim().toLowerCase();
                            return (
                              <div
                                key={oi}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-[11px] font-bold transition-all ${
                                  isCorrect
                                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                                    : "bg-slate-50 text-slate-700 border-slate-100"
                                }`}
                              >
                                <span
                                  className={`w-4.5 h-4.5 rounded flex items-center justify-center text-[9.9px] font-black shrink-0 ${
                                    isCorrect ? "bg-white/20" : "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span className="leading-tight flex-1">{opt}</span>
                                {isCorrect && <Check className="w-3 h-3 shrink-0 self-center" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {sector.feedback && (
                        <div className="mt-3 p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-[9.9px] leading-relaxed italic">
                          <strong>Explicação:</strong> {sector.feedback}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // Dica ou Penalidade
                  return (
                    <div className="text-left space-y-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isPenal ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isPenal ? <AlertTriangle className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
                        </div>
                        <span
                          className={`text-[9.9px] font-black uppercase tracking-widest ${
                            isPenal ? "text-rose-700" : "text-amber-700"
                          }`}
                        >
                          {isPenal ? "Penalidade / Obstáculo" : "Dica Temática"}
                        </span>
                      </div>

                      <p className="text-xs font-black text-slate-800 leading-snug">
                        {sector.title}
                      </p>

                      <p className="text-[12.1px] text-slate-600 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {sector.description}
                      </p>

                      {sector.points !== 0 && (
                        <div className="pt-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9.9px] font-black uppercase tracking-wider text-white shadow-sm ${
                              sector.points > 0 ? "bg-emerald-500 shadow-emerald-200" : "bg-rose-500 shadow-rose-200"
                            }`}
                          >
                            {sector.points > 0 ? `+${sector.points}` : sector.points} Pontos
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
              })()}
            </motion.div>
          )}

          {/* Legenda de tipos de casa */}
          <div className="space-y-2">
            <p className="text-[9.9px] font-black text-slate-400 uppercase tracking-widest">
              Legenda da Roleta
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Pergunta", color: "#4c1d95" },
                { label: "Dica", color: "#f59e0b" },
                { label: "Penalidade", color: "#f43f5e" },
              ].map(({ label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-100 shadow-sm"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-[9.9px] font-black text-slate-600 uppercase tracking-wider">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo da mecânica */}
          <div className="p-5 bg-amber-50/60 border border-amber-100 rounded-2xl">
            <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1.5">
              Mecânica
            </p>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Clique nas casas da roleta para pré-visualizar seu conteúdo no painel ao lado. No jogo real, o aluno girará a roleta e cairá em uma das{" "}
              <span className="text-amber-600 font-bold">{segCount} casas</span>.
              Casas de <span className="text-purple-700 font-bold">Pergunta</span> revelam desafios que valem acertos. 
              Casas de <span className="text-amber-500 font-bold">Dica</span> mostram curiosidades sobre o tema. 
              Casas de <span className="text-rose-500 font-bold">Penalidade</span> subtraem pontos na pontuação do aluno.
            </p>
          </div>
        </div>
      </div>

      {/* ── Editor das dicas e penalidades (texto + pontos) ──────────────────── */}
      <div className="px-8 pb-8 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <span>📋</span> Conteúdo das {rawSegments.length} Casas Customizáveis (Dicas / Penalidades)
          </p>
          {rawSegments.length < 6 ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowAddModal(true);
              }}
              className="print:hidden flex items-center gap-1.5 px-3.5 py-2 bg-violet-50 text-violet-600 border border-violet-100/60 rounded-xl text-[9.9px] font-black uppercase tracking-widest hover:bg-violet-100/80 transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Adicionar Casa
            </button>
          ) : (
            <span className="text-[9.9px] font-black text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100/50 shadow-sm select-none uppercase tracking-widest">
              Limite Atingido (6)
            </span>
          )}
        </div>
        <div className="flex flex-col gap-5">
          {rawSegments.map((seg: any, i: number) => {
            const isPenal = seg.isCorrect === false;
            const [color] = getSectorColor(isPenal ? { type: "penalidade" } : { type: "dica" });
            const typeLabel = isPenal ? "Penalidade" : "Dica";

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`relative rounded-3xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-br print:break-inside-avoid ${
                  isPenal
                    ? "from-white to-rose-50/10 hover:border-rose-300/80 border-rose-100/70"
                    : "from-white to-amber-50/10 hover:border-amber-300/80 border-amber-100/70"
                }`}
              >
                {/* Faixa de cor */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ background: color }}
                />
                <div className="pl-6 pr-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center text-white shrink-0 shadow-md ${
                          isPenal
                            ? "bg-gradient-to-br from-rose-400 to-rose-500 shadow-rose-500/20"
                            : "bg-gradient-to-br from-amber-400 to-amber-500 shadow-amber-500/20"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={`text-[9.9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                          isPenal
                            ? "bg-rose-50/80 text-rose-600 border-rose-200/50"
                            : "bg-amber-50/80 text-amber-600 border-amber-200/50"
                        }`}
                      >
                        {typeLabel}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemove(i)}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-all duration-200 hover:scale-105 active:scale-95 border-none bg-transparent cursor-pointer"
                      title="Remover casa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Título */}
                  <div className="mb-2 min-h-[1.5em] group/edit">
                    <Field
                      value={seg.title}
                      onChange={(val) => {
                        onUpdate(i, "title", val);
                      }}
                      label=""
                      inputClassName="w-full text-sm font-extrabold text-slate-800 bg-white/40 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200/80 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/5 rounded-xl transition-all duration-300 p-2.5 outline-none"
                    />
                  </div>

                  {/* Descrição */}
                  <div className="mb-2 min-h-[1em] group/edit">
                    <Field
                      value={seg.description}
                      onChange={(val) => {
                        onUpdate(i, "description", val);
                      }}
                      label=""
                      inputClassName="w-full text-xs font-semibold text-slate-500 bg-white/40 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200/80 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/5 rounded-xl transition-all duration-300 p-2.5 outline-none leading-relaxed"
                    />
                  </div>

                  {/* Indicador de pontos */}
                  {typeof seg.points === "number" && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[9.9px] font-black px-3 py-1 rounded-full border tracking-wide uppercase ${
                          seg.points > 0
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : seg.points < 0
                            ? "bg-rose-50 text-rose-600 border-rose-100"
                            : "bg-slate-50 text-slate-500 border-slate-200/60"
                        }`}
                      >
                        {seg.points > 0 ? `+${seg.points}` : seg.points} pts
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden"
              >
                <div className="p-6 text-center">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">
                    Adicionar Nova Casa
                  </h3>
                  <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
                    Selecione o tipo de casa que deseja adicionar à roleta. A IA analisará o conteúdo do seu planejamento para gerar algo personalizado.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onAdd("Dica");
                        setShowAddModal(false);
                      }}
                      className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-amber-100 hover:border-amber-500 bg-amber-50/30 hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-100/50 transition-all group cursor-pointer text-left border-solid"
                    >
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                        <Lightbulb className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <span className="block text-xs font-black text-amber-700 uppercase tracking-wider mb-1">
                          Dica
                        </span>
                        <span className="block text-[11px] text-slate-500 font-medium leading-tight">
                          Curiosidades e conceitos pedagógicos extras
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onAdd("Penalidade");
                        setShowAddModal(false);
                      }}
                      className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-rose-100 hover:border-rose-500 bg-rose-50/30 hover:bg-rose-50 hover:shadow-lg hover:shadow-rose-100/50 transition-all group cursor-pointer text-left border-solid"
                    >
                      <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <span className="block text-xs font-black text-rose-700 uppercase tracking-wider mb-1">
                          Penalidade
                        </span>
                        <span className="block text-[11px] text-slate-500 font-medium leading-tight">
                          Obstáculos e perigos que tiram pontos
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
                
                <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100 gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAddModal(false);
                    }}
                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
