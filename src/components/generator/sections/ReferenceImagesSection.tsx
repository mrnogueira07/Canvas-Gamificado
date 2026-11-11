/**
 * Seção 6 — Exemplos de Imagens (referências visuais para o desenvolvedor).
 *
 * Permite adicionar até 5 imagens via upload (com redimensionamento
 * automático para JPEG 900px e qualidade 0.72) ou via URL. Cada imagem
 * tem uma proporção configurável (16:9, 3:5 ou 1:1).
 *
 * Suporta resolução automática de links de páginas (ex: Shutterstock,
 * Google Imagens, Google Drive, Wikipédia/Wikimedia, Unsplash, Pexels,
 * Imgur, Dropbox, etc.) tanto na visualização em tela quanto na
 * exportação em PDF.
 *
 * Quando todas as imagens estão vazias, a seção inteira é escondida na
 * exportação para PDF (classe `export-hide`).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layers, X } from "../../../lib/icons";
import { SectionCard } from "../shared/SectionCard";
import {
  type AspectRatio,
  type ParsedImageEntry,
  parseReferenceImageEntry,
  getCanvasImageCandidates,
  resolveWebpageImageAsync,
} from "../../../lib/imageUrlResolver";

const RATIO_OPTIONS: { label: AspectRatio; aspectCss: string }[] = [
  { label: "16:9", aspectCss: "16 / 9" },
  { label: "3:5", aspectCss: "3 / 5" },
  { label: "1:1", aspectCss: "1 / 1" },
];

interface ReferenceImagesSectionProps {
  images: unknown[];
  onUpdate: (images: string[]) => void;
  readOnly?: boolean;
}

interface ResilientCanvasImageProps {
  rawSrc: string;
  alt: string;
  aspectCss: string;
  description?: string;
}

/**
 * Componente de imagem resiliente que resolve links de páginas (Shutterstock,
 * Google Drive, Google Imagens, Wikipédia, etc.), tenta múltiplos fallbacks
 * (incluindo proxy de imagem para evitar bloqueios de hotlink/CORS) e garante
 * renderização em fluxo normal para sair perfeitamente na exportação em PDF.
 */
const ResilientCanvasImage: React.FC<ResilientCanvasImageProps> = ({
  rawSrc,
  alt,
  aspectCss,
  description,
}) => {
  const baseCandidates = useMemo(
    () => getCanvasImageCandidates(rawSrc),
    [rawSrc]
  );
  const [extraCandidates, setExtraCandidates] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [triedAsync, setTriedAsync] = useState(false);
  const [failedAll, setFailedAll] = useState(false);

  const allCandidates = useMemo(() => {
    const merged = [...baseCandidates];
    for (const c of extraCandidates) {
      if (c && !merged.includes(c)) merged.push(c);
    }
    return merged;
  }, [baseCandidates, extraCandidates]);

  useEffect(() => {
    setExtraCandidates([]);
    setCandidateIndex(0);
    setTriedAsync(false);
    setFailedAll(false);
  }, [rawSrc]);

  const activeSrc = allCandidates[candidateIndex] || "";

  const handleImageError = () => {
    if (candidateIndex + 1 < allCandidates.length) {
      setCandidateIndex((prev) => prev + 1);
      return;
    }

    if (!triedAsync && rawSrc.startsWith("http")) {
      setTriedAsync(true);
      resolveWebpageImageAsync(rawSrc)
        .then((metaImageUrl) => {
          if (metaImageUrl) {
            const resolvedMetaCandidates = getCanvasImageCandidates(metaImageUrl);
            if (resolvedMetaCandidates.length > 0) {
              setExtraCandidates(resolvedMetaCandidates);
              return;
            }
          }
          setFailedAll(true);
        })
        .catch(() => {
          setFailedAll(true);
        });
      return;
    }

    setFailedAll(true);
  };

  if (!rawSrc || rawSrc.trim() === "") {
    return (
      <div
        className="w-full bg-slate-100 dark:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-400"
        style={{ aspectRatio: aspectCss }}
      >
        <svg
          className="w-10 h-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4-4a3 3 0 014.24 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M8 10a2 2 0 110-4 2 2 0 010 4z"
          />
        </svg>
        <span className="text-[12.1px] font-bold uppercase tracking-widest">
          Sem imagem
        </span>
      </div>
    );
  }

  if (failedAll || !activeSrc) {
    return (
      <div
        className="w-full bg-slate-100 dark:bg-slate-800/70 flex flex-col items-center justify-center gap-2 p-4 text-center text-slate-500"
        style={{ aspectRatio: aspectCss }}
      >
        <svg
          className="w-9 h-9 text-violet-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4-4a3 3 0 014.24 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M8 10a2 2 0 110-4 2 2 0 010 4z"
          />
        </svg>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {description || alt}
        </span>
        <span className="text-[10px] text-slate-400 break-all line-clamp-2 max-w-xs">
          Referência externa vinculada por link
        </span>
      </div>
    );
  }

  return (
    <div className="canvas-reference-image-frame relative w-full bg-slate-100 dark:bg-slate-900/60 overflow-hidden">
      <img
        key={activeSrc}
        src={activeSrc}
        alt={description || alt}
        referrerPolicy="no-referrer"
        loading="eager"
        decoding="sync"
        style={{ aspectRatio: aspectCss }}
        className="canvas-reference-img block w-full h-auto object-cover print:object-contain print:max-h-[70mm]"
        onError={handleImageError}
      />
    </div>
  );
};

