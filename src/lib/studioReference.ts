import mammoth from "mammoth";
import JSZip from "jszip";
import pako from "pako";
import { getDocument, GlobalWorkerOptions, ImageKind, OPS } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { model } from "./gemini";
import type { ExtractedReferenceImage } from "./studioProjects";

export interface StudioReferenceDoc {
  text: string;
  images: ExtractedReferenceImage[];
}

type PdfPageImage = { width: number; height: number; kind?: number; data?: Uint8Array; bitmap?: ImageBitmap };

function pdfImageDataUrl(image: PdfPageImage): string | undefined {
  if (typeof document === "undefined" || image.width < 32 || image.height < 32 || image.width * image.height < 1600 || image.width * image.height > 16_000_000) return;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (image.bitmap) ctx.drawImage(image.bitmap, 0, 0);
  else if (image.data) {
    const pixels = ctx.createImageData(image.width, image.height);
    const source = image.data;
    for (let pixel = 0; pixel < image.width * image.height; pixel++) {
      const dest = pixel * 4;
      if (image.kind === ImageKind.RGBA_32BPP) {
        pixels.data[dest] = source[dest];
        pixels.data[dest + 1] = source[dest + 1];
        pixels.data[dest + 2] = source[dest + 2];
        pixels.data[dest + 3] = source[dest + 3];
      } else if (image.kind === ImageKind.RGB_24BPP) {
        pixels.data[dest] = source[pixel * 3];
        pixels.data[dest + 1] = source[pixel * 3 + 1];
        pixels.data[dest + 2] = source[pixel * 3 + 2];
        pixels.data[dest + 3] = 255;
      } else if (image.kind === ImageKind.GRAYSCALE_1BPP) {
        const rowByte = Math.ceil(image.width / 8);
        const byte = source[Math.floor(pixel / image.width) * rowByte + Math.floor((pixel % image.width) / 8)];
        const gray = byte & (128 >> (pixel % 8)) ? 255 : 0;
        pixels.data[dest] = pixels.data[dest + 1] = pixels.data[dest + 2] = gray;
        pixels.data[dest + 3] = 255;
      } else return;
    }
    ctx.putImageData(pixels, 0, 0);
  } else return;
  return canvas.toDataURL("image/png");
}

