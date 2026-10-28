import React from "react";
import { motion } from "framer-motion";

const INNYX_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/canvasgame-2025.firebasestorage.app/o/Logos%2FLOGO-ICON-INNYX.png?alt=media&token=b0a8e255-7801-48ed-a560-aa32eac3a8f4";

export const LoadingAnimation: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center h-full min-h-[440px] max-w-md mx-auto select-none">
      {/* ── CARD TRANSLÚCIDO EM GLASSMORPHISM MINIMALISTA ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full bg-white/10 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 px-8 py-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] flex flex-col items-center relative overflow-hidden"
      >
        {/* Reflexos sutis de iluminação de fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-fuchsia-500/15 blur-3xl pointer-events-none" />

        {/* ── LOGO OFICIAL INNYX ANIMADA E FLUTUANTE ── */}
        <div className="relative flex items-center justify-center w-36 h-36 mb-5">
          {/* Brilho suave difuso atrás da logo */}
          <div className="absolute inset-4 rounded-full bg-purple-500/20 blur-2xl animate-pulse pointer-events-none" />

          {/* Logo com animação suave de flutuação e escala */}
          <motion.div
            animate={{
              y: [0, -8, 0],
              scale: [1, 1.04, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative z-10 w-28 h-28 flex items-center justify-center filter drop-shadow-[0_10px_28px_rgba(168,85,247,0.5)]"
          >
            <img
              src={INNYX_LOGO_URL}
              alt="Logo INNYX"
              className="w-full h-full object-contain select-none pointer-events-none"
            />
          </motion.div>
        </div>

        {/* ── TÍTULO E SUBTÍTULO MINIMALISTAS ── */}
        <div className="space-y-1.5 mb-7">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
            Criando seu Canvas
          </h3>
          <p className="text-xs sm:text-sm font-medium text-white/70 tracking-wide">
            Preparando seu planejamento pedagógico...
          </p>
        </div>

        {/* ── BARRA DE CARREGAMENTO SUTIL & MINIMALISTA ── */}
        <div className="w-full max-w-[240px] space-y-2.5">
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/15 relative">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-300 to-violet-400 shadow-[0_0_12px_rgba(232,121,249,0.7)]"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ width: "50%" }}
            />
          </div>
          <p className="text-[11px] font-semibold text-white/40 tracking-widest uppercase text-center">
            Aguarde um instante
          </p>
        </div>
      </motion.div>
    </div>
  );
};
