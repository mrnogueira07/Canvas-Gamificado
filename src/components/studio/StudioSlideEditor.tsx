import { useState, useEffect } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Trash2, Image as ImageIcon, X, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import type { StudioProject, StudioSlide, StudioSlideImageAspect, StudioSlideImageFit } from "../../lib/studioProjects";
import { createStudioId } from "../../lib/studioProjects";
import { orderedStudioSlides, slideTypeLabels, studioCategories } from "../../lib/studioNavigation";
import { slideLayouts } from "../../lib/studioGeneration";
import { slideTypes } from "../../lib/studioGuidelines";
import { uploadStudioImage } from "../../lib/studioImages";
import { StudioSlideFrame } from "./StudioSlidePreview";
import { StudioImageEditor } from "./StudioImageEditor";
import "../../styles/studio/studio-slide-editor.css";

const layoutLabels: Record<string, string> = {
  so_texto: "Somente texto",
  imagem_esquerda_texto_direita: "Imagem à esquerda e texto à direita",
  topicos_com_barras: "Tópicos com barras laterais",
  caixas_contorno: "Caixas com contorno",
  formula_com_espaco: "Fórmula com espaço para resolução",
  capa: "Capa",
  objetivo_habilidades: "Objetivo e habilidades",
  topicos_com_imagem: "Tópicos com imagem",
  topicos: "Tópicos",
  comparacao: "Comparação",
  processo: "Processo",
  linha_do_tempo: "Linha do tempo",
  mapa_resumo: "Mapa-resumo",
  formula: "Fórmula",
  exercicio: "Exercício",
  gabarito: "Gabarito",
  encerramento: "Encerramento",
};

