/**
 * Item de resumo (Tempo Sugerido, Total de Fases, Dificuldade).
 * Exibe um pequeno cartão padronizado com ícone, rótulo e campo editável.
 */
import React from "react";
import { Field } from "./Field";
import { safeString } from "./utils";

interface SummaryItemProps {
  icon: React.ReactNode;
  label: string;
  value: any;
  onChange: (v: string) => void;
}

export const SummaryItem: React.FC<SummaryItemProps> = ({
  icon,
  label,
  value,
  onChange,
}) => (
  <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100/50 hover:bg-white transition-all">
    <div className="flex items-center gap-2 mb-2 ml-1">
      {icon}
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
        {safeString(label)}
      </span>
    </div>
    <Field label="" value={safeString(value)} onChange={onChange} />
  </div>
);