/** Use the PDF page graph so an image keeps the page and nearby printed text. */
export async function extractPageImagesFromPdf(buffer: ArrayBuffer): Promise<ExtractedReferenceImage[]> {
  if (typeof document === "undefined" || typeof getDocument !== "function") return [];
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = getDocument({ data: new Uint8Array(buffer.slice(0)), useSystemFonts: true });
  const images: ExtractedReferenceImage[] = [];
  const multiply = (left: number[], right: number[]) => [
    left[0] * right[0] + left[2] * right[1], left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3], left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4], left[1] * right[4] + left[3] * right[5] + left[5],
  ];
  try {
    const pdf = await task.promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const [textContent, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      const fragments = textContent.items.flatMap(item => "str" in item && item.str.trim() ? [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }] : []);
      const lines: { text: string; y: number }[] = [];
      for (const fragment of fragments) {
        const line = lines.find(candidate => Math.abs(candidate.y - fragment.y) < 3);
        if (line) line.text += ` ${fragment.text}`;
        else lines.push({ text: fragment.text, y: fragment.y });
      }
      const pageText = lines.map(line => line.text).join(" ").replace(/\s+/g, " ").slice(0, 1800);
      const stack: number[][] = [];
      let transform = [1, 0, 0, 1, 0, 0];
      let imageNumber = 0;
      for (let i = 0; i < operators.fnArray.length; i++) {
        const operation = operators.fnArray[i];
        const args = operators.argsArray[i];
        if (operation === OPS.save) { stack.push(transform); continue; }
        if (operation === OPS.restore) { transform = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
        if (operation === OPS.transform) { transform = multiply(transform, args as number[]); continue; }
        if (operation !== OPS.paintImageXObject && operation !== OPS.paintInlineImageXObject) continue;
        let value: unknown;
        if (operation === OPS.paintImageXObject) {
          const objName = typeof args[0] === "string" ? args[0] : "";
          if (objName) {
            const commonObjs = (page as unknown as { commonObjs?: typeof page.objs }).commonObjs;
            const store = objName.startsWith("g_") && commonObjs ? commonObjs : page.objs;
            if (store.has(objName)) {
              value = store.get(objName);
            } else {
              value = await new Promise<unknown>((resolve) => {
                const timer = setTimeout(() => resolve(undefined), 2500);
                try {
                  store.get(objName, (resolved: unknown) => {
                    clearTimeout(timer);
                    resolve(resolved);
                  });
                } catch {
                  clearTimeout(timer);
                  resolve(undefined);
                }
              });
            }
          }
        } else {
          value = args[0];
        }
        if (!value || typeof value !== "object") continue;
        const url = pdfImageDataUrl(value as PdfPageImage);
        if (!url) continue;
        const y = Math.min(transform[5], transform[1] + transform[5], transform[3] + transform[5], transform[1] + transform[3] + transform[5]);
        const below = lines.filter(line => line.y <= y + 12 && line.y >= y - 130).sort((a, b) => b.y - a.y);
        const near = lines.filter(line => Math.abs(line.y - y) < 220).sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y));
        const caption = below.find(line => /^(figura|imagem|foto|ilustra[cç][aã]o|gr[aá]fico|quadro|qr\s*code)\b/i.test(line.text))?.text;
        const source = below.find(line => /^fonte\s*:\s*\S/i.test(line.text))?.text;
        const context = [caption, ...near.slice(0, 12).map(line => line.text)].filter(Boolean).join(" ").slice(0, 900) || pageText;
        imageNumber++;
        images.push({
          id: `pdf-p${pageNumber}-img-${imageNumber}`,
          name: caption || `Imagem ${imageNumber} · página ${pageNumber} do PDF`,
          url,
          sizeBytes: Math.round(url.length * .75),
          page: String(pageNumber),
          caption,
          source,
          context,
        });
      }
      page.cleanup();
    }
    return images;
  } finally {
    await task.destroy();
  }
}

