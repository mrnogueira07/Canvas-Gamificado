import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = value !== "all";

  return (
    <div
      className="relative flex flex-col min-w-0 group cursor-pointer flex-1 sm:flex-initial"
      ref={containerRef}
      onClick={() => setIsOpen(!isOpen)}
    >
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 whitespace-nowrap px-1">
        {label}
      </span>
      <div
        className={`flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl transition-all duration-200 border ${
          isActive
            ? "bg-violet-950/40 border-violet-500/50 text-violet-300 shadow-sm ring-1 ring-violet-500/20"
            : "bg-[#15171e] border-[#242735] text-slate-300 hover:border-violet-500/50 hover:bg-[#1a1c25] shadow-sm"
        }`}
      >
        <span className="text-xs font-bold tracking-tight whitespace-nowrap truncate max-w-[110px] xl:max-w-[140px]">
          {isActive ? value : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${
            isActive ? "text-violet-400 font-bold" : "text-slate-400"
          } ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-1.5 w-60 max-w-[calc(100vw-2rem)] bg-[#15171e] backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 border border-[#262938] py-1.5 z-[100] overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("all");
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  !isActive
                    ? "bg-violet-600/20 text-violet-300 font-black border border-violet-500/30"
                    : "text-slate-400 hover:bg-[#1c1e28] hover:text-white"
                }`}
              >
                <span>{placeholder} (Todos)</span>
                {!isActive && <Check className="w-3.5 h-3.5 text-violet-400" />}
              </button>

              <div className="my-1 border-t border-[#232634]" />

              {options.sort().map((o) => {
                const isSelected = value === String(o);
                return (
                  <button
                    key={String(o)}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(String(o));
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                      isSelected
                        ? "bg-violet-600 text-white font-extrabold shadow-sm"
                        : "text-slate-300 hover:bg-[#1c1e28] hover:text-white"
                    }`}
                  >
                    <span className="truncate">{String(o)}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