export const ReferenceImagesSection: React.FC<ReferenceImagesSectionProps> = ({
  images,
  onUpdate,
  readOnly = false,
}) => {
  const entries: ParsedImageEntry[] = (Array.isArray(images) ? images : []).map(
    parseReferenceImageEntry
  );
  const save = (next: ParsedImageEntry[]) => {
    if (readOnly) return;
    onUpdate(next.map((e) => JSON.stringify(e)));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlDrafts, setUrlDrafts] = useState<(string | undefined)[]>([]);

  /**
   * Faz upload de uma imagem, redimensiona para no máximo 900px no maior
   * lado e devolve como dataURL JPEG comprimida (qualidade 0.72).
   */
  const processFile = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`Imagem ${file.name} muito grande.`);
        return resolve(null);
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let w = img.width;
          let h = img.height;
          if (w > h ? w > MAX : h > MAX) {
            if (w > h) {
              h = (h * MAX) / w;
              w = MAX;
            } else {
              w = (w * MAX) / h;
              h = MAX;
            }
          }
          const cv = document.createElement("canvas");
          cv.width = w;
          cv.height = h;
          const ctx = cv.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            resolve(cv.toDataURL("image/jpeg", 0.72));
          } else {
            alert(
              `Erro ao processar a imagem ${file.name}. Por favor, tente enviar novamente.`
            );
            resolve(null);
          }
        };
        img.onerror = () => {
          alert(
            `Falha ao carregar a imagem ${file.name}. Por favor, tente enviar novamente.`
          );
          resolve(null);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        alert(
          `Erro ao ler o arquivo ${file.name}. Por favor, tente enviar novamente.`
        );
        resolve(null);
      };
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = e.target.files;
    if (!files) return;
    if (entries.length + files.length > 5) {
      alert("Máximo de 5 imagens.");
      return;
    }
    const results = await Promise.all(Array.from(files).map(processFile));
    const newEntries: ParsedImageEntry[] = results
      .filter(Boolean)
      .map((src) => ({ src: src!, ratio: "16:9", description: "" }));
    save([...entries, ...newEntries].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addFromUrl = (i: number) => {
    if (readOnly) return;
    const url =
      urlDrafts[i] !== undefined ? urlDrafts[i]?.trim() : entries[i]?.src?.trim();
    if (!url) return;
    const updated = [...entries];
    updated[i] = { ...updated[i], src: url };
    save(updated);
    setUrlDrafts((prev) => {
      const n = [...prev];
      n[i] = undefined;
      return n;
    });
  };

  const changeRatio = (i: number, ratio: AspectRatio) => {
    if (readOnly) return;
    const updated = [...entries];
    updated[i] = { ...updated[i], ratio };
    save(updated);
  };

  const changeDescription = (i: number, description: string) => {
    if (readOnly) return;
    const updated = [...entries];
    updated[i] = { ...updated[i], description };
    save(updated);
  };

  const remove = (i: number) => {
    if (readOnly) return;
    save(entries.filter((_, idx) => idx !== i));
    setUrlDrafts((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addBlank = () => {
    if (readOnly || entries.length >= 5) return;
    save([...entries, { src: "", ratio: "16:9", description: "" }]);
  };

  const hasAnyValidImage = entries.some((e, i) => {
    const currentSrc =
      urlDrafts[i] !== undefined && urlDrafts[i] !== ""
        ? urlDrafts[i]
        : e.src;
    return Boolean(currentSrc && currentSrc.trim() !== "");
  });

  return (
    <SectionCard
      number="6"
      title="Exemplos de Imagens"
      icon={<Layers className="w-5 h-5 text-pink-500" />}
      headerColor="bg-pink-50/50 border-pink-100/50"
      className={hasAnyValidImage ? "" : "export-hide"}
    >
      <div className="canvas-reference-images space-y-6">
        {!readOnly && (
          <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
            <p className="text-xs text-slate-400 font-medium">
              Adicione até 5 imagens de referência via upload ou link. Escolha a
              proporção de cada imagem.
            </p>
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={entries.length >= 5}
                className={`px-4 py-2 bg-pink-50 text-pink-600 border border-pink-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:bg-pink-100 ${
                  entries.length >= 5
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                ↑ Upload ({entries.length}/5)
              </button>
              <button
                onClick={addBlank}
                disabled={entries.length >= 5}
                className={`px-4 py-2 bg-violet-50 text-violet-600 border border-violet-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:bg-violet-100 ${
                  entries.length >= 5
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                + Por Link
              </button>
            </div>
          </div>
        )}

        {/* Grade/Pilha de imagens — em tela 1 por linha centralizada; no PDF em grade compacta */}
        <div className="canvas-reference-images-grid flex flex-col gap-6 print:grid print:grid-cols-2 print:gap-4">
          {entries.map((entry, i) => {
            const aspectCss =
              RATIO_OPTIONS.find((r) => r.label === entry.ratio)?.aspectCss ||
              "16 / 9";
            const currentSrc =
              urlDrafts[i] !== undefined && urlDrafts[i] !== ""
                ? urlDrafts[i]!
                : entry.src;
            return (
              <div
                key={i}
                className={`canvas-reference-image-card w-full max-w-sm mx-auto print:max-w-none bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:break-inside-avoid ${
                  !currentSrc || currentSrc.trim() === "" ? "print:hidden" : ""
                }`}
              >
                {/* Barra de ferramentas */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex-wrap gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Imagem {i + 1}
                  </span>
                  {!readOnly && (
                    <div className="flex items-center gap-2 print:hidden">
                      {/* Seletor de proporção */}
                      <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-black">
                        {RATIO_OPTIONS.map((r) => (
                          <button
                            key={r.label}
                            onClick={() => changeRatio(i, r.label)}
                            className={`px-2.5 py-1 transition-colors cursor-pointer ${
                              entry.ratio === r.label
                                ? "bg-violet-500 text-white"
                                : "bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => remove(i)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview em fluxo normal (compatível com tela e impressão PDF) */}
                <ResilientCanvasImage
                  rawSrc={currentSrc}
                  alt={`Imagem ${i + 1}`}
                  aspectCss={aspectCss}
                  description={entry.description}
                />

                {/* Informação do link (apenas se for URL externa) */}
                {currentSrc && currentSrc.startsWith("http") && (
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 font-mono break-all select-all">
                    <span className="font-black text-[9.9px] text-slate-400 uppercase tracking-widest block mb-0.5">
                      Link da Imagem
                    </span>
                    <a
                      href={currentSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 hover:text-violet-700 underline"
                    >
                      {currentSrc}
                    </a>
                  </div>
                )}

                {/* Campo de Descrição (exibido apenas se houver imagem) */}
                {currentSrc && currentSrc.trim() !== "" && (
                  <div
                    className={`px-4 py-3 bg-white border-t border-slate-100 ${
                      !entry.description?.trim() ? "print:hidden" : ""
                    }`}
                  >
                    <span className="font-black text-[9.9px] text-slate-400 uppercase tracking-widest block mb-1.5">
                      Descrição da Imagem
                    </span>
                    {readOnly ? (
                      <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap">
                        {entry.description || "—"}
                      </p>
                    ) : (
                      <>
                        <textarea
                          placeholder="Adicione uma descrição para esta imagem (opcional)..."
                          value={entry.description || ""}
                          onChange={(e) => changeDescription(i, e.target.value)}
                          rows={2}
                          className="print:hidden w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all font-medium text-slate-700 placeholder-slate-400 resize-y"
                        />
                        {entry.description && entry.description.trim() !== "" && (
                          <p className="hidden print:block text-xs font-medium text-slate-800 whitespace-pre-wrap">
                            {entry.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Input de URL */}
                {!readOnly && (!entry.src || entry.src.trim() === "") && (
                  <div className="px-4 py-3 border-t border-slate-100 flex gap-2 print:hidden">
                    <input
                      type="text"
                      placeholder="Cole o link (URL) da imagem aqui…"
                      value={urlDrafts[i] !== undefined ? urlDrafts[i] : entry.src}
                      onChange={(e) =>
                        setUrlDrafts((prev) => {
                          const n = [...prev];
                          n[i] = e.target.value;
                          return n;
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addFromUrl(i);
                      }}
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all font-medium text-slate-700 placeholder-slate-300"
                    />
                    <button
                      onClick={() => addFromUrl(i)}
                      className="px-3 py-2 bg-violet-500 text-white rounded-lg text-xs font-black hover:bg-violet-600 transition-colors cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
};
