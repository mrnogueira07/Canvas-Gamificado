export interface WebImageResult {
  id: string;
  title: string;
  url: string;
  thumbUrl: string;
  source: string;
  author: string;
  license: string;
}

/**
 * Busca imagens educativas e de domínio público / Creative Commons
 * via API da Wikimedia Commons com suporte completo a CORS e atribuição autêntica.
 */
export async function searchWikimediaImages(query: string, limit = 12): Promise<WebImageResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Remove pontuações e foca nos termos essenciais de busca
  const cleanQuery = trimmed
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|mime|extmetadata&format=json&origin=*`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data.query?.pages || {};

    interface WikimediaPage {
      pageid?: number;
      title?: string;
      imageinfo?: Array<{
        url?: string;
        mime?: string;
        extmetadata?: {
          Artist?: { value?: string };
          Credit?: { value?: string };
          LicenseShortName?: { value?: string };
        };
      }>;
    }

    const results: WebImageResult[] = [];
    for (const p of Object.values(pages) as WikimediaPage[]) {
      const info = p.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const mime = info?.mime || "";

      // Filtra apenas imagens reais suportadas na web
      if (!info?.url || (!mime.startsWith("image/jpeg") && !mime.startsWith("image/png") && !mime.startsWith("image/webp"))) {
        continue;
      }

      const artist = meta.Artist?.value?.replace(/<[^>]+>/g, "").trim().slice(0, 80);
      const credit = meta.Credit?.value?.replace(/<[^>]+>/g, "").trim().slice(0, 80);
      const author = artist || credit || "Acervo público";
      const title = (p.title || "").replace(/^File:/, "").replace(/\.[^.]+$/, "").trim();
      const license = meta.LicenseShortName?.value || "Creative Commons";

      results.push({
        id: String(p.pageid || Math.random()),
        title,
        url: info.url,
        thumbUrl: info.url,
        author,
        license,
        source: `Fonte: ${author} (Wikimedia Commons)`,
      });
    }

    return results;
  } catch (err) {
    console.warn("Erro ao buscar imagens na web:", err);
    return [];
  }
}
