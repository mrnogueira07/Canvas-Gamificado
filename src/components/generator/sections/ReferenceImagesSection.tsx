/**
 * Seção 6 — Exemplos de Imagens (referências visuais para o desenvolvedor).
 *
 * Permite adicionar até 5 imagens via upload (com redimensionamento
 * automático para JPEG 900px e qualidade 0.72) ou via URL. Cada imagem
 * tem uma proporção configurável (16:9, 3:5 ou 1:1).
 *
 * Quando todas as imagens estão vazias, a seção inteira é escondida na
 * exportação para PDF (classe `export-hide`).
 */
import React, { useRef, useState } from "react";
import { Layers, X } from "lucide-react";
import { SectionCard } from "../shared/SectionCard";

type AspectRatio = "16:9" | "3:5" | "1:1";

const RATIO_OPTIONS: { label: AspectRatio; paddingTop: string }[] = [
  { label: "16:9", paddingTop: "56.25%" },
  { label: "3:5", paddingTop: "166.67%" },
  { label: "1:1", paddingTop: "100%" },
];

interface ImageEntry {
  src: string;
  ratio: AspectRatio;
  description?: string;
}

interface ReferenceImagesSectionProps {
  images: string[];
  onUpdate: (images: string[]) => void;
}

export const ReferenceImagesSection: React.FC<ReferenceImagesSectionProps> = ({
  images,
  onUpdate,
}) => {
  /** Tenta interpretar uma entrada salva como JSON {src, ratio, description} ou como URL pura */
  const parse = (raw: string): ImageEntry => {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && ("src" in p || "ratio" in p)) {
        return { src: p.src || "", ratio: p.ratio || "16:9", description: p.description || "" };
      }
    } catch {
      /* não era JSON — trata como URL */
    }
    return { src: raw, ratio: "16:9", description: "" };
  };
  const entries = images.map(parse);
  const save = (next: ImageEntry[]) =>
    onUpdate(next.map((e) => JSON.stringify(e)));

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
            alert(`Erro ao processar a imagem ${file.name}. Por favor, tente enviar novamente.`);
            resolve(null);
          }
        };
        img.onerror = () => {
          alert(`Falha ao carregar a imagem ${file.name}. Por favor, tente enviar novamente.`);
          resolve(null);
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        alert(`Erro ao ler o arquivo ${file.name}. Por favor, tente enviar novamente.`);
        resolve(null);
      };
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (entries.length + files.length > 5) {
      alert("Máximo de 5 imagens.");
      return;
    }
    const results = await Promise.all(Array.from(files).map(processFile));
    const newEntries: ImageEntry[] = results
      .filter(Boolean)
      .map((src) => ({ src: src!, ratio: "16:9" }));
    save([...entries, ...newEntries].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addFromUrl = (i: number) => {
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
    const updated = [...entries];
    updated[i] = { ...updated[i], ratio };
    save(updated);
  };

  const changeDescription = (i: number, description: string) => {
    const updated = [...entries];
    updated[i] = { ...updated[i], description };
    save(updated);
  };

  const remove = (i: number) => {
    save(entries.filter((_, idx) => idx !== i));
    setUrlDrafts((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addBlank = () => {
    if (entries.length >= 5) return;
    save([...entries, { src: "", ratio: "16:9" }]);
  };

  return (
    <SectionCard
      number="6"
      title="Exemplos de Imagens"
      icon={<Layers className="w-5 h-5 text-pink-500" />}
      headerColor="bg-pink-50/50 border-pink-100/50"
      className={
        entries.some((e, i) => {
          const currentSrc =
            urlDrafts[i] !== undefined && urlDrafts[i] !== ""
              ? urlDrafts[i]
              : e.src;
          return currentSrc && currentSrc.trim() !== "";
        })
          ? ""
          : "export-hide"
      }
    >
      <div className="canvas-reference-images space-y-6">
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

        {/* Pilha de imagens — uma por linha, largura total */}
        <div className="flex flex-col gap-6">
          {entries.map((entry, i) => {
            const paddingTop =
              RATIO_OPTIONS.find((r) => r.label === entry.ratio)?.paddingTop ||
              "56.25%";
            const currentSrc =
              urlDrafts[i] !== undefined && urlDrafts[i] !== ""
                ? urlDrafts[i]
                : entry.src;
            return (
              <div
                key={i}
                className={`w-full max-w-sm mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${
                  !currentSrc || currentSrc.trim() === "" ? "print:hidden" : ""
                }`}
              >
                {/* Barra de ferramentas */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex-wrap gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Imagem {i + 1}
                  </span>
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
                </div>

                {/* Preview */}
                <div
                  className="relative w-full bg-slate-100"
                  style={{ paddingTop }}
                >
                  {currentSrc ? (
                    <img
                      src={currentSrc}
                      alt={`Imagem ${i + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
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
                  )}
                </div>

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
                  <div className="px-4 py-3 bg-white border-t border-slate-100">
                    <span className="font-black text-[9.9px] text-slate-400 uppercase tracking-widest block mb-1.5">
                      Descrição da Imagem
                    </span>
                    <textarea
                      placeholder="Adicione uma descrição para esta imagem (opcional)..."
                      value={entry.description || ""}
                      onChange={(e) => changeDescription(i, e.target.value)}
                      rows={2}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all font-medium text-slate-700 placeholder-slate-400 resize-y"
                    />
                  </div>
                )}

                {/* Input de URL */}
                {(!entry.src || entry.src.trim() === "") && (
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