// Read the Word 97–2003 compound document and its text piece table.
function readLegacyWord(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0xe011cfd0) throw new Error("Documento DOC inválido. Salve novamente no Word e tente importar.");
  const sectorSize = 1 << view.getUint16(30, true);
  const miniSize = 1 << view.getUint16(32, true);
  const sector = (id: number) => bytes.slice((id + 1) * sectorSize, (id + 2) * sectorSize);
  const words = (data: Uint8Array) => Array.from({ length: data.length / 4 }, (_, i) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(i * 4, true));
  const fatIds = words(bytes.slice(76, 512)).filter(id => id < 0xfffffffa);
  let difat = view.getUint32(68, true);
  for (let i = 0; i < view.getUint32(72, true) && difat < 0xfffffffa; i++) {
    const entries = words(sector(difat)); difat = entries.pop()!;
    fatIds.push(...entries.filter(id => id < 0xfffffffa));
  }
  const fat = fatIds.flatMap(id => words(sector(id)));
  function chain(start: number, table: number[], read: (id: number) => Uint8Array): Uint8Array {
    const chunks: Uint8Array[] = []; const seen = new Set<number>();
    for (let id = start; id < 0xfffffffa; id = table[id]) {
      if (seen.has(id) || id >= table.length) throw new Error("Documento Word danificado.");
      seen.add(id); chunks.push(read(id));
    }
    const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }
  const directory = chain(view.getUint32(48, true), fat, sector);
  const entries: { name: string; start: number; size: number; type: number }[] = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const entry = new DataView(directory.buffer, offset, 128);
    const length = entry.getUint16(64, true);
    if (length < 2) continue;
    entries.push({ name: new TextDecoder("utf-16le").decode(directory.slice(offset, offset + length - 2)), start: entry.getUint32(116, true), size: entry.getUint32(120, true), type: entry.getUint8(66) });
  }
  const root = entries.find(entry => entry.type === 5);
  if (!root) throw new Error("Documento Word inválido.");
  const miniStream = chain(root.start, fat, sector);
  const miniFat = words(chain(view.getUint32(60, true), fat, sector));
  const stream = (name: string) => {
    const entry = entries.find(item => item.name === name);
    if (!entry) throw new Error("Documento Word sem conteúdo legível.");
    return (entry.size < view.getUint32(56, true) ? chain(entry.start, miniFat, id => miniStream.slice(id * miniSize, (id + 1) * miniSize)) : chain(entry.start, fat, sector)).slice(0, entry.size);
  };
  const doc = stream("WordDocument"); const fib = new DataView(doc.buffer);
  if (fib.getUint16(10, true) & 0x0100) throw new Error("Remova a senha do documento antes de importar.");
  const table = stream(fib.getUint16(10, true) & 0x0200 ? "1Table" : "0Table");
  let offset = fib.getUint32(0x1a2, true);
  const end = offset + fib.getUint32(0x1a6, true);
  const tableView = new DataView(table.buffer);
  while (offset < end && table[offset] === 1) offset += 3 + tableView.getUint16(offset + 1, true);
  if (table[offset] !== 2) throw new Error("Não foi possível ler este DOC. Salve como DOCX e importe novamente.");
  const length = tableView.getUint32(offset + 1, true); offset += 5;
  const count = (length - 4) / 12;
  let text = "";
  for (let i = 0; i < count; i++) {
    const size = tableView.getUint32(offset + (i + 1) * 4, true) - tableView.getUint32(offset + i * 4, true);
    const position = tableView.getUint32(offset + (count + 1) * 4 + i * 8 + 2, true);
    const compressed = Boolean(position & 0x40000000);
    const start = (position & 0x3fffffff) / (compressed ? 2 : 1);
    text += new TextDecoder(compressed ? "windows-1252" : "utf-16le").decode(doc.slice(start, start + size * (compressed ? 1 : 2)));
  }
  // Word stores paragraph and field delimiters as control characters.
  // eslint-disable-next-line no-control-regex
  return text.replace(/\r/g, "\n").replace(/[\x00-\x08\x0b-\x1f]/g, "");
}

/**
 * Extrai as imagens originais de um arquivo PDF (JPEG, FlateDecode, streams embutidas).
 */
