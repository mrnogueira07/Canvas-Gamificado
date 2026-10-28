/**
 * Campo editável genérico usado em quase todas as seções do Canvas.
 *
 * É um `contentEditable` controlado: aceita uma `value` externa e dispara
 * `onChange` apenas no blur, evitando re-renderizações a cada tecla pressionada.
 *
 * Sempre converte o valor recebido para string segura antes de exibir,
 * impedindo que objetos/arrays vindos da IA causem o erro #31 do React.
 */
import React, { useEffect, useRef, useState } from "react";
import { PencilLine } from "lucide-react";

export interface FieldProps {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  readonly?: boolean;
  prefix?: string;
  isCorrect?: boolean;
  labelClassName?: string;
  inputClassName?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  value,
  onChange,
  readonly = false,
  prefix,
  isCorrect = false,
  labelClassName,
  inputClassName,
}) => {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);

  // Converte SEMPRE para string segura — nunca renderiza objetos ou eventos
  const extractTextFromJsonLikeString = (str: string): string => {
    const cleanStr = str.trim();
    if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
      const keyRegex = /(?:"(?:text|texto|option|opcao|value|valor|resposta)"|'(?:text|texto|option|opcao|value|valor|resposta)')\s*:\s*(?:"([^"]*)"|'([^']*)')/i;
      const match = cleanStr.match(keyRegex);
      if (match) {
        return match[1] || match[2] || '';
      }
      const anyQuoteRegex = /(?:"([^"]*)"|'([^']*)')/g;
      const keys = ['text', 'texto', 'option', 'opcao', 'value', 'valor', 'resposta', 'iscorrect', 'points', 'feedback'];
      let m;
      while ((m = anyQuoteRegex.exec(cleanStr)) !== null) {
        const val = m[1] || m[2];
        if (val && !keys.includes(val.toLowerCase())) {
          return val;
        }
      }
    }
    return '';
  };

  const unpackJsonText = (parsed: Record<string, unknown> | null | undefined): string => {
    if (!parsed || typeof parsed !== 'object') return '';
    const keysToCheck = ['text', 'texto', 'option', 'opcao', 'value', 'valor', 'resposta'];
    for (const key of keysToCheck) {
      if (key in parsed && parsed[key] !== undefined && parsed[key] !== null) {
        return String(parsed[key]);
      }
    }
    for (const key of Object.keys(parsed)) {
      if (typeof parsed[key] === 'string' && parsed[key].trim().length > 0) {
        return parsed[key];
      }
    }
    for (const key of Object.keys(parsed)) {
      if (typeof parsed[key] === 'number' || typeof parsed[key] === 'boolean') {
        return String(parsed[key]);
      }
    }
    return '';
  };

  const safeValue = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        try {
          const parsed = JSON.parse(trimmed);
          return safeValue(parsed);
        } catch { /* ignore */ }
      }
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object") {
            const unpacked = unpackJsonText(parsed);
            if (unpacked) return safeValue(unpacked);
          } else if (typeof parsed === "string") {
            return safeValue(parsed);
          }
        } catch {
          const extracted = extractTextFromJsonLikeString(trimmed);
          if (extracted) return safeValue(extracted);
        }
      }
      return v;
    }
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map(safeValue).join(", ");
    if (typeof v === "object") {
      const unpacked = unpackJsonText(v as Record<string, unknown>);
      if (unpacked) return safeValue(unpacked);
      try {
        return JSON.stringify(v);
      } catch {
        return "";
      }
    }
    return String(v);
  };

  const strValue = safeValue(value);

  // Atualiza o texto exibido apenas quando o campo NÃO está em foco,
  // evitando que a digitação seja sobrescrita por re-renderizações pai
  useEffect(() => {
    if (!divRef.current || focused) return;
    divRef.current.innerText = strValue;
  }, [strValue, focused]);

  return (
    <div className="canvas-field w-full group/field relative">
      {label && (
        <div className="flex items-center justify-between mb-1.5 ml-1">
          <h4
            className={`text-xs font-semibold tracking-normal transition-colors ${
              labelClassName || "text-slate-500 group-focus-within/field:text-violet-600"
            }`}
          >
            {label}
          </h4>
          {!readonly && (
            <div className="opacity-0 group-hover/field:opacity-100 transition-opacity">
              <PencilLine
                className={`w-3.5 h-3.5 ${
                  isCorrect ? "text-emerald-300" : "text-violet-400"
                }`}
              />
            </div>
          )}
        </div>
      )}
      <div className="flex items-center relative transition-transform">
        {prefix && (
          <span
            className={`absolute left-4 font-black text-xs select-none transition-colors z-10 ${
              isCorrect
                ? "text-emerald-100"
                : "text-slate-400 group-focus-within/field:text-violet-500"
            }`}
          >
            {prefix}
          </span>
        )}
        <div
          ref={divRef}
          contentEditable={!readonly}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const newVal = divRef.current?.innerText || "";
            if (newVal !== strValue) onChange(newVal);
          }}
          role="textbox"
          aria-label={label || "Campo do canvas"}
          aria-readonly={readonly}
          aria-multiline="true"
          className={inputClassName || `w-full text-xs sm:text-sm font-normal leading-relaxed outline-none rounded-lg transition-all relative border text-slate-800 ${
            readonly
              ? "text-slate-600 italic bg-slate-50/50 border-slate-200/60 p-3"
              : isCorrect
              ? "border-emerald-500/30 bg-emerald-500 text-white p-3.5"
              : "border-slate-200 hover:border-violet-300 bg-slate-50/40 hover:bg-white focus:bg-white focus:ring-2 focus:ring-violet-500/10 focus:border-violet-400 p-3.5"
          } ${prefix ? "pl-9 pr-3.5 py-2.5" : ""}`}
        />
      </div>
    </div>
  );
};
