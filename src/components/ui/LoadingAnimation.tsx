import React from "react";
import { motion } from "framer-motion";
import { Wand2, Sparkles, BrainCircuit } from "lucide-react";

export const LoadingAnimation: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[500px]">
      {/* Ícone Central Premium */}
      <div className="relative mb-12">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 8, repeat: Infinity, ease: "linear" },
            scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          }}
          className="w-32 h-32 bg-slate-100 border-2 border-slate-200/50 rounded-[3rem] flex items-center justify-center relative z-10 backdrop-blur-xl shadow-2xl"
        >
          <div className="relative">
            <Wand2 className="w-14 h-14 text-indigo-500" />
            <motion.div
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="w-6 h-6 text-amber-400" />
            </motion.div>
          </div>
        </motion.div>

        {/* Orbes orbitais */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute top-1/2 left-1/2 w-3 h-3 rounded-full ${i === 0 ? "bg-indigo-500" : i === 1 ? "bg-emerald-400" : "bg-purple-400"} blur-[1px]`}
            animate={{
              x: [
                Math.cos(i * 120 * (Math.PI / 180)) * 80,
                Math.cos((i * 120 + 360) * (Math.PI / 180)) * 80,
              ],
              y: [
                Math.sin(i * 120 * (Math.PI / 180)) * 80,
                Math.sin((i * 120 + 360) * (Math.PI / 180)) * 80,
              ],
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Glow de fundo */}
        <div className="absolute inset-0 bg-indigo-500/10 blur-[60px] rounded-full scale-150" />
      </div>

      {/* Texto Animado */}
      <div className="space-y-4 max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2"
        >
          <BrainCircuit className="w-4 h-4 text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            IA Cognitiva Ativa
          </span>
        </motion.div>

        <motion.h3
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-2xl font-black text-slate-800 tracking-tight"
        >
          Criando Magia Educacional
        </motion.h3>

        <p className="text-slate-500 text-sm leading-relaxed font-medium">
          Nossa inteligência artificial está transformando seus dados em um{" "}
          <span className="text-indigo-500 font-bold">
            planejamento gamificado
          </span>{" "}
          épico e memorável.
        </p>

        {/* Barra de progresso fake premium */}
        <div className="mt-8 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"
            animate={{
              x: ["-100%", "0%", "100%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
};