export function extractImagesFromPdf(buffer: ArrayBuffer): ExtractedReferenceImage[] {
  const images: ExtractedReferenceImage[] = [];
  const u8 = new Uint8Array(buffer);
  const latin1 = Array.from(u8, b => String.fromCharCode(b)).join("");
  const objRegex = /<<([\s\S]*?\/Subtype\s*\/Image[\s\S]*?)>>[\r\n\s]*stream[\r\n]{1,2}([\s\S]*?)[\r\n]{1,2}endstream/g;
  let match: RegExpExecArray | null;
  let imgIndex = 1;
  const seenHashes = new Set<string>();

  while ((match = objRegex.exec(latin1)) !== null) {
    const dict = match[1];
    const rawStream = match[2];
    if (!rawStream || rawStream.length < 500) continue;

    const streamBytes = Uint8Array.from(rawStream, c => c.charCodeAt(0));

    // 1. DCTDecode (JPEG original direto do PDF)
    if (/\/Filter\s*(\/DCTDecode|\[\s*\/DCTDecode\s*\])/i.test(dict) || (streamBytes[0] === 0xff && streamBytes[1] === 0xd8)) {
      let start = 0;
      while (start < streamBytes.length - 1 && !(streamBytes[start] === 0xff && streamBytes[start + 1] === 0xd8)) {
        start++;
      }
      let end = streamBytes.length;
      while (end > start + 1 && !(streamBytes[end - 2] === 0xff && streamBytes[end - 1] === 0xd9)) {
        end--;
      }
      const jpegData = streamBytes.subarray(start, end > start + 100 ? end : streamBytes.length);
      if (jpegData.length < 1500) continue;

      const hash = `${jpegData.length}-${jpegData[10] || 0}-${jpegData[50] || 0}`;
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);

      let b64 = "";
      for (let i = 0; i < jpegData.length; i += 8192) {
        b64 += String.fromCharCode(...jpegData.subarray(i, i + 8192));
      }

      images.push({
        id: `pdf-img-${imgIndex++}`,
        name: `Imagem ${imgIndex - 1} (PDF)`,
        url: `data:image/jpeg;base64,${btoa(b64)}`,
        sizeBytes: jpegData.length,
      });
      continue;
    }

    // 2. FlateDecode (PNG / Bitmap sem perda)
    if (/\/Filter\s*(\/FlateDecode|\[\s*\/FlateDecode\s*\])/i.test(dict)) {
      try {
        const widthMatch = dict.match(/\/Width\s+(\d+)/);
        const heightMatch = dict.match(/\/Height\s+(\d+)/);
        const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
        const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;

        if (width >= 60 && height >= 60 && width * height <= 4000 * 4000) {
          const decompressed = pako.inflate(streamBytes);
          const isRGB = !/\/DeviceGray/i.test(dict) && decompressed.length >= width * height * 3;
          const isGray = /\/DeviceGray/i.test(dict) && decompressed.length >= width * height;

          if (typeof document !== "undefined" && (isRGB || isGray)) {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const imgData = ctx.createImageData(width, height);
              let srcPtr = 0;
              for (let i = 0; i < width * height; i++) {
                if (isRGB) {
                  imgData.data[i * 4] = decompressed[srcPtr++];
                  imgData.data[i * 4 + 1] = decompressed[srcPtr++];
                  imgData.data[i * 4 + 2] = decompressed[srcPtr++];
                  imgData.data[i * 4 + 3] = 255;
                } else {
                  const g = decompressed[srcPtr++];
                  imgData.data[i * 4] = g;
                  imgData.data[i * 4 + 1] = g;
                  imgData.data[i * 4 + 2] = g;
                  imgData.data[i * 4 + 3] = 255;
                }
              }
              ctx.putImageData(imgData, 0, 0);
              images.push({
                id: `pdf-img-${imgIndex++}`,
                name: `Imagem ${imgIndex - 1} (PDF)`,
                url: canvas.toDataURL("image/png"),
                sizeBytes: streamBytes.length,
              });
            }
          }
        }
      } catch {
        // Ignora streams não suportadas
      }
    }
  }

  // 3. Fallback: Varredura de assinaturas JPEG no PDF bruto
  if (images.length === 0) {
    let pos = 0;
    while (pos < u8.length - 4) {
      if (u8[pos] === 0xff && u8[pos + 1] === 0xd8 && u8[pos + 2] === 0xff) {
        let end = pos + 3;
        while (end < u8.length - 1) {
          if (u8[end] === 0xff && u8[end + 1] === 0xd9) {
            end += 2;
            break;
          }
          end++;
        }
        if (end > pos + 100 && end <= u8.length) {
          const jpegData = u8.subarray(pos, end);
          if (jpegData.length >= 2000) {
            const hash = `${jpegData.length}-${jpegData[10] || 0}`;
            if (!seenHashes.has(hash)) {
              seenHashes.add(hash);
              let b64 = "";
              for (let k = 0; k < jpegData.length; k += 8192) {
                b64 += String.fromCharCode(...jpegData.subarray(k, k + 8192));
              }
              images.push({
                id: `pdf-img-${imgIndex++}`,
                name: `Imagem ${imgIndex - 1} (PDF)`,
                url: `data:image/jpeg;base64,${btoa(b64)}`,
                sizeBytes: jpegData.length,
              });
            }
          }
          pos = end;
          continue;
        }
      }
      pos++;
    }
  }

  return images;
}

