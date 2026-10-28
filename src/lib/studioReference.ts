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
        const value = operation === OPS.paintImageXObject
          ? (typeof args[0] === "string" && page.objs.has(args[0]) ? page.objs.get(args[0]) : undefined)
          : args[0];
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
 * Extrai as imagens originais de um documento Word (.docx).
 */
export async function extractImagesFromDocx(buffer: ArrayBuffer): Promise<ExtractedReferenceImage[]> {
  const images: ExtractedReferenceImage[] = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    let index = 1;
    const mediaFiles = Object.keys(zip.files).filter(path => /^word\/media\/.+\.(png|jpe?g|webp|gif|bmp)$/i.test(path));
    for (const path of mediaFiles) {
      const file = zip.file(path);
      if (!file) continue;
      const arrayBuffer = await file.async("arraybuffer");
      if (arrayBuffer.byteLength < 1500) continue;
      const ext = path.split(".").pop()?.toLowerCase() || "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/png";
      const u8 = new Uint8Array(arrayBuffer);
      let b64 = "";
      for (let i = 0; i < u8.length; i += 8192) {
        b64 += String.fromCharCode(...u8.subarray(i, i + 8192));
      }
      images.push({
        id: `docx-img-${index++}`,
        name: `Imagem ${index - 1} (${path.split("/").pop() || "Word"})`,
        url: `data:${mime};base64,${btoa(b64)}`,
        sizeBytes: arrayBuffer.byteLength,
      });
    }
  } catch (err) {
    console.warn("Erro ao extrair imagens do DOCX:", err);
  }
  return images;
}

/**
 * Otimiza data URLs de imagens em base64 (restringe dimensão máxima a 1200px e comprime)
 * reduzindo o peso em 80-90% para evitar ultrapassar limites de armazenamento do navegador.
 */
export async function optimizeImageBase64(dataUrl: string, maxDim = 1200, quality = 0.82): Promise<string> {
  if (typeof document === "undefined" || !dataUrl.startsWith("data:image/")) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && dataUrl.length < 150000) {
        resolve(dataUrl);
        return;
      }
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
        const isPng = dataUrl.startsWith("data:image/png");
        const optimized = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality);
        resolve(optimized.length < dataUrl.length ? optimized : dataUrl);
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
    // Keep those available for manual selection, but do not guess their page.
    if (!rawImages.length) rawImages = extractImagesFromPdf(buffer);
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
