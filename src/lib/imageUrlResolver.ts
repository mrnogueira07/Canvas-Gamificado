/**
 * Resolvedor inteligente de URLs de imagens para o Game Canvas (especialmente
 * para canvas antigos onde educadores colaram links de páginas como Shutterstock,
 * Google Imagens, Google Drive, Wikipédia/Wikimedia, Unsplash, Imgur, Dropbox,
 * Freepik, Pinterest, Brasil Escola, Toda Matéria, etc., em vez do link direto
 * do arquivo de imagem).
 */

export type AspectRatio = "16:9" | "3:5" | "1:1";

export interface ParsedImageEntry {
  src: string;
  ratio: AspectRatio;
  description: string;
}

const VALID_RATIOS: AspectRatio[] = ["16:9", "3:5", "1:1"];

function normalizeRatio(r: unknown): AspectRatio {
  if (typeof r === "string" && VALID_RATIOS.includes(r as AspectRatio)) {
    return r as AspectRatio;
  }
  return "16:9";
}

/**
 * Interpreta qualquer formato salvo em `referenceImages` (tanto de canvas antigos
 * quanto novos):
 *  - JSON string `{ src, ratio, description }` (ou variantes legadas `{ url, imageUrl, link }`)
 *  - Objeto direto `{ src, ratio, description }`
 *  - String de URL pura ou `data:image/...`
 */
export function parseReferenceImageEntry(raw: unknown): ParsedImageEntry {
  if (!raw) {
    return { src: "", ratio: "16:9", description: "" };
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const srcCandidate =
      obj.src ?? obj.url ?? obj.imageUrl ?? obj.image ?? obj.link ?? "";
    const descCandidate =
      obj.description ?? obj.desc ?? obj.caption ?? obj.title ?? "";
    return {
      src: typeof srcCandidate === "string" ? srcCandidate.trim() : "",
      ratio: normalizeRatio(obj.ratio),
      description: typeof descCandidate === "string" ? descCandidate : "",
    };
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { src: "", ratio: "16:9", description: "" };
    }

    // Caso string JSON ou string entre aspas
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string") {
          return parseReferenceImageEntry(parsed);
        }
        if (parsed && typeof parsed === "object") {
          return parseReferenceImageEntry(parsed);
        }
      } catch {
        // Fallback por regex caso JSON antigo esteja levemente malformado
        const srcMatch = trimmed.match(
          /"(?:src|url|imageUrl|link)"\s*:\s*"([^"]*)"/i
        );
        const ratioMatch = trimmed.match(/"ratio"\s*:\s*"([^"]*)"/i);
        const descMatch = trimmed.match(
          /"(?:description|desc|caption)"\s*:\s*"([^"]*)"/i
        );
        if (srcMatch) {
          return {
            src: srcMatch[1].trim(),
            ratio: normalizeRatio(ratioMatch?.[1]),
            description: descMatch?.[1] || "",
          };
        }
      }
    }

    return { src: trimmed, ratio: "16:9", description: "" };
  }

  return { src: "", ratio: "16:9", description: "" };
}

/**
 * Extrai informações de um link do Shutterstock (página ou CDN bloqueado)
 * e retorna URLs diretas públicas do CDN do Shutterstock.
 */