/**
 * Extrai as imagens originais de um documento Word (.docx) preservando a ordem do documento,
 * legendas, fontes ("Fonte: ...") e o texto dos parágrafos ao redor de cada imagem.
 */
export async function extractImagesFromDocx(buffer: ArrayBuffer): Promise<ExtractedReferenceImage[]> {
  const images: ExtractedReferenceImage[] = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const decodeXml = (raw: string) =>
      raw
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, " ")
        .trim();

    // 1. Mapeia relacionamentos rId -> word/media/*
    const relMap = new Map<string, string>();
    const relsFile = zip.file("word/_rels/document.xml.rels");
    if (relsFile) {
      const relsXml = await relsFile.async("string");
      for (const relMatch of relsXml.matchAll(/<Relationship\b[^>]*>/gi)) {
        const tag = relMatch[0];
        const id = tag.match(/\bId="([^"]+)"/i)?.[1];
        const target = tag.match(/\bTarget="([^"]+)"/i)?.[1];
        if (id && target) {
          const cleanTarget = target.replace(/^\/+/, "").replace(/^word\//i, "");
          if (/^media\/.+\.(png|jpe?g|webp|gif|bmp|jfif)$/i.test(cleanTarget)) {
            relMap.set(id, `word/${cleanTarget}`);
          }
        }
      }
    }

    // 2. Lê parágrafos de word/document.xml para ordenar imagens e extrair contexto, legenda e fonte
    const mediaMeta = new Map<string, { caption?: string; source?: string; context?: string }>();
    const orderedPaths: string[] = [];
    const docFile = zip.file("word/document.xml");
    if (docFile && relMap.size > 0) {
      const docXml = await docFile.async("string");
      const rawParagraphs = docXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
      const paragraphs = rawParagraphs.map(pXml => {
        const textParts = Array.from(pXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g), m => m[1]);
        const text = decodeXml(textParts.join(""));
        const rIds: string[] = [];
        for (const rMatch of pXml.matchAll(/\b(?:r:embed|r:id|o:relid)="([^"]+)"/gi)) {
          if (relMap.has(rMatch[1])) rIds.push(rMatch[1]);
        }
        const docPrDescr = pXml.match(/<wp:docPr\b[^>]*\b(?:descr|title)="([^"]+)"/i)?.[1];
        return { text, rIds, altText: docPrDescr ? decodeXml(docPrDescr) : undefined };
      });

      paragraphs.forEach((para, idx) => {
        if (!para.rIds.length) return;
        const nearbyWindow = paragraphs.slice(Math.max(0, idx - 2), Math.min(paragraphs.length, idx + 4));
        const afterWindow = paragraphs.slice(idx, Math.min(paragraphs.length, idx + 4));
        const nearbyTexts = nearbyWindow.map(p => p.text).filter(Boolean);
        const afterTexts = afterWindow.map(p => p.text).filter(Boolean);

        const sourceLine = afterTexts.find(t => /(?:^|\b)(?:fonte|cr[eé]dito|acervo|dispon[ií]vel em)\s*:\s*\S/i.test(t))
          || nearbyTexts.find(t => /(?:^|\b)(?:fonte|cr[eé]dito|acervo|dispon[ií]vel em)\s*:\s*\S/i.test(t));
        let source: string | undefined;
        if (sourceLine) {
          const extractedSource = sourceLine.match(/(?:fonte|cr[eé]dito|acervo|dispon[ií]vel em)\s*:\s*(.+)$/i)?.[1]?.trim();
          if (extractedSource) source = `Fonte: ${extractedSource}`;
        }

        const captionLine =
          afterTexts.find(t => /^(?:figura|imagem|foto|ilustra[cç][aã]o|mapa|quadro|gr[aá]fico|gravura|pintura)\b/i.test(t)) ||
          (para.altText && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(para.altText) ? para.altText : undefined) ||
          afterTexts.find(t => t.length >= 10 && t.length <= 130 && !/^(?:fonte|cr[eé]dito)\s*:/i.test(t));

        const context = paragraphs
          .slice(Math.max(0, idx - 3), Math.min(paragraphs.length, idx + 4))
          .map(p => p.text)
          .filter(Boolean)
          .join(" ")
          .slice(0, 900);

        for (const rId of para.rIds) {
          const mediaPath = relMap.get(rId);
          if (!mediaPath) continue;
          if (!orderedPaths.includes(mediaPath)) orderedPaths.push(mediaPath);
          if (!mediaMeta.has(mediaPath)) {
            mediaMeta.set(mediaPath, { caption: captionLine, source, context });
          }
        }
      });
    }

    const allMediaFiles = Object.keys(zip.files)
      .filter(path => /^word\/media\/.+\.(png|jpe?g|webp|gif|bmp|jfif)$/i.test(path))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const path of allMediaFiles) {
      if (!orderedPaths.includes(path)) orderedPaths.push(path);
    }

    let index = 1;
    for (const path of orderedPaths) {
      const file = zip.file(path);
      if (!file) continue;
      const arrayBuffer = await file.async("arraybuffer");
      if (arrayBuffer.byteLength < 1000) continue;
      const ext = path.split(".").pop()?.toLowerCase() || "png";
      const mime = ext === "jpg" || ext === "jpeg" || ext === "jfif" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/png";
      const u8 = new Uint8Array(arrayBuffer);
      let b64 = "";
      for (let i = 0; i < u8.length; i += 8192) {
        b64 += String.fromCharCode(...u8.subarray(i, i + 8192));
      }
      const meta = mediaMeta.get(path);
      const num = index++;
      images.push({
        id: `docx-img-${num}`,
        name: meta?.caption ? meta.caption.slice(0, 90) : `Imagem ${num} (${path.split("/").pop() || "Word"})`,
        url: `data:${mime};base64,${btoa(b64)}`,
        sizeBytes: arrayBuffer.byteLength,
        caption: meta?.caption,
        source: meta?.source,
        context: meta?.context,
      });
    }
  } catch (err) {
    console.warn("Erro ao extrair imagens do DOCX:", err);
  }
  return images;
}

