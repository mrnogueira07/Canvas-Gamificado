import { useRef, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  GripVertical,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Move,
  RotateCcw,
  Trash2,
  Type,
} from "lucide-react";
import type { StudioProject, StudioSlide, StudioSlideImageAspect, StudioSlideImageFit } from "../../lib/studioProjects";
import { createStudioId } from "../../lib/studioProjects";
import { formatBnccCodes } from "../../lib/studioBriefing";
import { trimImageWhiteBorders, getCachedTrimmedImage } from "../../lib/studioReference";
import "../../styles/studio/studio-deck-preview.css";

const SLIDE_ASPECT_OPTIONS: { id: StudioSlideImageAspect; label: string; title: string }[] = [
  { id: "3:4", label: "3:4", title: "Proporção 3:4 (Vertical — Padrão)" },
  { id: "1:1", label: "1:1", title: "Proporção 1:1 (Quadrada)" },
  { id: "4:3", label: "4:3", title: "Proporção 4:3 (Horizontal Clássica)" },
  { id: "16:9", label: "16:9", title: "Proporção 16:9 (Panorâmica)" },
];

function StudioInlineTextarea({
  value,
  onChange,
  placeholder,
  className,
  title,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  title?: string;
  maxLength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      if (ref.current.innerText !== (value || "")) {
        ref.current.innerText = value || "";
      }
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      className={`studio-inline-edit ${className || ""}`}
      data-placeholder={placeholder}
      title={title}
      onInput={e => {
        const text = e.currentTarget.innerText || "";
        onChange(text.replace(/\r\n/g, "\n"));
      }}
      onPaste={e => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
    />
  );
}

export function StudioSlideFrame({
  project,
  slide,
  isEditable = false,
  onSlideChange,
  onProjectChange,
  onOpenImageEditor,
  onSlidesChange,
  onSelectSlide,
}: {
  project: StudioProject;
  slide: StudioSlide;
  isEditable?: boolean;
  onSlideChange?: (patch: Partial<StudioSlide>) => void;
  onProjectChange?: (patch: Partial<StudioProject>) => void;
  onOpenImageEditor?: () => void;
  onSlidesChange?: (slides: StudioSlide[]) => void;
  onSelectSlide?: (id: string) => void;
}) {
  const kids = project.line === "Konecta Kids";
  const corporate = project.line === "Educação Corporativa";
  const slug = kids ? "konecta-kids" : corporate ? "educacao-corporativa" : "konectar-me";
  const highlight = kids && ["gancho", "resumo", "exercicio"].includes(slide.type || "");
  const role = slide.type === "capa" ? "capa" : slide.type === "encerramento" ? "encerramento" : highlight ? "highlight" : "conteudo";
  const formula = slide.type === "formula" || slide.layout === "formula_com_espaco";
  const isTimeline = slide.layout === "linha_do_tempo" && Boolean(slide.timelineItems?.length);
  const timelineImages = isTimeline ? (slide.timelineItems || []).filter(item => Boolean(item.image?.url)) : [];
  const coverTitle = slide.title || project.title || "Tema da aula";

  // Resolução resiliente da URL da imagem (recupera do referenceImages da apostila caso url tenha sido omitida)
  let resolvedImageUrl = slide.image?.url || (isTimeline ? timelineImages[0]?.image?.url : (slide.timelineItems || []).find(item => item.image?.url)?.image?.url);
  if (!resolvedImageUrl && slide.image && slide.image.status !== "Removida" && project.referenceImages?.length) {
    const refImgs = project.referenceImages;
    const byId = slide.image.referenceId ? refImgs.find(r => r.id === slide.image?.referenceId) : undefined;
    if (byId?.url) {
      resolvedImageUrl = byId.url;
    } else {
      const usedUrls = new Set(
        (project.slides || [])
          .filter(s => s.id !== slide.id && s.image?.url)
          .map(s => s.image!.url!)
      );
      const availableRefs = refImgs.filter(r => !usedUrls.has(r.url));
      const needle = `${slide.title} ${slide.image.description || ""} ${slide.image.caption || ""}`.toLowerCase();
      const matched = availableRefs.find(r => {
        const hay = `${r.caption || ""} ${r.context || ""} ${r.label || ""}`.toLowerCase();
        const words = needle.match(/[a-zà-ú0-9]{4,}/g) || [];
        return words.some(w => hay.includes(w));
      }) || availableRefs[0] || refImgs[0];
      if (matched?.url) {
        resolvedImageUrl = matched.url;
      }
    }
  }

  // Remove automaticamente faixas brancas embutidas nas imagens extraídas de DOCX/PDF
  const [trimmedOverride, setTrimmedOverride] = useState<{ sourceUrl: string; trimmedUrl: string } | null>(null);
  const displayImageUrl =
    getCachedTrimmedImage(resolvedImageUrl) ||
    (trimmedOverride && trimmedOverride.sourceUrl === resolvedImageUrl ? trimmedOverride.trimmedUrl : undefined) ||
    resolvedImageUrl;

  useEffect(() => {
    if (!resolvedImageUrl || !resolvedImageUrl.startsWith("data:image/")) return;
    if (getCachedTrimmedImage(resolvedImageUrl)) return;
    let active = true;
    trimImageWhiteBorders(resolvedImageUrl).then(trimmed => {
      if (active && trimmed && trimmed !== resolvedImageUrl) {
        setTrimmedOverride({ sourceUrl: resolvedImageUrl, trimmedUrl: trimmed });
      }
    });
    return () => {
      active = false;
    };
  }, [resolvedImageUrl]);

  // Se for linha do tempo, usamos o layout de cards com colunas onde todas as imagens aparecem juntas!
  const withImage = !isTimeline && (
    Boolean(displayImageUrl) ||
    (["imagem_esquerda_texto_direita", "topicos_com_imagem"].includes(slide.layout || "") && (Boolean(slide.image?.description) || isEditable))
  );
  const imageIsVisible = Boolean(displayImageUrl);
  const currentAspect: StudioSlideImageAspect = slide.image?.aspectRatio || "3:4";
  const currentFit: StudioSlideImageFit = slide.image?.fit || "cover";
  const imageSource = slide.image?.source?.trim();
  const displayedImageSource = imageSource && !/\[VALIDAR FONTE\]/i.test(imageSource) ? imageSource : "Fonte não informada";
  const imagePage = slide.image?.page?.trim();
  const imageCredit = slide.image
    ? `${slide.image.caption ? `${slide.image.caption} · ` : ""}${displayedImageSource}${imagePage && !displayedImageSource.includes(`p. ${imagePage}`) ? ` · p. ${imagePage}` : ""}`
    : "";

  const [isRepositioningImage, setIsRepositioningImage] = useState(false);
  const [isPanningImage, setIsPanningImage] = useState(false);

  // Sai do modo "enquadrar" com Esc ou ao trocar de slide
  useEffect(() => {
    if (!isRepositioningImage) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" || ev.key === "Enter") setIsRepositioningImage(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRepositioningImage]);

  useEffect(() => {
    setIsRepositioningImage(false);
  }, [slide.id]);

  // Reseta o modo de reposicionamento ao trocar de slide
  useEffect(() => {
    setIsRepositioningImage(false);
    setIsPanningImage(false);
  }, [slide.id]);

  const handleSetImagePosition = (posX: number, posY: number) => {
    onSlideChange?.({
      image: {
        description: slide.image?.description || slide.title,
        source: slide.image?.source || "",
        status: slide.image?.status || "Pronta",
        ...slide.image,
        url: displayImageUrl,
        positionX: posX,
        positionY: posY,
      },
    });
  };

  const handleImagePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!isRepositioningImage) return;
    e.stopPropagation();
    e.preventDefault();
    const container = e.currentTarget.closest(".studio-preview__image-container") as HTMLElement;
    const imgEl = container?.querySelector("img") as HTMLImageElement;
    if (!container || !imgEl) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialPosX = slide.image?.positionX ?? 50;
    const initialPosY = slide.image?.positionY ?? 50;
    let latestPosX = initialPosX;
    let latestPosY = initialPosY;
    setIsPanningImage(true);

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const deltaXPercent = (dx / (rect.width || 1)) * 100;
      const deltaYPercent = (dy / (rect.height || 1)) * 100;
      const nextPosX = Math.max(0, Math.min(100, Math.round(initialPosX - deltaXPercent)));
      const nextPosY = Math.max(0, Math.min(100, Math.round(initialPosY - deltaYPercent)));
      latestPosX = nextPosX;
      latestPosY = nextPosY;
      // Atualização imediata em tempo real no DOM para resposta fluida a 60fps
      imgEl.style.objectPosition = `${nextPosX}% ${nextPosY}%`;
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        e.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setIsPanningImage(false);
      // Persiste a posição final no projeto
      handleSetImagePosition(latestPosX, latestPosY);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const nudgeBoxOffset = (box: "image" | "text", delta: number) => {
    const current = (box === "image" ? slide.imageOffsetY : slide.textOffsetY) || 0;
    const next = Math.max(-8, Math.min(18, Math.round((current + delta) * 10) / 10));
    if (box === "image") {
      onSlideChange?.({ imageOffsetY: next });
    } else {
      onSlideChange?.({ textOffsetY: next });
    }
  };

  const handleBoxPointerDown = (box: "image" | "text", e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const handleEl = e.currentTarget;
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch {}
    const slideFrame = handleEl.closest(".studio-preview__frame") as HTMLElement;
    const slideRect = slideFrame?.getBoundingClientRect();
    const startY = e.clientY;
    const initialOffset = (box === "image" ? slide.imageOffsetY : slide.textOffsetY) || 0;
    const cqwFactor = slideRect ? 100 / (slideRect.width || 1) : 0.1;

    let latestOffset = initialOffset;
    const targetEl = box === "image"
      ? (slideFrame?.querySelector(".studio-preview__image") as HTMLElement)
      : (slideFrame?.querySelector(".studio-preview__text-wrapper") as HTMLElement);

    const onPointerMove = (ev: PointerEvent) => {
      const deltaYPx = ev.clientY - startY;
      const deltaYCqw = deltaYPx * cqwFactor;
      let nextOffset = initialOffset + deltaYCqw;
      // Permite movimento vertical suave entre -8cqw e 18cqw
      nextOffset = Math.max(-8, Math.min(18, Math.round(nextOffset * 10) / 10));
      latestOffset = nextOffset;
      if (targetEl) {
        targetEl.style.transform = `translateY(${nextOffset}cqw)`;
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        handleEl.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (box === "image") {
        onSlideChange?.({ imageOffsetY: latestOffset });
      } else {
        onSlideChange?.({ textOffsetY: latestOffset });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };
  const rawTopics = slide.content.trim()
    ? slide.content
    : (slide.timelineItems?.length ? slide.timelineItems.map(m => `• ${m.label}${m.text ? `: ${m.text}` : ""}`).join("\n") : "");
  const topics = rawTopics.split("\n").map(line => line.trim()).filter(Boolean);
  const basePath = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

  // Tratamento inteligente de exercício para caber perfeitamente na área útil sem estourar
  const isExercise = slide.type === "exercicio";
  let exerciseQuestion = (slide.exerciseQuestion || "").trim();
  let exerciseOptions = slide.alternatives?.length ? [...slide.alternatives] : [];

  if (isExercise && (!exerciseQuestion || !exerciseOptions.length)) {
    const lines = (slide.content || "").split("\n").map(l => l.trim()).filter(Boolean);
    const firstOptionIdx = lines.findIndex(l => /^[A-Za-z0-9]\s*[).-]\s+/.test(l));
    if (firstOptionIdx !== -1) {
      if (!exerciseQuestion) {
        exerciseQuestion = lines.slice(0, firstOptionIdx).join(" ").trim();
      }
      if (!exerciseOptions.length) {
        let currentLabel = "";
        let currentText = "";
        for (let i = firstOptionIdx; i < lines.length; i++) {
          const match = lines[i].match(/^([A-Za-z0-9])\s*[).-]\s+(.*)$/);
          if (match) {
            if (currentLabel) {
              exerciseOptions.push({ label: currentLabel, text: currentText.trim(), correct: false });
            }
            currentLabel = match[1].toUpperCase();
            currentText = match[2];
          } else if (currentLabel) {
            currentText += " " + lines[i];
          }
        }
        if (currentLabel) {
          exerciseOptions.push({ label: currentLabel, text: currentText.trim(), correct: false });
        }
      }
    } else {
      if (!exerciseQuestion) exerciseQuestion = lines[0] || "";
      if (!exerciseOptions.length && lines.length > 1) {
        exerciseOptions = lines.slice(1).map((l, idx) => {
          const match = l.match(/^([A-Za-z0-9])\s*[).-]\s*(.*)$/);
          return match
            ? { label: match[1].toUpperCase(), text: match[2].trim(), correct: false }
            : { label: String.fromCharCode(65 + idx), text: l, correct: false };
        }).filter(opt => Boolean(opt.text));
      }
    }
  }

  // Contexto de posicionamento do slide no projeto para dar continuidade precisa
  const currentSlideIndex = project.slides ? project.slides.findIndex(s => s.id === slide.id) : -1;
  const prevSlide = currentSlideIndex > 0 ? project.slides[currentSlideIndex - 1] : null;
  const isPrevSlideExercise = prevSlide?.type === "exercicio";
  let prevLastLetterCode = 64; // Código anterior ao 'A'
  if (isPrevSlideExercise && prevSlide?.alternatives?.length) {
    const last = prevSlide.alternatives[prevSlide.alternatives.length - 1];
    if (last?.label) {
      const code = last.label.trim().toUpperCase().charCodeAt(0);
      if (!isNaN(code) && code >= 65 && code <= 90) {
        prevLastLetterCode = code;
      }
    }
  }

  const getNextAlternativeLetter = (options: typeof exerciseOptions) => {
    if (options.length > 0) {
      const last = options[options.length - 1];
      const code = last?.label ? last.label.trim().toUpperCase().charCodeAt(0) : NaN;
      if (!isNaN(code) && code >= 65 && code < 90) {
        return String.fromCharCode(code + 1);
      }
      return String.fromCharCode(65 + options.length);
    }
    if (prevLastLetterCode >= 65 && prevLastLetterCode < 90) {
      return String.fromCharCode(prevLastLetterCode + 1);
    }
    return "A";
  };

  const handleCreateContinuationSlide = (customOptions?: typeof exerciseOptions) => {
    const nextLabel = getNextAlternativeLetter(exerciseOptions);
    const baseTitle = slide.title || "Exercício";
    const continuationTitle = baseTitle.includes("Continuação")
      ? baseTitle
      : `${baseTitle} (Continuação)`;

    const newSlideId = createStudioId();
    const continuationSlide: StudioSlide = {
      id: newSlideId,
      type: "exercicio",
      layout: "exercicio",
      title: continuationTitle,
      exerciseQuestion: exerciseQuestion || slide.exerciseQuestion || "",
      content: "",
      notes: slide.notes
        ? `[Continuação do Exercício] ${slide.notes}`
        : "Apresente as alternativas complementares aos alunos e conduza para a resolução.",
      duration: 35,
      alternatives: customOptions && customOptions.length
        ? customOptions
        : [{ label: nextLabel, text: "Nova alternativa", correct: false }],
    };

    const nextSlides = [...(project.slides || [])];
    const insertIdx = currentSlideIndex >= 0 ? currentSlideIndex + 1 : nextSlides.length;

    // Garante que o slide atual preserve suas alternativas e questão salvas
    if (currentSlideIndex >= 0) {
      nextSlides[currentSlideIndex] = {
        ...nextSlides[currentSlideIndex],
        exerciseQuestion,
        alternatives: exerciseOptions,
      };
    }

    nextSlides.splice(insertIdx, 0, continuationSlide);

    onSlideChange?.({ exerciseQuestion, alternatives: exerciseOptions });
    onSlidesChange?.(nextSlides);
    onSelectSlide?.(newSlideId);
  };

  const handleAddAlternative = () => {
    // 1. Se já tem mais de 4 alternativas neste slide (ex.: 5 geradas por IA), divide o excesso para o próximo slide
    if (exerciseOptions.length > 4) {
      handleSplitExercise();
      return;
    }

    // 2. Se já tem o limite de 4 alternativas (A, B, C, D), deve ir para o próximo slide de continuação!
    if (exerciseOptions.length >= 4) {
      const nextSlide = currentSlideIndex >= 0 && currentSlideIndex < (project.slides?.length || 0) - 1
        ? project.slides[currentSlideIndex + 1]
        : null;

      // Se o próximo slide já for uma continuação de exercício
      if (nextSlide && nextSlide.type === "exercicio") {
        const nextSlideOpts = nextSlide.alternatives?.length ? [...nextSlide.alternatives] : [];
        if (nextSlideOpts.length < 4) {
          const nextLetter = getNextAlternativeLetter(nextSlideOpts);
          const updatedNextSlideOpts = [
            ...nextSlideOpts,
            { label: nextLetter, text: "Nova alternativa", correct: false }
          ];
          const nextSlides = project.slides.map(s =>
            s.id === nextSlide.id ? { ...s, alternatives: updatedNextSlideOpts } : s
          );
          onSlidesChange?.(nextSlides);
          onSelectSlide?.(nextSlide.id);
          return;
        }
      }

      // Se não há slide de continuação ainda ou ele já atingiu 4 alternativas, cria um novo
      handleCreateContinuationSlide();
      return;
    }

    // 3. Se tem menos de 4 alternativas, adiciona normalmente neste slide
    const nextLabel = getNextAlternativeLetter(exerciseOptions);
    const nextOptions = [...exerciseOptions, { label: nextLabel, text: "Nova alternativa", correct: false }];
    onSlideChange?.({ alternatives: nextOptions });
  };

  const handleSplitExercise = () => {
    if (exerciseOptions.length <= 4) return;
    const keptOptions = exerciseOptions.slice(0, 4);
    const excessOptions = exerciseOptions.slice(4);

    const baseTitle = slide.title || "Exercício";
    const continuationTitle = baseTitle.includes("Continuação")
      ? baseTitle
      : `${baseTitle} (Continuação)`;

    const newSlideId = createStudioId();
    const continuationSlide: StudioSlide = {
      id: newSlideId,
      type: "exercicio",
      layout: "exercicio",
      title: continuationTitle,
      exerciseQuestion: exerciseQuestion || slide.exerciseQuestion || "",
      content: "",
      notes: slide.notes
        ? `[Continuação do Exercício] ${slide.notes}`
        : "Apresente as alternativas complementares aos alunos e conduza para a resolução.",
      duration: 35,
      alternatives: excessOptions,
    };

    const nextSlides = [...(project.slides || [])];
    if (currentSlideIndex >= 0) {
      nextSlides[currentSlideIndex] = {
        ...project.slides[currentSlideIndex],
        exerciseQuestion,
        alternatives: keptOptions,
      };
      nextSlides.splice(currentSlideIndex + 1, 0, continuationSlide);
    } else {
      nextSlides.push(continuationSlide);
    }

    onSlideChange?.({ alternatives: keptOptions, exerciseQuestion });
    onSlidesChange?.(nextSlides);
    onSelectSlide?.(newSlideId);
  };

  // As fontes são sempre integrais e confortáveis (2.08cqw) sem redução
  const exerciseFitClass = "";

  // Tratamento inteligente de gabarito para separar resposta correta e justificativa
  let gabaritoAnswer = "";
  let gabaritoJustification = (slide.justification || "").trim();
  if (slide.type === "gabarito") {
    let correctOption = slide.alternatives?.find(option => option.correct);
    if (!correctOption && project.slides?.length) {
      for (const s of project.slides) {
        if (s.type === "exercicio" && s.alternatives?.length) {
          const found = s.alternatives.find(opt => opt.correct);
          if (found) {
            correctOption = found;
            break;
          }
        }
      }
    }
    if (correctOption) {
      gabaritoAnswer = `Resposta correta: ${correctOption.label}) ${correctOption.text || ""}`.trim();
    }
    if (!gabaritoAnswer || !gabaritoJustification) {
      const gLines = (slide.content || "").split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of gLines) {
        if (!gabaritoAnswer && /^(resposta|gabarito|alternativa\s+correta)/i.test(line)) {
          gabaritoAnswer = line;
        } else if (!gabaritoJustification && /^(justificativa|coment[aá]rio|resolu[cç][aã]o):?\s*/i.test(line)) {
          gabaritoJustification = line.replace(/^(justificativa|coment[aá]rio|resolu[cç][aã]o):?\s*/i, "");
        }
      }
      if (!gabaritoAnswer && gLines.length > 0) {
        gabaritoAnswer = gLines[0];
        if (!gabaritoJustification && gLines.length > 1) {
          gabaritoJustification = gLines.slice(1).join(" ");
        }
      } else if (!gabaritoJustification && gLines.length > 1) {
        gabaritoJustification = gLines.filter(l => l !== gabaritoAnswer).join(" ");
      }
    }
  }
  const gabaritoFitClass = (gabaritoAnswer.length + gabaritoJustification.length) > 340 ? "studio-preview__gabarito--dense" : "";

  // Parágrafos para texto corrido mantendo tamanho integral de fonte
  const paragraphs = (slide.content || "").split("\n").map(p => p.trim()).filter(Boolean);

  return (
    <div
      className={`studio-preview__frame ${kids ? "studio-preview--kids" : corporate ? "studio-preview--corporate" : "studio-preview--konectar"} ${highlight ? "studio-preview--highlight" : ""}`}
      style={{ backgroundImage: `url(${basePath}/templates/${slug}-${role}.png)` }}
    >
      {slide.type === "capa" ? (
        <div className={`studio-preview__cover ${kids ? "studio-preview__cover--kids" : corporate ? "studio-preview__cover--corporate" : "studio-preview__cover--konectar"}`}>
          {!kids && !corporate && <strong>Tema da aula:</strong>}
          {isEditable ? (
            <StudioInlineTextarea
              className="studio-inline-edit--cover-title"
              value={kids ? (project.teacher || "") : (slide.title ?? project.title ?? "")}
              placeholder={kids ? "Nome do(a) Professor(a)..." : "Tema da aula na capa..."}
              title="Clique para editar o tema da aula"
              onChange={val => {
                if (kids) {
                  onProjectChange?.({ teacher: val });
                } else {
                  onSlideChange?.({ title: val });
                  onProjectChange?.({ title: val });
                }
              }}
            />
          ) : (
            <p>{kids ? project.teacher : coverTitle}</p>
          )}

          {!kids && !corporate && <strong>Disciplina:</strong>}
          {isEditable ? (
            <StudioInlineTextarea
              className="studio-inline-edit--cover-subtitle"
              value={kids ? (slide.title ?? project.title ?? "") : corporate ? (project.subtitle || "") : (project.subject || "")}
              placeholder={kids ? "Tema da aula..." : corporate ? "Subtítulo corporativo..." : "Disciplina (ex: História)..."}
              title="Clique para editar a disciplina"
              onChange={val => {
                if (kids) {
                  onSlideChange?.({ title: val });
                  onProjectChange?.({ title: val });
                } else if (corporate) {
                  onProjectChange?.({ subtitle: val });
                } else {
                  onProjectChange?.({ subject: val });
                }
              }}
            />
          ) : (
            <p>{kids ? coverTitle : corporate ? project.subtitle : project.subject}</p>
          )}
        </div>
      ) : slide.type !== "encerramento" && (
        <div className={`studio-preview__body ${slide.type === "objetivo_bncc" ? "studio-preview__body--objective" : ""}`}>
          {slide.type === "objetivo_bncc" ? (
            <>
              <h4>OBJETIVO</h4>
              {isEditable ? (
                <StudioInlineTextarea
                  className="studio-inline-edit--objective"
                  value={slide.objective ?? project.objective ?? ""}
                  placeholder="Descreva o objetivo de aprendizagem..."
                  rows={2}
                  title="Clique para editar o objetivo de aprendizagem"
                  onChange={val => {
                    onSlideChange?.({ objective: val });
                    onProjectChange?.({ objective: val });
                  }}
                />
              ) : (
                <p>{slide.objective || project.objective}</p>
              )}

              <h4>HABILIDADES BNCC</h4>
              {isEditable ? (
                <StudioInlineTextarea
                  className="studio-inline-edit--bncc"
                  value={slide.curriculum ?? project.curriculum ?? (slide.skills?.join(", ") || "")}
                  placeholder="Códigos BNCC separados por vírgula (ex.: EF06MA18, EF06MA19)..."
                  rows={2}
                  title="Clique para editar as habilidades BNCC"
                  onChange={val => {
                    const formatted = formatBnccCodes(val);
                    const skills = formatted.split(",").map(s => s.trim()).filter(Boolean);
                    onSlideChange?.({ curriculum: formatted, skills });
                    onProjectChange?.({ curriculum: formatted });
                  }}
                />
              ) : (
                <ul>
                  {(slide.skills?.length ? slide.skills : [slide.curriculum || project.curriculum || "A validar pelo professor"]).map((skill, index) => (
                    <li key={index}>{skill}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h4>
                {isEditable ? (
                  <StudioInlineTextarea
                    className="studio-inline-edit--title"
                    value={slide.title}
                    placeholder="Título do slide..."
                    rows={1}
                    title="Clique para editar o título do slide"
                    onChange={val => onSlideChange?.({ title: val })}
                  />
                ) : (
                  slide.title
                )}
              </h4>
              {isEditable && !withImage && !["capa", "encerramento", "objetivo_bncc"].includes(slide.type || "") && (
                <button
                  type="button"
                  className="studio-preview__badge-insert-btn"
                  onClick={() => {
                    const nextLayout = slide.layout === "topicos" ? "topicos_com_imagem" : "imagem_esquerda_texto_direita";
                    onSlideChange?.({ layout: nextLayout });
                    onOpenImageEditor?.();
                  }}
                  title="Inserir imagem neste slide (Gere com IA, envie arquivo ou escolha do material)"
                >
                  🖼️ + Inserir imagem
                </button>
              )}
              {(slide.highlight || (isEditable && slide.type === "gancho")) && (
                isEditable ? (
                  <input
                    className="studio-inline-edit studio-inline-edit--highlight"
                    value={slide.highlight || ""}
                    placeholder="Destaque da frase (opcional)..."
                    title="Clique para editar o destaque"
                    onChange={e => onSlideChange?.({ highlight: e.target.value })}
                  />
                ) : (
                  <strong className="studio-preview__highlight">{slide.highlight}</strong>
                )
              )}
              <div
                className={`studio-preview__content-wrap ${withImage ? "studio-preview__with-image" : ""}`}
                data-aspect={withImage ? currentAspect : undefined}
              >
                {withImage && (
                  <div
                    className={`studio-preview__image ${isEditable ? "studio-preview__image--editable" : ""}`}
                    data-aspect={currentAspect}
                    data-fit={currentFit}
                    style={{
                      transform: slide.imageOffsetY ? `translateY(${slide.imageOffsetY}cqw)` : undefined,
                    }}
                    onClick={() => {
                      if (isEditable && !isRepositioningImage && onOpenImageEditor) {
                        onOpenImageEditor();
                      }
                    }}
                    title={isEditable && !isRepositioningImage ? "Clique para gerenciar, gerar com IA ou trocar a imagem" : undefined}
                  >
                    {timelineImages.length > 1 ? (
                      <div className={`studio-preview__image-grid studio-preview__image-grid--${Math.min(4, timelineImages.length)}`}>
                        {timelineImages.slice(0, 4).map((imgItem, idx) => (
                          <div key={idx} className="studio-preview__image-grid-item">
                            <span className="studio-preview__image-grid-tag">{imgItem.label}</span>
                            <img
                              src={imgItem.image!.url}
                              alt={imgItem.image!.description || imgItem.label}
                              draggable={false}
                              onDragStart={e => e.preventDefault()}
                            />
                          </div>
                        ))}
                      </div>
                    ) : imageIsVisible ? (
                      <div
                        className={`studio-preview__image-container studio-preview__image-container--aspect-${currentAspect.replace(":", "-")} studio-preview__image-container--fit-${currentFit} ${isRepositioningImage ? "is-repositioning" : ""}`}
                        data-aspect={currentAspect}
                        data-fit={currentFit}
                        onPointerDown={isRepositioningImage ? handleImagePointerDown : undefined}
                        style={{
                          cursor: isRepositioningImage ? (isPanningImage ? "grabbing" : "grab") : undefined,
                          touchAction: isRepositioningImage ? "none" : undefined,
                          userSelect: "none",
                        }}
                      >
                        {isRepositioningImage && <div className="studio-preview__reposition-grid" aria-hidden="true" />}
                        <img
                          src={displayImageUrl}
                          alt={slide.image?.description || timelineImages[0]?.image?.description || slide.title}
                          draggable={false}
                          onDragStart={e => e.preventDefault()}
                          style={{
                            objectPosition: `${slide.image?.positionX ?? 50}% ${slide.image?.positionY ?? 50}%`,
                            cursor: isRepositioningImage ? (isPanningImage ? "grabbing" : "grab") : undefined,
                            userSelect: "none",
                            touchAction: isRepositioningImage ? "none" : undefined,
                          }}
                        />
                      </div>
                    ) : isEditable ? (
                      <div className="studio-preview__image-pending studio-preview__image-pending--clickable">
                        <span className="studio-preview__image-pending-icon">🖼️</span>
                        <strong>[CLIQUE PARA INSERIR / GERAR IMAGEM]</strong>
                        <p>{slide.image?.description || "Adicione uma ilustração gerada por IA, foto ou imagem da apostila"}</p>
                        <div className="studio-preview__placeholder-actions">
                          <button
                            type="button"
                            className="studio-preview__placeholder-btn"
                            onClick={e => {
                              e.stopPropagation();
                              onOpenImageEditor?.();
                            }}
                          >
                            Abrir opções de imagem
                          </button>
                          <button
                            type="button"
                            className="studio-preview__placeholder-btn studio-preview__placeholder-btn--quiet"
                            title="Remover espaço de imagem e deixar somente texto"
                            onClick={e => {
                              e.stopPropagation();
                              onSlideChange?.({
                                layout: "so_texto",
                                image: slide.image ? { ...slide.image, status: "Removida", url: undefined } : undefined,
                              });
                            }}
                          >
                            Somente texto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="studio-preview__image-pending">
                        <span className="studio-preview__image-pending-icon">🖼️</span>
                        <p>{slide.image?.description || "Espaço reservado para ilustração"}</p>
                      </div>
                    )}
                    <small>
                      {timelineImages.length > 1
                        ? `Imagens dos marcos históricos (${timelineImages.map(t => t.label).join(", ")})`
                        : imageCredit || timelineImages[0]?.image?.source || ""}
                    </small>
                  </div>
                )}
                <div
                  className="studio-preview__text-wrapper"
                  style={{
                    transform: slide.textOffsetY ? `translateY(${slide.textOffsetY}cqw)` : undefined,
                  }}
                >
                  {slide.type === "exercicio" ? (
                  <div className={`studio-preview__exercise ${exerciseFitClass}`}>
                    {isEditable ? (
                      <StudioInlineTextarea
                        className="studio-inline-edit--exercise-question"
                        value={exerciseQuestion}
                        rows={2}
                        placeholder="Digite o enunciado da questão..."
                        title="Clique para editar o enunciado"
                        onChange={val => onSlideChange?.({ exerciseQuestion: val })}
                      />
                    ) : (
                      <p className="studio-preview__question">{exerciseQuestion || "Questão de fixação"}</p>
                    )}
                    {exerciseOptions.map(option => (
                      <p key={option.label} className="studio-preview__option studio-preview__option--editable-row">
                        {isEditable ? (
                          <>
                            <button
                              type="button"
                              className={`studio-preview__option-correct-badge ${option.correct ? "is-correct" : ""}`}
                              title={option.correct ? "Alternativa correta (clique para alternar)" : "Marcar como correta"}
                              onClick={() => {
                                const nextOptions = exerciseOptions.map(o => ({
                                  ...o,
                                  correct: o.label === option.label ? !o.correct : false,
                                }));
                                onSlideChange?.({ alternatives: nextOptions });
                              }}
                            >
                              {option.label})
                            </button>
                            <StudioInlineTextarea
                              className="studio-inline-edit--option-text"
                              value={option.text}
                              rows={1}
                              placeholder={`Texto da alternativa ${option.label}...`}
                              onChange={val => {
                                const nextOptions = exerciseOptions.map(o =>
                                  o.label === option.label ? { ...o, text: val } : o
                                );
                                onSlideChange?.({ alternatives: nextOptions });
                              }}
                            />
                            <button
                              type="button"
                              className="studio-preview__remove-topic-btn"
                              title="Remover alternativa"
                              onClick={() => {
                                const nextOptions = exerciseOptions.filter(o => o.label !== option.label);
                                onSlideChange?.({ alternatives: nextOptions });
                              }}
                            >
                              &times;
                            </button>
                          </>
                        ) : (
                          <>
                            <strong>{option.label})</strong> {option.text}
                          </>
                        )}
                      </p>
                    ))}
                    {isEditable && (
                      <div className="studio-preview__exercise-actions">
                        {exerciseOptions.length < 4 ? (
                          <button
                            type="button"
                            className="studio-preview__add-topic-btn"
                            onClick={handleAddAlternative}
                          >
                            + Adicionar alternativa
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="studio-preview__add-topic-btn studio-preview__add-topic-btn--continuation"
                            title="Limite ideal de 4 alternativas por slide. Clique para criar/ir para o próximo slide com a próxima alternativa."
                            onClick={handleAddAlternative}
                          >
                            + Adicionar alternativa (ir para o próximo slide)
                          </button>
                        )}

                        {exerciseOptions.length > 4 && (
                          <button
                            type="button"
                            className="studio-preview__split-exercise-btn"
                            title="Divide este slide mantendo a fonte padrão (2.08cqw): 4 alternativas aqui e as excedentes no próximo slide de continuação."
                            onClick={handleSplitExercise}
                          >
                            ⚡ Dividir em novo slide ({exerciseOptions[4]?.label} a {exerciseOptions[exerciseOptions.length - 1]?.label})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : slide.type === "gabarito" ? (
                  <div className={`studio-preview__gabarito ${gabaritoFitClass}`}>
                    {isEditable ? (
                      <div className="studio-preview__gabarito-editable">
                        <label className="studio-preview__gabarito-tag">RESPOSTA CORRETA</label>
                        <StudioInlineTextarea
                          className="studio-inline-edit--gabarito-ans"
                          value={gabaritoAnswer}
                          rows={1}
                          placeholder="Ex.: Resposta correta: Alternativa B"
                          onChange={val => {
                            onSlideChange?.({ content: `${val}\nJustificativa: ${gabaritoJustification}` });
                          }}
                        />
                        <label className="studio-preview__gabarito-tag">JUSTIFICATIVA / RESOLUÇÃO</label>
                        <StudioInlineTextarea
                          className="studio-inline-edit--gabarito-just"
                          value={gabaritoJustification}
                          rows={3}
                          placeholder="Explicação pedagógica da resolução..."
                          onChange={val => {
                            onSlideChange?.({ justification: val, content: `${gabaritoAnswer}\nJustificativa: ${val}` });
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="studio-preview__gabarito-ans">
                          {gabaritoAnswer || "Resposta comentada"}
                        </p>
                        {gabaritoJustification && (
                          <p className="studio-preview__gabarito-just">{gabaritoJustification}</p>
                        )}
                      </>
                    )}
                  </div>
                ) : slide.columns?.length ? (
                  <div className="studio-preview__columns">
                    {slide.columns.map((column, colIdx) => (
                      <section key={colIdx}>
                        {isEditable ? (
                          <input
                            className="studio-inline-edit studio-inline-edit--column-title"
                            value={column.title}
                            placeholder="Título da coluna..."
                            onChange={e => {
                              const nextCols = [...slide.columns!];
                              nextCols[colIdx] = { ...nextCols[colIdx], title: e.target.value };
                              onSlideChange?.({ columns: nextCols });
                            }}
                          />
                        ) : (
                          <strong>{column.title}</strong>
                        )}
                        {column.items.map((item, itemIdx) => (
                          isEditable ? (
                            <StudioInlineTextarea
                              key={itemIdx}
                              className="studio-inline-edit--column-item"
                              value={item}
                              rows={1}
                              onChange={val => {
                                const nextCols = [...slide.columns!];
                                const nextItems = [...nextCols[colIdx].items];
                                nextItems[itemIdx] = val;
                                nextCols[colIdx] = { ...nextCols[colIdx], items: nextItems };
                                onSlideChange?.({ columns: nextCols });
                              }}
                            />
                          ) : (
                            <p key={itemIdx}>{item}</p>
                          )
                        ))}
                        {isEditable && (
                          <button
                            type="button"
                            className="studio-preview__add-topic-btn"
                            onClick={() => {
                              const nextCols = [...slide.columns!];
                              nextCols[colIdx] = { ...nextCols[colIdx], items: [...nextCols[colIdx].items, "Novo item"] };
                              onSlideChange?.({ columns: nextCols });
                            }}
                          >
                            + Item
                          </button>
                        )}
                      </section>
                    ))}
                  </div>
                ) : isTimeline ? (
                  <ol className="studio-preview__timeline">
                    {slide.timelineItems!.map((item, index) => {
                      const cardImgUrl = item.image?.url || (index === 0 ? slide.image?.url : undefined);
                      const cardImgDesc = item.image?.description || (index === 0 ? slide.image?.description : undefined) || item.text || item.label;
                      const cardImgSource = item.image?.source || (index === 0 ? slide.image?.source : undefined);
                      return (
                        <li key={`${item.label}-${index}`}>
                          <div className="studio-preview__timeline-header">
                            {isEditable ? (
                              <>
                                <input
                                  className="studio-inline-edit studio-inline-edit--timeline-label"
                                  value={item.label}
                                  placeholder="Rótulo (ex: 1822)"
                                  onChange={e => {
                                    const nextItems = [...slide.timelineItems!];
                                    nextItems[index] = { ...nextItems[index], label: e.target.value };
                                    onSlideChange?.({ timelineItems: nextItems });
                                  }}
                                />
                                <StudioInlineTextarea
                                  className="studio-inline-edit--timeline-text"
                                  value={item.text || ""}
                                  placeholder="Descrição do marco..."
                                  rows={1}
                                  onChange={val => {
                                    const nextItems = [...slide.timelineItems!];
                                    nextItems[index] = { ...nextItems[index], text: val };
                                    onSlideChange?.({ timelineItems: nextItems });
                                  }}
                                />
                              </>
                            ) : (
                              <>
                                <strong>{item.label}</strong>
                                {item.text && <span>{item.text}</span>}
                              </>
                            )}
                          </div>
                          {cardImgUrl ? (
                            <div
                              className="studio-preview__timeline-card-image"
                              onClick={() => {
                                if (isEditable && onOpenImageEditor) {
                                  onOpenImageEditor();
                                }
                              }}
                            >
                              <img src={cardImgUrl} alt={cardImgDesc} />
                              {cardImgSource && <small>{cardImgSource}</small>}
                            </div>
                          ) : (
                            <div
                              className="studio-preview__timeline-card-pending"
                              onClick={() => {
                                if (isEditable && onOpenImageEditor) {
                                  onOpenImageEditor();
                                }
                              }}
                            >
                              <span>Imagem {item.label}</span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                ) : ["topicos_com_barras", "caixas_contorno", "topicos", "topicos_com_imagem", "mapa_resumo", "processo", "linha_do_tempo", "imagem_esquerda_texto_direita"].includes(slide.layout || "") ? (
                  <div className={`studio-preview__topics studio-preview__topics--${slide.layout}`}>
                    {topics.map((line, index) => (
                      <p key={index} className="studio-preview__topic-row">
                        {isEditable ? (
                          <>
                            <StudioInlineTextarea
                              className="studio-inline-edit--topic"
                              value={line}
                              rows={1}
                              placeholder="Digite o tópico..."
                              onChange={val => {
                                const nextTopics = [...topics];
                                nextTopics[index] = val;
                                onSlideChange?.({ content: nextTopics.join("\n") });
                              }}
                            />
                            <button
                              type="button"
                              className="studio-preview__remove-topic-btn"
                              title="Remover este tópico"
                              onClick={() => {
                                const nextTopics = topics.filter((_, idx) => idx !== index);
                                onSlideChange?.({ content: nextTopics.join("\n") });
                              }}
                            >
                              &times;
                            </button>
                          </>
                        ) : (
                          line
                        )}
                      </p>
                    ))}
                    {isEditable && (
                      <div className="studio-preview__topics-actions">
                        <button
                          type="button"
                          className="studio-preview__add-topic-btn"
                          onClick={() => {
                            const nextTopics = [...topics, "Novo conceito"];
                            onSlideChange?.({ content: nextTopics.join("\n") });
                          }}
                        >
                          + Adicionar tópico
                        </button>
                        {!withImage && !["capa", "encerramento"].includes(slide.type || "") && (
                          <button
                            type="button"
                            className="studio-preview__add-topic-btn studio-preview__add-image-topic-btn"
                            onClick={() => {
                              onSlideChange?.({ layout: "topicos_com_imagem" });
                              onOpenImageEditor?.();
                            }}
                            title="Inserir imagem neste slide (IA, upload de arquivo ou do material didático)"
                          >
                            🖼️ + Inserir imagem
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : formula ? (
                  <div className="studio-preview__formula-wrap">
                    {isEditable ? (
                      <StudioInlineTextarea
                        className="studio-inline-edit--formula"
                        value={slide.formula || slide.content}
                        rows={1}
                        placeholder="Digite a fórmula em destaque..."
                        onChange={val => onSlideChange?.({ formula: val, content: val })}
                      />
                    ) : (
                      <p className="studio-preview__formula">
                        {slide.formula || slide.content}
                      </p>
                    )}
                    <div className="studio-preview__formula-space">
                      <span>Espaço para desenvolvimento</span>
                    </div>
                  </div>
                ) : (
                  <div className="studio-preview__text">
                    {isEditable ? (
                      <>
                        <StudioInlineTextarea
                          className="studio-inline-edit--body"
                          value={slide.content}
                          rows={Math.max(4, (slide.content || "").split("\n").length + 1)}
                          placeholder="Digite o conteúdo do slide (frases curtas, um conceito por slide)..."
                          title="Clique para editar o texto do slide"
                          onChange={val => onSlideChange?.({ content: val })}
                        />
                        {!withImage && !["capa", "encerramento"].includes(slide.type || "") && (
                          <div className="studio-preview__text-actions">
                            <button
                              type="button"
                              className="studio-preview__add-topic-btn studio-preview__add-image-topic-btn"
                              onClick={() => {
                                onSlideChange?.({ layout: "imagem_esquerda_texto_direita" });
                                onOpenImageEditor?.();
                              }}
                              title="Inserir imagem neste slide (IA, upload de arquivo ou do material didático)"
                            >
                              🖼️ + Inserir imagem
                            </button>
                          </div>
                        )}
                      </>
                    ) : paragraphs.length > 0 ? (
                      paragraphs.map((p, index) => <p key={index}>{p}</p>)
                    ) : (
                      <p>{slide.content}</p>
                    )}
                  </div>
                )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {isEditable && !["capa", "encerramento"].includes(slide.type || "") && (
        <div
          className={`studio-preview__dock-container ${withImage ? "studio-preview__dock-container--split" : "studio-preview__dock-container--single"}`}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {/* Barra de Edição da Imagem (Separada) */}
          {(withImage || !["objetivo_bncc"].includes(slide.type || "")) && (
            <div className="studio-preview__dock-slot studio-preview__dock-slot--image">
              <div
                className={`studio-floatbar studio-floatbar--image ${isRepositioningImage ? "is-pinned" : ""}`}
                role="toolbar"
                aria-label="Ferramentas da imagem"
              >
                {isRepositioningImage ? (
                  <>
                    <span className="studio-floatbar__hint">
                      <Move size={14} /> Arraste a foto para enquadrar
                    </span>
                    <span className="studio-floatbar__divider" />
                    <button type="button" className="studio-floatbar__btn" data-tip="Alinhar ao topo" onClick={() => handleSetImagePosition(50, 0)}>
                      <ArrowUpToLine size={15} /> Topo
                    </button>
                    <button type="button" className="studio-floatbar__btn" data-tip="Centralizar" onClick={() => handleSetImagePosition(50, 50)}>
                      <Crosshair size={15} /> Centro
                    </button>
                    <button type="button" className="studio-floatbar__btn" data-tip="Alinhar à base" onClick={() => handleSetImagePosition(50, 100)}>
                      <ArrowDownToLine size={15} /> Base
                    </button>
                    <span className="studio-floatbar__divider" />
                    <button type="button" className="studio-floatbar__btn studio-floatbar__btn--success" onClick={() => setIsRepositioningImage(false)}>
                      <Check size={15} /> Concluir
                    </button>
                  </>
                ) : withImage ? (
                  <>
                    <span
                      className="studio-floatbar__grip"
                      data-tip="Arraste para mover a imagem verticalmente"
                      onPointerDown={e => handleBoxPointerDown("image", e)}
                    >
                      <GripVertical size={14} />
                      <ImageIcon size={13} />
                    </span>
                    <button type="button" className="studio-floatbar__btn" data-tip="Subir imagem" onClick={() => nudgeBoxOffset("image", -1.5)}>
                      <ChevronUp size={15} />
                    </button>
                    <button type="button" className="studio-floatbar__btn" data-tip="Descer imagem" onClick={() => nudgeBoxOffset("image", 1.5)}>
                      <ChevronDown size={15} />
                    </button>
                    {Boolean(slide.imageOffsetY) && (
                      <button type="button" className="studio-floatbar__btn" data-tip="Voltar imagem ao topo" onClick={() => onSlideChange?.({ imageOffsetY: 0 })}>
                        <RotateCcw size={13} />
                      </button>
                    )}

                    {imageIsVisible && timelineImages.length <= 1 && (
                      <>
                        <span className="studio-floatbar__divider" />
                        <div className="studio-floatbar__segment" role="group" aria-label="Proporção da imagem">
                          {SLIDE_ASPECT_OPTIONS.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              className={`studio-floatbar__seg-btn ${currentAspect === opt.id ? "is-active" : ""}`}
                              data-tip={`Proporção ${opt.label} (${opt.title})`}
                              onClick={() => onSlideChange?.({
                                image: {
                                  description: slide.image?.description || slide.title,
                                  source: slide.image?.source || "",
                                  status: slide.image?.status || "Pronta",
                                  ...slide.image,
                                  url: displayImageUrl,
                                  aspectRatio: opt.id,
                                },
                              })}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={`studio-floatbar__btn ${currentFit === "contain" ? "is-active" : ""}`}
                          data-tip={currentFit === "cover" ? "Mostrar inteira (contain)" : "Preencher quadro (cover)"}
                          onClick={() => {
                            const nextFit: StudioSlideImageFit = currentFit === "cover" ? "contain" : "cover";
                            onSlideChange?.({
                              image: {
                                description: slide.image?.description || slide.title,
                                source: slide.image?.source || "",
                                status: slide.image?.status || "Pronta",
                                ...slide.image,
                                url: displayImageUrl,
                                fit: nextFit,
                              },
                            });
                          }}
                        >
                          {currentFit === "contain" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button
                          type="button"
                          className="studio-floatbar__btn"
                          data-tip="Enquadrar foto (arrastar dentro do quadro)"
                          onClick={() => {
                            setIsRepositioningImage(true);
                            if (currentFit === "contain") {
                              onSlideChange?.({
                                image: {
                                  description: slide.image?.description || slide.title,
                                  source: slide.image?.source || "",
                                  status: slide.image?.status || "Pronta",
                                  ...slide.image,
                                  url: displayImageUrl,
                                  fit: "cover",
                                },
                              });
                            }
                          }}
                        >
                          <Move size={14} /> Enquadrar
                        </button>
                      </>
                    )}

                    <span className="studio-floatbar__divider" />
                    <button
                      type="button"
                      className="studio-floatbar__btn studio-floatbar__btn--primary"
                      data-tip="Trocar, gerar com IA ou enviar imagem"
                      onClick={() => onOpenImageEditor?.()}
                    >
                      <ImageIcon size={14} /> Trocar
                    </button>

                    {imageIsVisible && timelineImages.length <= 1 && (
                      <button
                        type="button"
                        className="studio-floatbar__btn studio-floatbar__btn--danger"
                        data-tip="Remover imagem do slide"
                        onClick={() => {
                          const nextLayout = slide.layout === "topicos_com_imagem" ? "topicos" : slide.layout === "imagem_esquerda_texto_direita" ? "so_texto" : slide.layout;
                          onSlideChange?.({
                            image: {
                              description: slide.image?.description || slide.title,
                              source: slide.image?.source || "",
                              status: "Removida",
                              url: undefined,
                            },
                            layout: nextLayout,
                          });
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="studio-floatbar__btn studio-floatbar__btn--primary"
                    data-tip="Inserir imagem neste slide"
                    onClick={() => {
                      const nextLayout = slide.layout === "topicos" ? "topicos_com_imagem" : "imagem_esquerda_texto_direita";
                      onSlideChange?.({ layout: nextLayout });
                      onOpenImageEditor?.();
                    }}
                  >
                    <ImageIcon size={14} /> + Inserir imagem
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Barra de Edição do Texto (Separada) */}
          {!isTimeline && !slide.columns?.length && slide.type !== "exercicio" && slide.type !== "gabarito" && !isRepositioningImage && (
            <div className="studio-preview__dock-slot studio-preview__dock-slot--text">
              <div
                className="studio-floatbar studio-floatbar--text"
                role="toolbar"
                aria-label="Ferramentas da caixa de texto"
              >
                <span
                  className="studio-floatbar__grip"
                  data-tip="Arraste para mover o texto verticalmente"
                  onPointerDown={e => handleBoxPointerDown("text", e)}
                >
                  <GripVertical size={14} />
                  <Type size={13} />
                </span>
                <span className="studio-floatbar__label">Texto</span>
                <button type="button" className="studio-floatbar__btn" data-tip="Subir texto" onClick={() => nudgeBoxOffset("text", -1.5)}>
                  <ChevronUp size={15} />
                </button>
                <button type="button" className="studio-floatbar__btn" data-tip="Descer texto" onClick={() => nudgeBoxOffset("text", 1.5)}>
                  <ChevronDown size={15} />
                </button>
                {Boolean(slide.textOffsetY) && (
                  <button type="button" className="studio-floatbar__btn" data-tip="Voltar texto ao topo" onClick={() => onSlideChange?.({ textOffsetY: 0 })}>
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StudioSlidePreview({ project, slide }: { project: StudioProject; slide: StudioSlide }) {
  return (
    <details className="studio-preview">
      <summary>Prévia do conteúdo</summary>
      <StudioSlideFrame project={project} slide={slide} />
      <p className="studio-editor__hint">
        Prévia para revisão. Confira a diagramação final no PowerPoint e as fontes das imagens antes de exportar.
      </p>
    </details>
  );
}

