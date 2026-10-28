import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { StudioSlideFrame } from "../components/studio/StudioSlidePreview";
import { orderedStudioSlides } from "./studioNavigation";
import { studioFilename } from "./studioProjects";
import { resolveImageAsDataUrl } from "./studioImages";
import type { StudioProject, StudioSlide } from "./studioProjects";

export async function exportStudioPdf(project: StudioProject): Promise<void> {
  const slides = orderedStudioSlides(project.slides);
  if (!slides.length) throw new Error("Adicione slides antes de exportar o PDF.");
  const width = 1280, height = project.line === "Educação Corporativa" ? 720 : 724;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: `${width}px`, background: "white" });
  document.body.appendChild(host);
  const root = createRoot(host);
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [width, height], hotfixes: ["px_scaling"] });

  try {
    for (const [index, slide] of slides.entries()) {
      let renderedSlide: StudioSlide = { ...slide };

      // Converte imagem principal do slide para Data URL para garantir captura 100% perfeita no html2canvas sem CORS
      if (slide.image?.url) {
        try {
          const dataUrl = await resolveImageAsDataUrl(slide.image.url);
          if (dataUrl) {
            renderedSlide = {
              ...renderedSlide,
              image: { ...slide.image, url: dataUrl },
            };
          }
        } catch (err) {
          console.warn(`Aviso: falha ao resolver imagem do slide ${index + 1} para PDF:`, err);
        }
      }

      // Converte imagens dos marcos de linha do tempo, se houver
      if (slide.timelineItems?.length) {
        try {
          const updatedTimeline = await Promise.all(
            slide.timelineItems.map(async item => {
              if (item.image?.url) {
                const dataUrl = await resolveImageAsDataUrl(item.image.url);
                return { ...item, image: { ...item.image, url: dataUrl || item.image.url } };
              }
              return item;
            })
          );
          renderedSlide = { ...renderedSlide, timelineItems: updatedTimeline };
        } catch (err) {
          console.warn(`Aviso: falha ao resolver imagens da linha do tempo do slide ${index + 1}:`, err);
        }
      }

      flushSync(() => root.render(<StudioSlideFrame project={project} slide={renderedSlide} isEditable={false} />));
      await document.fonts.ready;

      // Garante decodificação completa de todas as imagens antes de disparar o html2canvas
      const images = Array.from(host.querySelectorAll("img"));
      await Promise.all(
        images.map(image => {
          if (image.complete) return Promise.resolve();
          return new Promise(resolve => {
            image.onload = resolve;
            image.onerror = resolve;
          });
        })
      );
      for (const image of images) {
        try {
          await image.decode();
        } catch {
          // Continua
        }
      }

      // Pequeno delay para garantir estabilização do canvas
      await new Promise(resolve => setTimeout(resolve, 80));

      const canvas = await html2canvas(host, {
        backgroundColor: "#fff",
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 30000,
        logging: false,
      });

      if (index) pdf.addPage([width, height], "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, width, height);
    }
    pdf.save(`${studioFilename(project)}.pdf`);
  } finally {
    root.unmount();
    host.remove();
  }
}