const trimmedImageCache = new Map<string, string>();

function detectContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const isMarginPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (a < 25) return true;
    return r >= 226 && g >= 226 && b >= 226 && Math.max(r, g, b) - Math.min(r, g, b) <= 20;
  };

  const isRowMargin = (y: number) => {
    const step = Math.max(1, Math.floor(width / 80));
    let total = 0;
    let marginCount = 0;
    for (let x = 0; x < width; x += step) {
      total++;
      if (isMarginPixel(x, y)) marginCount++;
    }
    return marginCount / total >= 0.9;
  };

  const isColMargin = (x: number, topY: number, bottomY: number) => {
    const span = Math.max(1, bottomY - topY + 1);
    const step = Math.max(1, Math.floor(span / 80));
    let total = 0;
    let marginCount = 0;
    for (let y = topY; y <= bottomY; y += step) {
      total++;
      if (isMarginPixel(x, y)) marginCount++;
    }
    return marginCount / total >= 0.9;
  };

  const maxCropY = Math.floor(height * 0.22);
  const maxCropX = Math.floor(width * 0.22);

  let top = 0;
  while (top < maxCropY && isRowMargin(top)) top++;

  let bottom = height - 1;
  while (bottom > height - 1 - maxCropY && isRowMargin(bottom)) bottom--;

  let left = 0;
  while (left < maxCropX && isColMargin(left, top, bottom)) left++;

  let right = width - 1;
  while (right > width - 1 - maxCropX && isColMargin(right, top, bottom)) right--;

  // Inset 2px nas bordas detectadas para remover linhas anti-aliasing esbranquiçadas
  if (top > 0) top = Math.min(maxCropY, top + 2);
  if (bottom < height - 1) bottom = Math.max(height - 1 - maxCropY, bottom - 2);
  if (left > 0) left = Math.min(maxCropX, left + 2);
  if (right < width - 1) right = Math.max(width - 1 - maxCropX, right - 2);

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  const trimmed =
    cropW >= width * 0.55 &&
    cropH >= height * 0.55 &&
    (top > 0 || bottom < height - 1 || left > 0 || right < width - 1);

  return { left, top, cropW, cropH, trimmed };
}