export function StudioSlideEditor({
  project,
  userId,
  onSlidesChange,
  onSlideChange,
  onProjectChange,
  initialSlideId,
  onSelectSlide,
}: {
  project: StudioProject;
  userId: string;
  onSlidesChange: (slides: StudioSlide[]) => void;
  onSlideChange: (id: string, patch: Partial<StudioSlide>) => void;
  onProjectChange: (patch: Partial<StudioProject>) => void;
  initialSlideId?: string;
  onSelectSlide?: (id: string) => void;
}) {
  const slides = orderedStudioSlides(project.slides);
  const [selectedId, setSelectedId] = useState(
    initialSlideId && slides.some(s => s.id === initialSlideId) ? initialSlideId : slides[0]?.id
  );
  const [showImageModal, setShowImageModal] = useState(false);
  const [isDraggingOverCanvas, setIsDraggingOverCanvas] = useState(false);
  const [isUploadingDirect, setIsUploadingDirect] = useState(false);

  useEffect(() => {
    if (!showImageModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowImageModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showImageModal]);

  const selectSlide = (id: string) => {
    setSelectedId(id);
    onSelectSlide?.(id);
  };

  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverCanvas(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (!selected) return;

    try {
      setIsUploadingDirect(true);
      const url = await uploadStudioImage(userId, project.id, selected.id, file);
      const nextLayout = selected.layout === "topicos"
        ? "topicos_com_imagem"
        : (selected.layout && selected.layout !== "so_texto" ? selected.layout : "imagem_esquerda_texto_direita");
      patch({
        image: {
          url,
          description: selected.image?.description || selected.title,
          source: "Fonte: imagem enviada pelo professor",
          status: "Enviada pelo professor",
        },
        layout: nextLayout,
        pending: selected.pending?.filter(item => !/imagem|crédito/i.test(item)),
      });
    } catch (err) {
      console.error("Direct upload failed:", err);
    } finally {
      setIsUploadingDirect(false);
    }
  };

  useEffect(() => {
    if (initialSlideId) {
      setSelectedId(initialSlideId);
    }
  }, [initialSlideId]);

  const selected = slides.find(slide => slide.id === selectedId) || slides[0];
  const index = slides.findIndex(slide => slide.id === selected?.id);
  const patch = (value: Partial<StudioSlide>) => {
    if (selected) onSlideChange(selected.id, value);
  };

  const availableLayouts =
    project.line === "Konectar.me"
      ? [
          "so_texto",
          "imagem_esquerda_texto_direita",
          "topicos_com_imagem",
          "topicos",
          "comparacao",
          "processo",
          "linha_do_tempo",
          "mapa_resumo",
          "formula",
          "formula_com_espaco",
          "exercicio",
          "gabarito",
        ]
      : slideLayouts;

  function add(type = "conteudo") {
    const slide: StudioSlide = {
      id: createStudioId(),
      type,
      title: "",
      content: "",
      notes: "",
      duration: 45,
      layout: "so_texto",
    };
    onSlidesChange([...project.slides, slide]);
    selectSlide(slide.id);
  }

  function move(delta: number) {
    const next = [...slides];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onSlidesChange(next);
  }

  return (
    <div className="studio-slide-editor">
      <nav className="studio-slide-editor__nav" aria-label="Categorias e slides">
        {studioCategories.map(category => {
          const items = slides.filter(slide => category.types.includes(slide.type || "conteudo"));
          return (
            <section key={category.id}>
              <h3>{category.label}</h3>
              {items.map(slide => (
                <button
                  type="button"
                  key={slide.id}
                  aria-current={slide.id === selected?.id ? "step" : undefined}
                  onClick={() => selectSlide(slide.id)}
                >
                  <span>{String(slides.indexOf(slide) + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{slideTypeLabels[slide.type || "conteudo"]}</strong>
                    {slide.title && slide.title !== slide.type && <small>{slide.title}</small>}
                  </div>
                </button>
              ))}
            </section>
          );
        })}
        <button type="button" className="studio-slide-editor__new" onClick={() => add()}>
          <Plus size={16} /> Adicionar slide
        </button>
      </nav>

      {selected ? (
        <div className="studio-slide-editor__workspace" key={selected.id}>
          <header className="studio-slide-editor__heading">
            <div className="studio-slide-editor__counter-group">
              <div className="studio-slide-editor__stepper">
                <button
                  type="button"
                  title="Slide anterior"
                  aria-label="Ir para o slide anterior"
                  disabled={index === 0}
                  onClick={() => selectSlide(slides[index - 1].id)}
                >
                  <ChevronLeft size={15} />
                </button>
                <p>
                  SLIDE {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
                </p>
                <button
                  type="button"
                  title="Próximo slide"
                  aria-label="Ir para o próximo slide"
                  disabled={index >= slides.length - 1}
                  onClick={() => selectSlide(slides[index + 1].id)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
              <h3>{selected.title || slideTypeLabels[selected.type || "conteudo"]}</h3>
            </div>
            <div className="studio-slide-editor__header-actions">
              {!["capa", "encerramento"].includes(selected.type || "") && (
                <button
                  type="button"
                  className="studio-slide-editor__btn-insert-image"
                  title={selected.image?.url ? "Alterar ou refinar imagem com IA / upload" : "Inserir imagem neste slide (IA, arquivo ou material)"}
                  onClick={() => setShowImageModal(true)}
                >
                  <ImageIcon size={15} />
                  <span>{selected.image?.url ? "Alterar imagem" : "Inserir imagem"}</span>
                </button>
              )}
              <button
                type="button"
                title="Mover para cima dentro do mesmo tipo"
                aria-label="Mover slide para cima"
                disabled={index === 0 || slides[index - 1]?.type !== selected.type}
                onClick={() => move(-1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                title="Mover para baixo dentro do mesmo tipo"
                aria-label="Mover slide para baixo"
                disabled={index === slides.length - 1 || slides[index + 1]?.type !== selected.type}
                onClick={() => move(1)}
              >
                <ArrowDown size={17} />
              </button>
              <button
                type="button"
                aria-label="Excluir slide"
                title="Excluir slide"
                onClick={() => {
                  const nextSlides = project.slides.filter(s => s.id !== selected.id);
                  const nextOrdered = orderedStudioSlides(nextSlides);
                  const fallback = nextOrdered[Math.min(index, nextOrdered.length - 1)]?.id || nextOrdered[0]?.id;
                  onSlidesChange(nextSlides);
                  if (fallback) selectSlide(fallback);
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </header>

          {/* PALCO DO SLIDE COM EDIÇÃO DIRETA NO ESTILO POWERPOINT E DRAG & DROP */}
          <div
            className={`studio-slide-editor__canvas ${isDraggingOverCanvas ? "studio-slide-editor__canvas--drag-over" : ""}`}
            onDragOver={e => {
              e.preventDefault();
              if (!isDraggingOverCanvas) setIsDraggingOverCanvas(true);
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDraggingOverCanvas(false);
              }
            }}
            onDrop={handleCanvasDrop}
          >
            {isDraggingOverCanvas && (
              <div className="studio-slide-editor__canvas-drag-overlay">
                <ImageIcon size={42} />
                <strong>Solte a imagem aqui para inseri-la no slide</strong>
                <p>O layout se ajustará automaticamente com a imagem</p>
              </div>
            )}
            {isUploadingDirect && (
              <div className="studio-slide-editor__canvas-drag-overlay">
                <LoaderCircle size={42} className="studio-editor__spinner" />
                <strong>Enviando imagem para o slide...</strong>
              </div>
            )}
            <StudioSlideFrame
              project={project}
              slide={selected}
              isEditable={true}
              onSlideChange={patch}
              onProjectChange={onProjectChange}
              onOpenImageEditor={() => setShowImageModal(true)}
              onSlidesChange={onSlidesChange}
              onSelectSlide={selectSlide}
            />
            <p className="studio-slide-editor__hint-text">
              ✨ <strong>Edição no slide:</strong> clique diretamente em qualquer texto ou na imagem para editar. Você também pode arrastar uma foto direto para cá.
            </p>
          </div>

          {/* BARRA DE FERRAMENTAS DO SLIDE */}
          <div className="studio-slide-editor__toolbar">
            <label className="studio-toolbar__item">
              <span>Tipo</span>
              <select value={selected.type || "conteudo"} onChange={event => patch({ type: event.target.value })}>
                {slideTypes.map(type => (
                  <option value={type} key={type}>
                    {slideTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            {!["capa", "encerramento"].includes(selected.type || "") && (
              <label className="studio-toolbar__item">
                <span>Composição</span>
                <select
                  value={
                    selected.layout && selected.layout !== "so_texto"
                      ? selected.layout
                      : selected.image?.url
                        ? "imagem_esquerda_texto_direita"
                        : (selected.layout || "so_texto")
                  }
                  onChange={event => {
                    const newLayout = event.target.value;
                    const updates: Partial<StudioSlide> = { layout: newLayout };
                    if (newLayout !== "linha_do_tempo" && selected.timelineItems?.length && !selected.content.trim()) {
                      updates.content = selected.timelineItems
                        .map(item => `• ${item.label}${item.text ? `: ${item.text}` : ""}`)
                        .join("\n");
                    }
                    if (["imagem_esquerda_texto_direita", "topicos_com_imagem"].includes(newLayout) && !selected.image?.url && selected.timelineItems?.length) {
                      const firstImg = selected.timelineItems.find(t => t.image?.url)?.image;
                      if (firstImg) {
                        updates.image = {
                          description: firstImg.description || "Imagem",
                          source: firstImg.source || "",
                          status: "Pronta",
                          url: firstImg.url,
                          aspectRatio: firstImg.aspectRatio,
                          fit: firstImg.fit,
                        };
                      }
                    }
                    patch(updates);
                  }}
                >
                  {availableLayouts.map(layout => (
                    <option value={layout} key={layout}>
                      {layoutLabels[layout]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!["capa", "encerramento", "objetivo_bncc"].includes(selected.type || "") &&
              (Boolean(selected.image?.url) || ["imagem_esquerda_texto_direita", "topicos_com_imagem"].includes(selected.layout || "")) && (
              <>
                <label className="studio-toolbar__item">
                  <span>Proporção</span>
                  <select
                    value={selected.image?.aspectRatio || "3:4"}
                    onChange={event => {
                      const nextAspect = event.target.value as StudioSlideImageAspect;
                      patch({
                        image: {
                          description: selected.image?.description || selected.title,
                          source: selected.image?.source || "",
                          status: selected.image?.status || "Pronta",
                          ...selected.image,
                          aspectRatio: nextAspect,
                        },
                      });
                    }}
                  >
                    <option value="3:4">3:4 (Vertical)</option>
                    <option value="1:1">1:1 (Quadrada)</option>
                    <option value="4:3">4:3 (Clássica)</option>
                    <option value="16:9">16:9 (Panorâmica)</option>
                  </select>
                </label>

                <label className="studio-toolbar__item">
                  <span>Ajuste</span>
                  <select
                    value={selected.image?.fit || "cover"}
                    onChange={event => {
                      const nextFit = event.target.value as StudioSlideImageFit;
                      patch({
                        image: {
                          description: selected.image?.description || selected.title,
                          source: selected.image?.source || "",
                          status: selected.image?.status || "Pronta",
                          ...selected.image,
                          fit: nextFit,
                        },
                      });
                    }}
                  >
                    <option value="cover">Preencher quadro</option>
                    <option value="contain">Imagem inteira</option>
                  </select>
                </label>
              </>
            )}

            {!["capa", "encerramento"].includes(selected.type || "") && (
              <div className="studio-toolbar__item studio-toolbar__item--position" title="Ajuste o alinhamento vertical das caixas no slide">
                <span>Posição</span>
                <div className="studio-toolbar__nudge-group">
                  {Boolean(selected.image?.url) && (
                    <div className="studio-toolbar__nudge-subgroup" title="Mover caixa da imagem para cima ou para baixo">
                      <span className="studio-toolbar__nudge-label">🖼️</span>
                      <button
                        type="button"
                        className="studio-toolbar__nudge-btn"
                        title="Subir imagem"
                        onClick={() => {
                          const current = selected.imageOffsetY || 0;
                          patch({ imageOffsetY: Math.max(0, Math.round((current - 1.5) * 10) / 10) });
                        }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="studio-toolbar__nudge-btn"
                        title="Descer imagem"
                        onClick={() => {
                          const current = selected.imageOffsetY || 0;
                          patch({ imageOffsetY: Math.min(18, Math.round((current + 1.5) * 10) / 10) });
                        }}
                      >
                        ▼
                      </button>
                      {Boolean(selected.imageOffsetY) && (
                        <button
                          type="button"
                          className="studio-toolbar__nudge-btn studio-toolbar__nudge-btn--reset"
                          title="Resetar imagem ao topo"
                          onClick={() => patch({ imageOffsetY: 0 })}
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  )}

                  <div className="studio-toolbar__nudge-subgroup" title="Mover caixa de texto para cima ou para baixo">
                    <span className="studio-toolbar__nudge-label">📝</span>
                    <button
                      type="button"
                      className="studio-toolbar__nudge-btn"
                      title="Subir texto"
                      onClick={() => {
                        const current = selected.textOffsetY || 0;
                        patch({ textOffsetY: Math.max(0, Math.round((current - 1.5) * 10) / 10) });
                      }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="studio-toolbar__nudge-btn"
                      title="Descer texto"
                      onClick={() => {
                        const current = selected.textOffsetY || 0;
                        patch({ textOffsetY: Math.min(18, Math.round((current + 1.5) * 10) / 10) });
                      }}
                    >
                      ▼
                    </button>
                    {Boolean(selected.textOffsetY) && (
                      <button
                        type="button"
                        className="studio-toolbar__nudge-btn studio-toolbar__nudge-btn--reset"
                        title="Resetar texto ao topo"
                        onClick={() => patch({ textOffsetY: 0 })}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <label className="studio-toolbar__item studio-toolbar__item--duration">
              <span>Duração</span>
              <input
                type="number"
                min={0}
                max={720}
                value={selected.duration || 0}
                onChange={event =>
                  patch({ duration: Math.max(0, Math.min(720, Number(event.target.value) || 0)) })
                }
              />
              <span className="studio-toolbar__unit">seg</span>
            </label>

            {!["capa", "encerramento"].includes(selected.type || "") && (
              <button
                type="button"
                className="studio-toolbar__button studio-toolbar__button--primary"
                onClick={() => setShowImageModal(true)}
                title="Abrir gerenciador de imagem / geração com IA / upload"
              >
                <ImageIcon size={15} />
                <span>{selected.image?.url ? "Alterar imagem" : "Inserir imagem"}</span>
              </button>
            )}
          </div>

          {/* NOTAS DO APRESENTADOR (PowerPoint Notes Pane) */}
          <div className="studio-slide-editor__notes-panel">
            <div className="studio-slide-editor__notes-header">
              <span>📝 <strong>Notas do apresentador e direção visual</strong></span>
              <small>Roteiro de fala para o teleprompter e instruções de gravação</small>
            </div>
            <textarea
              className="studio-slide-editor__notes-textarea"
              rows={3}
              maxLength={20000}
              value={selected.notes}
              onChange={event => patch({ notes: event.target.value })}
              placeholder="Clique para adicionar anotações do orador / roteiro de fala para este slide..."
            />
          </div>

          {/* PENDÊNCIAS E REVISÃO */}
          <details className="studio-slide-editor__pending">
            <summary>
              Pendências e revisão {selected.pending?.length ? `(${selected.pending.length})` : ""}
            </summary>
            <div className="studio-slide-editor__pending-body">
              <label className="studio-field">
                Uma pendência por linha
                <textarea
                  rows={2}
                  maxLength={4000}
                  value={(selected.pending || []).join("\n")}
                  onChange={event => patch({ pending: event.target.value.split("\n").filter(Boolean) })}
                  placeholder="Ex.: Conferir fonte da imagem; validar citação com a apostila..."
                />
              </label>
            </div>
          </details>

          {/* RODAPÉ DE NAVEGAÇÃO ENTRE SLIDES */}
          <footer className="studio-slide-editor__footer">
            <button
              type="button"
              className="studio-button studio-button--quiet"
              disabled={index === 0}
              onClick={() => selectSlide(slides[index - 1].id)}
            >
              <ArrowLeft size={16} /> Anterior
            </button>
            <button
              type="button"
              className="studio-button studio-button--quiet"
              onClick={() => add(selected.type || "conteudo")}
            >
              <Plus size={16} /> Adicionar neste tipo
            </button>
            <button
              type="button"
              className="studio-button studio-button--primary"
              disabled={index === slides.length - 1}
              onClick={() => selectSlide(slides[index + 1].id)}
            >
              Próximo <ArrowRight size={16} />
            </button>
          </footer>

          {/* MODAL PARA O GERENCIADOR DE IMAGEM */}
          {showImageModal && (
            <div className="studio-modal-overlay" onClick={() => setShowImageModal(false)}>
              <div className="studio-modal-dialog" onClick={e => e.stopPropagation()}>
                <header className="studio-modal-header">
                  <div className="studio-modal-header-title">
                    <span className="studio-modal-header-icon">🖼️</span>
                    <div>
                      <h3>Imagem do Slide {String(index + 1).padStart(2, "0")} — {slideTypeLabels[selected.type || "conteudo"]}</h3>
                      <p className="studio-modal-header-sub">Gerencie ilustrações com IA, imagens da apostila ou arquivos do seu computador</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="studio-modal-close-btn"
                    onClick={() => setShowImageModal(false)}
                    aria-label="Fechar janela do editor de imagem"
                    title="Fechar modal (Esc)"
                  >
                    <X size={16} />
                    <span>Fechar</span>
                    <kbd className="studio-modal-kbd">Esc</kbd>
                  </button>
                </header>
                <div className="studio-modal-body">
                  <StudioImageEditor
                    project={project}
                    slide={selected}
                    userId={userId}
                    onChange={patch}
                    onProjectChange={onProjectChange}
                    onClose={() => setShowImageModal(false)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="studio-editor__empty">
          <h3>Adicione um slide para começar</h3>
          <button type="button" className="studio-button studio-button--primary" onClick={() => add()}>
            Adicionar slide
          </button>
        </div>
      )}
    </div>
  );
}
