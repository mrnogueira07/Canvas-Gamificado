import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { StudioProject } from "../../lib/studioProjects";
import { StudioSlideFrame } from "./StudioSlidePreview";
import { orderedStudioSlides, slideTypeLabels, studioCategories } from "../../lib/studioNavigation";
import "../../styles/studio/studio-deck-preview.css";

export function StudioDeckPreview({ project, onClose }: { project: StudioProject; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const slides = orderedStudioSlides(project.slides);
  const slide = slides[index];

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept if an input or textarea is active
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setIndex(current => Math.max(0, current - 1));
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setIndex(current => Math.min(slides.length - 1, current + 1));
      } else if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setNotesOpen(open => !open);
      } else if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, [slides.length, onClose]);

  if (!slide) return null;

  return createPortal(
    <dialog
      ref={dialog}
      className="studio-deck"
      aria-labelledby="studio-deck-title"
      onCancel={onClose}
    >
      <header className="studio-deck__header">
        <div>
          <p>PRÉVIA DOS SLIDES</p>
          <h2 id="studio-deck-title">{project.title || "Aula sem título"}</h2>
        </div>
        <button type="button" aria-label="Fechar prévia" onClick={onClose} autoFocus>
          <X size={22} />
        </button>
      </header>

      <div className="studio-deck__main">
        <nav className="studio-deck__list" aria-label="Categorias e slides">
          {studioCategories.map(category => (
            <section key={category.id}>
              <h3>{category.label}</h3>
              {slides
                .filter(item => category.types.includes(item.type || "conteudo"))
                .map(item => {
                  const position = slides.indexOf(item);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      aria-current={position === index ? "step" : undefined}
                      onClick={() => setIndex(position)}
                    >
                      <span>{String(position + 1).padStart(2, "0")}</span>
                      <strong>
                        {slideTypeLabels[item.type || "conteudo"]}
                        <small>{item.title !== item.type ? item.title : ""}</small>
                      </strong>
                    </button>
                  );
                })}
            </section>
          ))}
        </nav>

        <section className="studio-deck__stage" aria-label="Slide selecionado">
          <div className="studio-deck__canvas">
            <StudioSlideFrame project={project} slide={slide} />
          </div>
          <div className="studio-deck__caption" aria-live="polite">
            Slide {index + 1} de {slides.length} · {slide.title || "Sem título"}
          </div>
          {slide.notes && (
            <details
              className="studio-deck__notes"
              open={notesOpen}
              onToggle={e => setNotesOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary>Notas do apresentador (Pressione Espaço para alternar)</summary>
              <p>{slide.notes}</p>
            </details>
          )}
        </section>
      </div>

      <footer className="studio-deck__footer">
        <p>
          Prévia do conteúdo e dos modelos. Revise textos e ilustrações geradas. Confira a diagramação final no PowerPoint.
        </p>
        <div>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex(current => current - 1)}
            title="Slide anterior (Seta para a esquerda ou para cima)"
          >
            <ArrowLeft size={17} /> Anterior
          </button>
          <button
            type="button"
            disabled={index === slides.length - 1}
            onClick={() => setIndex(current => current + 1)}
            title="Próximo slide (Seta para a direita ou para baixo)"
          >
            Próxima <ArrowRight size={17} />
          </button>
        </div>
      </footer>
    </dialog>,
    document.body
  );
}
