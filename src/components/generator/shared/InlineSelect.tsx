/**
 * Select inline customizado, usado dentro de cards e linhas onde um <select>
 * padrão ficaria visualmente quebrado. Suporta tamanho compacto (sm/md),
 * alinhamento do dropdown e cor por opção.
 */
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface InlineSelectOption {
  label: string;
  value: any;
  optionColor?: string;
}

export interface InlineSelectProps {
  value: any;
  onChange: (val: any) => void;
  options: InlineSelectOption[];
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  align?: "left" | "right";
  size?: "sm" | "md";
  className?: string;
}

export const InlineSelect: React.FC<InlineSelectProps> = ({
  value,
  onChange,
  options,
  triggerClassName = "",
  triggerStyle = {},
  align = "left",
  size = "sm",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredVal, setHoveredVal] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora do componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-1 border transition-all duration-200 select-none cursor-pointer ${
          size === "sm"
            ? "px-2 py-0.5 rounded-md text-[8.8px] font-black uppercase tracking-widest"
            : "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest"
        } ${triggerClassName}`}
        style={triggerStyle}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown
          className={`shrink-0 transition-transform duration-200 ${
            size === "sm" ? "w-2.5 h-2.5 ml-1" : "w-3 h-3 ml-1.5"
          } ${isOpen ? "rotate-180 text-current" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className={`absolute z-[250] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-900/10 overflow-hidden min-w-[110px] py-1 ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <div className="max-h-52 overflow-y-auto custom-scrollbar">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                const activeBg = opt.optionColor
                  ? `${opt.optionColor}0c`
                  : "rgba(109, 40, 217, 0.05)";
                const hoverBg = opt.optionColor
                  ? `${opt.optionColor}14`
                  : "rgba(109, 40, 217, 0.08)";

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                      size === "sm" ? "text-[8.8px]" : "text-[9.9px]"
                    }`}
                    style={{
                      color: opt.optionColor,
                      backgroundColor: isSelected
                        ? activeBg
                        : hoveredVal === opt.value
                        ? hoverBg
                        : "transparent",
                    }}
                    onMouseEnter={() => setHoveredVal(opt.value)}
                    onMouseLeave={() => setHoveredVal(null)}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check
                        className="shrink-0 ml-1.5"
                        style={{
                          width: size === "sm" ? "10px" : "12px",
                          height: size === "sm" ? "10px" : "12px",
                          color: opt.optionColor,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