function extractShutterstockUrls(urlStr: string): string[] {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (!host.includes("shutterstock.com")) return [];

    // Se já for uma URL pública válida -600nw- ou -260nw- no www.shutterstock.com
    if (
      host === "www.shutterstock.com" &&
      /-(?:600|260)nw-\d+\.(?:jpg|jpeg|png)$/i.test(u.pathname)
    ) {
      const idMatch = u.pathname.match(/-(\d+)\.(?:jpg|jpeg|png)$/i);
      const id = idMatch?.[1];
      return id
        ? [
            urlStr,
            `https://www.shutterstock.com/image-photo/stock-600nw-${id}.jpg`,
            `https://www.shutterstock.com/image-photo/stock-260nw-${id}.jpg`,
          ]
        : [urlStr];
    }

    // Padrão 1: https://www.shutterstock.com/pt/image-vector/hard-worker-pushes-big-box-service-1932040058?...
    const pageMatch = u.pathname.match(
      /\/(image-(?:vector|photo|illustration|generated))\/(?:([a-z0-9-]+?)-)?(\d{5,14})(?:\/|$)/i
    );
    if (pageMatch) {
      const kind = pageMatch[1].toLowerCase();
      const slug = pageMatch[2] || "stock";
      const id = pageMatch[3];
      return [
        `https://www.shutterstock.com/${kind}/${slug}-600nw-${id}.jpg`,
        `https://www.shutterstock.com/${kind}/${slug}-260nw-${id}.jpg`,
        `https://www.shutterstock.com/image-photo/stock-600nw-${id}.jpg`,
      ];
    }

    // Padrão 2: /shutterstock/photos/1932040058/... ou /z/stock-vector-...-1932040058.jpg ou qualquer URL com ID numérico
    const anyIdMatch =
      u.pathname.match(/\/photos\/(\d{5,14})(?:\/|$)/i) ||
      u.pathname.match(/-(\d{6,14})(?:\.[a-z]+)?(?:\/|$)/i) ||
      u.pathname.match(/\/(\d{6,14})(?:\/|$)/i);
    if (anyIdMatch) {
      const id = anyIdMatch[1];
      return [
        `https://www.shutterstock.com/image-photo/stock-600nw-${id}.jpg`,
        `https://www.shutterstock.com/image-vector/stock-600nw-${id}.jpg`,
        `https://www.shutterstock.com/image-photo/stock-260nw-${id}.jpg`,
      ];
    }
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Extrai ID de arquivos do Google Drive para gerar URL de miniatura em alta resolução.
 */
function extractGoogleDriveUrls(urlStr: string): string[] {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (
      !host.includes("drive.google.com") &&
      !host.includes("docs.google.com")
    ) {
      return [];
    }
    const fileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    const idParam = u.searchParams.get("id");
    const fileId = fileMatch?.[1] || idParam;
    if (fileId) {
      return [
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
        `https://lh3.googleusercontent.com/d/${fileId}=w1200`,
        `https://drive.google.com/uc?export=view&id=${fileId}`,
      ];
    }
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Converte de forma síncrona um link de página/compartilhamento conhecido
 * para a URL direta da imagem.
 */
export function resolveCanvasImageUrl(rawUrl: string, depth = 0): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let cleaned = rawUrl.trim();
  if (!cleaned) return "";

  // Caso a string inteira seja um JSON serializado de ImageEntry
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    const parsed = parseReferenceImageEntry(cleaned);
    if (parsed.src && parsed.src !== cleaned) {
      cleaned = parsed.src;
    }
  }

  // Remove aspas acidentais ao redor da URL
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Data URLs ou Blob URLs retornam imediatamente
  if (cleaned.startsWith("data:") || cleaned.startsWith("blob:")) {
    return cleaned;
  }

  // URLs relativas ao protocolo
  if (cleaned.startsWith("//")) {
    cleaned = `https:${cleaned}`;
  }

  if (depth > 3) return cleaned;

  try {
    const u = new URL(cleaned);
    const host = u.hostname.toLowerCase();

    // 1. Google Images / Google Redirects (google.com/imgres?imgurl=... ou google.com/url?url=...)
    if (host.includes("google.") && (u.pathname.includes("/imgres") || u.pathname.includes("/url"))) {
      const innerImg =
        u.searchParams.get("imgurl") ||
        u.searchParams.get("url") ||
        u.searchParams.get("q");
      if (innerImg && innerImg.startsWith("http")) {
        return resolveCanvasImageUrl(innerImg, depth + 1);
      }
    }

    // 2. Bing Images (bing.com/images/search?...&mediaurl=...)
    if (host.includes("bing.com")) {
      const mediaUrl = u.searchParams.get("mediaurl") || u.searchParams.get("imgurl");
      if (mediaUrl && mediaUrl.startsWith("http")) {
        return resolveCanvasImageUrl(mediaUrl, depth + 1);
      }
    }

    // 3. Shutterstock (páginas /pt/image-vector/..., /image-photo/..., etc.)
    const shutterstock = extractShutterstockUrls(cleaned);
    if (shutterstock.length > 0) {
      return shutterstock[0];
    }

    // 4. Google Drive
    const gdrive = extractGoogleDriveUrls(cleaned);
    if (gdrive.length > 0) {
      return gdrive[0];
    }

    // 5. Wikipédia / Wikimedia Commons (#/media/Ficheiro:... ou /wiki/File:...)
    const hashMediaMatch = u.hash.match(
      /#\/media\/(?:File|Ficheiro|Arquivo|Imagen|Image):([^/?#]+)/i
    );
    const wikiFileMatch = u.pathname.match(
      /\/wiki\/(?:File|Ficheiro|Arquivo|Imagen|Image):([^/?#]+)/i
    );
    const wikiFileName = hashMediaMatch?.[1] || wikiFileMatch?.[1];
    if (wikiFileName && (host.includes("wikipedia.org") || host.includes("wikimedia.org"))) {
      const decoded = decodeURIComponent(wikiFileName);
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decoded)}?width=1000`;
    }

    // 6. Unsplash ( páginas /photos/slug-ID ou /pt-br/fotografias/slug-ID )
    if (host.includes("unsplash.com") && !host.includes("images.unsplash.com")) {
      const unsplashMatch = u.pathname.match(
        /\/(?:photos|fotografias)\/(?:[^/?#]+-)?([a-zA-Z0-9_-]{8,15})(?:\/|$)/
      );
      if (unsplashMatch) {
        return `https://unsplash.com/photos/${unsplashMatch[1]}/download?force=true&w=1080`;
      }
    }

    // 7. Pexels ( páginas /pt-br/foto/slug-123456/ ou /photo/slug-123456/ )
    if (host.includes("pexels.com") && !host.includes("images.pexels.com")) {
      const pexelsMatch = u.pathname.match(
        /\/(?:photo|foto)\/(?:[^/?#]+-)?(\d{4,12})(?:\/|$)/i
      );
      if (pexelsMatch) {
        const pid = pexelsMatch[1];
        return `https://images.pexels.com/photos/${pid}/pexels-photo-${pid}.jpeg?auto=compress&cs=tinysrgb&w=900`;
      }
    }

    // 8. YouTube (caso o educador tenha colado link de vídeo como referência visual)
    if (host.includes("youtube.com") || host === "youtu.be") {
      const ytId =
        host === "youtu.be"
          ? u.pathname.replace(/^\//, "").split("/")[0]
          : u.searchParams.get("v");
      if (ytId && /^[a-zA-Z0-9_-]{8,15}$/.test(ytId)) {
        return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      }
    }

    // 9. Imgur página única (https://imgur.com/abc1234)
    if ((host === "imgur.com" || host === "www.imgur.com" || host === "m.imgur.com") && !u.pathname.startsWith("/a/") && !u.pathname.startsWith("/gallery/")) {
      const imgurMatch = u.pathname.match(/^\/([a-zA-Z0-9]{5,12})$/);
      if (imgurMatch) {
        return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
      }
    }

    // 10. Dropbox (substitui ?dl=0 por ?raw=1)
    if (host.includes("dropbox.com")) {
      u.searchParams.delete("dl");
      u.searchParams.set("raw", "1");
      return u.toString();
    }
  } catch {
    /* URL malformada ou relativa */
  }

  return cleaned;
}

/**
 * Gera lista ordenada de URLs candidatas para exibição resiliente em `<img>`,
 * incluindo variantes diretas e proxies de imagem (wsrv.nl e /api/proxy-image)
 * para contornar bloqueios de hotlink (403 Referer) e conteúdo misto (http://).
 */
export function getCanvasImageCandidates(rawUrl: string): string[] {
  if (!rawUrl || typeof rawUrl !== "string") return [];
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return [trimmed];
  }

  const candidates: string[] = [];
  const addCandidate = (url: string) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  const primary = resolveCanvasImageUrl(trimmed);
  addCandidate(primary);

  // Variantes específicas do Shutterstock
  for (const sUrl of extractShutterstockUrls(trimmed)) {
    addCandidate(sUrl);
  }

  // Variantes específicas do Google Drive
  for (const gUrl of extractGoogleDriveUrls(trimmed)) {
    addCandidate(gUrl);
  }

  // Se for http/https, adiciona proxy wsrv.nl (converte http->https, remove Referer e converte formatos)
  if (primary.startsWith("http://") || primary.startsWith("https://")) {
    addCandidate(
      `https://wsrv.nl/?url=${encodeURIComponent(primary)}&w=900&output=jpg`
    );
    if (primary !== trimmed && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
      addCandidate(
        `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=900&output=jpg`
      );
    }
    addCandidate(`/api/proxy-image?url=${encodeURIComponent(primary)}`);
  }

  return candidates;
}

// Cache em memória para resoluções assíncronas de páginas web (og:image)
const asyncResolutionCache = new Map<string, string | null>();

/**
 * Extrai URL de imagem principal (`og:image` ou `twitter:image`) de um HTML.
 */
function extractMetaImageFromHtml(html: string, baseUrl: string): string | null {
  if (!html) return null;

  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];

  for (const regex of patterns) {
    const m = html.match(regex);
    if (m && m[1]) {
      const raw = m[1].replace(/&amp;/g, "&").trim();
      try {
        return new URL(raw, baseUrl).toString();
      } catch {
        if (raw.startsWith("http")) return raw;
      }
    }
  }
  return null;
}