/**
 * Remove bordas brancas/cinzas embutidas nas imagens extraídas de apostilas (DOCX/PDF).
 */
export async function trimImageWhiteBorders(dataUrl: string): Promise<string> {
  if (typeof document === "undefined" || !dataUrl || !dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }
  const cached = trimmedImageCache.get(dataUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = img;
        if (width < 32 || height < 32) {
          trimmedImageCache.set(dataUrl, dataUrl);
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const { left, top, cropW, cropH, trimmed } = detectContentBounds(ctx, width, height);
        if (!trimmed) {
          trimmedImageCache.set(dataUrl, dataUrl);
          resolve(dataUrl);
          return;
        }
        const outCanvas = document.createElement("canvas");
        outCanvas.width = cropW;
        outCanvas.height = cropH;
        const outCtx = outCanvas.getContext("2d");
        if (!outCtx) {
          resolve(dataUrl);
          return;
        }
        outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
        const result = outCanvas.toDataURL("image/jpeg", 0.9);
        trimmedImageCache.set(dataUrl, result);
        trimmedImageCache.set(result, result);
        resolve(result);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function getCachedTrimmedImage(dataUrl?: string): string | undefined {
  if (!dataUrl) return dataUrl;
  return trimmedImageCache.get(dataUrl);
}

/**
 * Otimiza data URLs de imagens em base64 (remove margens brancas, restringe dimensão máxima a 1200px e comprime)
 * reduzindo o peso em 80-90% para evitar ultrapassar limites de armazenamento do navegador.
 */
export async function optimizeImageBase64(dataUrl: string, maxDim = 1200, quality = 0.82): Promise<string> {
  if (typeof document === "undefined" || !dataUrl.startsWith("data:image/")) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const { left, top, cropW, cropH, trimmed } = detectContentBounds(ctx, width, height);
        let targetCanvas = canvas;
        if (trimmed) {
          const cropped = document.createElement("canvas");
          cropped.width = cropW;
          cropped.height = cropH;
          const croppedCtx = cropped.getContext("2d");
          if (croppedCtx) {
            croppedCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
            targetCanvas = cropped;
          }
        } else if (width === img.width && height === img.height && dataUrl.length < 150000) {
          trimmedImageCache.set(dataUrl, dataUrl);
          resolve(dataUrl);
          return;
        }
        const isPng = dataUrl.startsWith("data:image/png") && !trimmed;
        const optimized = targetCanvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality);
        const finalUrl = trimmed || optimized.length < dataUrl.length ? optimized : dataUrl;
        trimmedImageCache.set(finalUrl, finalUrl);
        resolve(finalUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Lê o documento de referência (PDF ou Word) e extrai tanto o texto quanto todas as imagens originais otimizadas.
 */
export async function readStudioReference(file: File): Promise<StudioReferenceDoc> {
  const extension = file.name.toLowerCase().split(".").pop() || "";
  const mime = file.type.toLowerCase();
  const isPdf = extension === "pdf" || mime === "application/pdf";
  const isDocx = extension === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isDoc = extension === "doc" || mime === "application/msword";
  if (!isPdf && !isDocx && !isDoc) throw new Error("Envie um PDF ou documento Word nos formatos .docx ou .doc.");
  const maxFileSize = isPdf ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
  const maxSizeLabel = isPdf ? "20 MB para PDF" : "50 MB para Word";
  if (!file.size) throw new Error("O arquivo selecionado está vazio. Escolha outro documento.");
  if (file.size > maxFileSize) throw new Error(`O arquivo excede o limite de ${maxSizeLabel}. Reduza o tamanho e tente novamente.`);
  const buffer = await file.arrayBuffer();
  let text: string;
  let rawImages: ExtractedReferenceImage[] = [];

  if (isDocx) {
    try {
      if (new Uint8Array(buffer)[0] !== 0x50 || new Uint8Array(buffer)[1] !== 0x4b) throw new Error("Formato de arquivo inválido.");
      text = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
    } catch {
      throw new Error("Não foi possível ler este arquivo Word. Abra-o no Word e salve novamente como Documento do Word (.docx).");
    }
    rawImages = await extractImagesFromDocx(buffer);
  } else if (isDoc) {
    text = readLegacyWord(buffer);
  } else {
    if (new TextDecoder().decode(buffer.slice(0, 5)) !== "%PDF-") throw new Error("O arquivo selecionado não é um PDF válido.");
    try {
      rawImages = await extractPageImagesFromPdf(buffer);
    } catch (error) {
      console.warn("Não foi possível relacionar imagens às páginas do PDF:", error);
    }
    // Older or malformed PDFs can contain JPEG streams that PDF.js cannot expose.
    // Keep those available for manual selection, and complement any missed streams.
    const streamImages = extractImagesFromPdf(buffer);
    if (!rawImages.length) {
      rawImages = streamImages;
    } else if (streamImages.length > rawImages.length) {
      const existingSizes = new Set(rawImages.map(img => img.sizeBytes || 0));
      for (const sImg of streamImages) {
        if (rawImages.length >= streamImages.length) break;
        if (!sImg.sizeBytes || !existingSizes.has(sImg.sizeBytes)) {
          rawImages.push(sImg);
        }
      }
    }
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    
    // Extrai URLs embutidas nas anotações do PDF para garantir fontes originais
    const latin1 = Array.from(bytes.subarray(0, Math.min(bytes.length, 3000000)), b => String.fromCharCode(b)).join("");
    const uriMatches = latin1.matchAll(/\/URI\s*\(([^)]+)\)|\/URI\s*<([^>]+)>/g);
    const extractedUrls: string[] = [];
    for (const m of uriMatches) {
      const u = (m[1] || m[2] || "").trim();
      if (/^https?:\/\//i.test(u) && !extractedUrls.includes(u) && u.length < 250) extractedUrls.push(u);
    }

    const transcriptionPrompt = "Transcreva apenas o conteúdo deste documento, com máxima fidelidade e compreensão estrutural, sem resumir ou comentar. Marque cada página impressa com [PÁGINA: número] quando conseguir identificá-la; não estime a paginação. Preserve a proximidade entre imagens, legendas, fontes e páginas. É FUNDAMENTAL transcrever fielmente: 1) Todas as fontes e créditos de imagens presentes (ex: 'Fonte: Wikimedia Commons', links de origem); 2) Caixas de 'Dica de pesquisa' ou recomendações práticas na íntegra; 3) Qualquer menção a QR Codes e links da internet, indicando expressamente a qual plataforma ou conteúdo o QR Code corresponde; 4) Exercícios e problemas com enunciados e alternativas completos, sem corrigir nem completar o conteúdo.";
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: transcriptionPrompt }, { inlineData: { mimeType: "application/pdf", data: btoa(binary) } }] }] });
    text = result.response.text();
    if (extractedUrls.length > 0) {
      text += `\n\n[LINKS E FONTES DIGITAIS DO DOCUMENTO ORIGINAL]\n` + extractedUrls.map(u => `- ${u}`).join("\n");
    }
  }
  if (!text.trim()) throw new Error("O documento não contém texto legível. Tente outro arquivo.");
  if (text.length > 200000) throw new Error("O documento é muito extenso. Envie um capítulo ou trecho menor.");

  // Otimiza as imagens extraídas para uso rápido e leve na interface e no salvamento
  const images = await Promise.all(rawImages.map(async (img) => ({
    ...img,
    url: await optimizeImageBase64(img.url),
  })));

  return { text: text.trim(), images };
}
