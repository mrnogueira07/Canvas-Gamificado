/**
 * Utilitários compartilhados pelos componentes de jogo.
 *
 * Centraliza funções de sanitização de strings e de comparação de respostas
 * para evitar duplicação entre os diversos tipos de jogo.
 */

/**
 * Converte qualquer valor em uma string segura para renderização no React.
 *
 * Este utilitário é necessário porque a IA, em alguns casos, pode devolver
 * objetos ou arrays inesperados em campos que deveriam ser texto. Renderizar
 * um objeto diretamente quebraria a tela (erro #31 do React).
 */
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

const unpackJsonText = (parsed: unknown): string => {
  if (!parsed || typeof parsed !== 'object') return '';
  const obj = parsed as Record<string, unknown>;
  const keysToCheck = ['text', 'texto', 'option', 'opcao', 'value', 'valor', 'resposta'];
  for (const key of keysToCheck) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) {
      return String(obj[key]);
    }
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val;
    }
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
  }
  return '';
};

export const toStr = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return toStr(parsed);
      } catch {
        /* ignore */
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
          const unpacked = unpackJsonText(parsed);
          if (unpacked) return toStr(unpacked);
        } else if (typeof parsed === "string") {
          return toStr(parsed);
        }
      } catch {
        const extracted = extractTextFromJsonLikeString(trimmed);
        if (extracted) return toStr(extracted);
      }
    }
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toStr).join(", ");
  if (typeof v === "object") {
    const unpacked = unpackJsonText(v);
    if (unpacked) return toStr(unpacked);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
};

/** Apelido para compatibilidade com chamadas antigas. */
export const safeString = toStr;

/**
 * Verifica se uma alternativa corresponde à resposta correta da questão.
 *
 * A IA pode retornar a resposta como:
 *  - texto exato da alternativa
 *  - apenas a letra (A, B, C, D)
 *  - prefixada por "A)", "1.", "B -" etc.
 *
 * Esta função normaliza todos esses formatos antes de comparar.
 */
export const isCorrectAnswer = (
  opt: string,
  answer: string,
  index: number,
): boolean => {
  if (!opt || !answer) return false;
  const cleanOpt = opt.trim().toLowerCase();
  const cleanAns = answer.trim().toLowerCase();

  // Caso 1: texto idêntico
  if (cleanOpt === cleanAns) return true;

  // Caso 2: resposta é apenas a letra (a, b, c, d, e)
  const letters = ["a", "b", "c", "d", "e"];
  if (cleanAns === letters[index]) return true;

  // Caso 3: remove prefixos como "A) ", "1. ", "B -", "C: "
  const strip = (s: string) =>
    s
      .replace(/^[a-z0-9]\s*[).:/-]\s*/i, "")
      .trim()
      .toLowerCase();
  return strip(opt) === strip(answer);
};