/**
 * Quando o usuário colou o link de uma página web genérica (ex: Freepik, Pinterest,
 * Toda Matéria, Brasil Escola, Pexels, Pixabay, etc.) cujos candidatos diretos
 * falharam no `<img>`, busca assincronamente a imagem principal (`og:image`) da página.
 */
export async function resolveWebpageImageAsync(rawUrl: string): Promise<string | null> {
  if (!rawUrl || !rawUrl.startsWith("http")) return null;
  const key = rawUrl.trim();
  if (asyncResolutionCache.has(key)) {
    return asyncResolutionCache.get(key) ?? null;
  }

  // 0. Se for artigo da Wikipédia (ex: https://pt.wikipedia.org/wiki/For%C3%A7a), usa a API REST oficial da Wikipédia
  try {
    const u = new URL(key);
    if (u.hostname.toLowerCase().endsWith("wikipedia.org") && u.pathname.startsWith("/wiki/")) {
      const articleTitle = u.pathname.slice("/wiki/".length).split("/")[0];
      if (articleTitle && !articleTitle.includes(":")) {
        const wikiApiUrl = `${u.origin}/api/rest_v1/page/summary/${articleTitle}`;
        const res = await fetch(wikiApiUrl);
        if (res.ok) {
          const data = (await res.json()) as {
            originalimage?: { source?: string };
            thumbnail?: { source?: string };
          };
          const wikiImg = data?.originalimage?.source || data?.thumbnail?.source;
          if (wikiImg && wikiImg.startsWith("http")) {
            asyncResolutionCache.set(key, wikiImg);
            return wikiImg;
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 1. Tenta via AllOrigins (extrai meta og:image / twitter:image diretamente do HTML)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(key)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { contents?: string };
      if (data?.contents) {
        const metaImg = extractMetaImageFromHtml(data.contents, key);
        if (metaImg) {
          const resolved = resolveCanvasImageUrl(metaImg);
          asyncResolutionCache.set(key, resolved);
          return resolved;
        }
      }
    }
  } catch {
    /* prossegue para o próximo resolvedor */
  }

  // 2. Tenta via Microlink API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(key)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { image?: { url?: string }; logo?: { url?: string } };
      };
      const imgUrl = json?.data?.image?.url || json?.data?.logo?.url;
      if (imgUrl && imgUrl.startsWith("http")) {
        const resolved = resolveCanvasImageUrl(imgUrl);
        asyncResolutionCache.set(key, resolved);
        return resolved;
      }
    }
  } catch {
    /* ignore */
  }

  asyncResolutionCache.set(key, null);
  return null;
}
