/**
 * Cartão padrão de seção do Canvas, com cabeçalho numerado, ícone e cor
 * de destaque. Encapsula o visual repetitivo das etapas (1, 2, 3, ...).
 */
import React from "react";

export interface SectionCardProps {
  number: string;
  title: string;
  icon: React.ReactNode;
  headerColor: string;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  number,
  title,
  icon,
  headerColor,
  children,
  className = "",
}) => (
  <div
    data-canvas-section={number}
    className={`canvas-section-card bg-white rounded-xl border border-slate-200/90 overflow-hidden print:shadow-none print:border-slate-200 print:rounded-lg print:break-inside-avoid print:mb-5 ${className}`}
  >
    <div
      className={`canvas-section-heading px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100 ${headerColor || "bg-slate-50/60"}`}
    >
      <div className="flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/60 flex items-center justify-center shrink-0 print:border-slate-200">
          {icon}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[9.9px] font-semibold uppercase tracking-wider text-slate-400">
              Etapa {number}
            </span>
          </div>
          <span className="text-slate-800 font-semibold tracking-tight text-xs sm:text-sm mt-1">
            {title}
          </span>
        </div>
      </div>
    </div>
    <div className="canvas-section-body p-4 sm:p-6 print:p-5">{children}</div>
  </div>
);
