/**
 * MindCanvas Route Cryptography & Clean URL Manager
 * Criptografa todos os IDs e parâmetros de rotas para garantir URLs
 * limpas, modernas e sem nenhum ID de banco de dados visível ao usuário.
 */

export interface EncryptedRouteData {
  id?: string;
  stage?: "recent" | "prepare" | "progress" | "result" | "edit";
  from?: string;
  linha?: string;
  retry?: string;
  isLegacy?: boolean;
}

interface CompactRouteData {
  i?: string; // id
  s?: "recent" | "prepare" | "progress" | "result" | "edit"; // stage
  f?: string; // from
  l?: string; // linha
  r?: string; // retry
}

const ROUTE_SECRET = "MindCanvas_Secure_Route_2025_#v1";

/**
 * Hash FNV-1a de 32 bits para derivação determinística e checksum
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Gerador de fluxo pseudo-aleatório seguro (Xorshift32 + rotação de chave)
 */
function createKeyStream(key: string, salt: number, length: number): Uint8Array {
  const stream = new Uint8Array(length);
  let state = (fnv1a(key) ^ salt) >>> 0;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const keyByte = key.charCodeAt(i % key.length);
    stream[i] = ((state ^ (keyByte * (i + 1))) & 0xff);
  }
  return stream;
}

/**
 * Codificador Base64 URL-safe (sem caracteres especiais +, /, =)
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodificador Base64 URL-safe
 */
function fromBase64Url(str: string): Uint8Array | null {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binary = typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Criptografa parâmetros de rota em um token seguro e opaco
 */
export function encryptRoute(data: EncryptedRouteData): string {
  const compact: CompactRouteData = {};
  if (data.id) compact.i = data.id;
  if (data.stage) compact.s = data.stage;
  if (data.from) compact.f = data.from;
  if (data.linha) compact.l = data.linha;
  if (data.retry) compact.r = data.retry;

  const json = JSON.stringify(compact);
  const textBytes = new TextEncoder().encode(json);
  const salt = (Math.floor(Math.random() * 65535) + 1);
  const checksum = (fnv1a(json) & 0xffff);
  const stream = createKeyStream(ROUTE_SECRET, salt, textBytes.length);

  const packet = new Uint8Array(4 + textBytes.length);
  packet[0] = (salt >> 8) & 0xff;
  packet[1] = salt & 0xff;
  packet[2] = (checksum >> 8) & 0xff;
  packet[3] = checksum & 0xff;

  for (let i = 0; i < textBytes.length; i++) {
    packet[4 + i] = textBytes[i] ^ stream[i];
  }

  return toBase64Url(packet);
}

/**
 * Descriptografa um token de rota para recuperar os parâmetros originais
 */
export function decryptRoute(token: string): EncryptedRouteData | null {
  if (!token || typeof token !== "string") return null;

  const packet = fromBase64Url(token.trim());
  if (!packet || packet.length < 5) return null;

  const salt = (packet[0] << 8) | packet[1];
  const checksum = (packet[2] << 8) | packet[3];
  const cipherBytes = packet.subarray(4);

  const stream = createKeyStream(ROUTE_SECRET, salt, cipherBytes.length);
  const textBytes = new Uint8Array(cipherBytes.length);

  for (let i = 0; i < cipherBytes.length; i++) {
    textBytes[i] = cipherBytes[i] ^ stream[i];
  }

  try {
    const json = new TextDecoder().decode(textBytes);
    if ((fnv1a(json) & 0xffff) !== checksum) {
      return null;
    }
    const parsed = JSON.parse(json) as CompactRouteData;
    return {
      id: parsed.i,
      stage: parsed.s,
      from: parsed.f,
      linha: parsed.l,
      retry: parsed.r,
    };
  } catch {
    return null;
  }
}

/**
 * Constrói uma URL limpa com parâmetros criptografados
 */
export function buildEncryptedUrl(basePath: string, data: EncryptedRouteData): string {
  // Se não há dados relevantes para criptografar, retorna o caminho limpo
  if (!data.id && !data.stage && !data.from && !data.linha && !data.retry) {
    return basePath;
  }
  const token = encryptRoute(data);
  return `${basePath}?p=${token}`;
}

/**
 * Resolve parâmetros de rota com suporte a token criptografado (?p=...)
 * e compatibilidade regressiva com URLs legadas (?id=...), sinalizando
 * para substituição imediata na URL.
 */
export function resolveRouteParams(searchParams: URLSearchParams): EncryptedRouteData {
  const token = searchParams.get("p");
  if (token) {
    const decrypted = decryptRoute(token);
    if (decrypted) {
      return decrypted;
    }
  }

  // Compatibilidade com parâmetros legados na URL
  const legacyId = searchParams.get("id");
  const legacyStage = searchParams.get("stage") as EncryptedRouteData["stage"] | null;
  const legacyFrom = searchParams.get("from");
  const legacyLinha = searchParams.get("linha");
  const legacyRetry = searchParams.get("retry");

  if (legacyId || legacyStage || legacyFrom || legacyLinha || legacyRetry) {
    return {
      id: legacyId || undefined,
      stage: legacyStage || undefined,
      from: legacyFrom || undefined,
      linha: legacyLinha || undefined,
      retry: legacyRetry || undefined,
      isLegacy: true,
    };
  }

  return {};
}

