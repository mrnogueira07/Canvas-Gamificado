import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  Check,
  Clipboard,
  Film,
  FlaskConical,
  FolderUp,
  Image as ImageIcon,
  ImagePlus,
  Images,
  Info,
  Landmark,
  LoaderCircle,
  Maximize2,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  Wand2,
  ZoomIn,
} from "lucide-react";
import type {
  MagnificCreativity,
  MagnificEngine,
  MagnificHdr,
  MagnificLighting,
  StudioImageAspectRatio,
} from "../../lib/studioImages";
import {
  enhancePromptWithMagnific,
  generateStudioImage,
  uploadStudioImage,
} from "../../lib/studioImages";
import type { StudioProject, StudioSlide } from "../../lib/studioProjects";

const MAGNIFIC_ENGINES: {
  id: MagnificEngine;
  icon: typeof Camera;
  title: string;
  desc: string;
}[] = [
  { id: "photographic", icon: Camera, title: "Foto / Realismo", desc: "Fotografia documental de alta resolução (85mm)" },
  { id: "cinematic", icon: Film, title: "Cinematográfico", desc: "Cena épica de cinema com iluminação dramática" },
  { id: "painting", icon: Landmark, title: "Pintura Histórica", desc: "Pintura clássica a óleo com textura de tela" },
  { id: "illustration", icon: Palette, title: "Ilustração 3D", desc: "Traço didático, visual limpo e moderno" },
  { id: "science", icon: FlaskConical, title: "Científico & Macro", desc: "Precisão anatômica, botânica e cortes macro" },
];

const CREATIVITY_OPTIONS: { id: MagnificCreativity; label: string; desc: string }[] = [
  { id: "low", label: "Fidelidade", desc: "Estrita aos fatos" },
  { id: "medium", label: "Equilibrada", desc: "Padrão de realismo" },
  { id: "high", label: "Ultra Cênica", desc: "Riqueza atmosférica" },
];

const HDR_OPTIONS: { id: MagnificHdr; label: string; desc: string }[] = [
  { id: "soft", label: "Filme Suave", desc: "Grão orgânico" },
  { id: "standard", label: "Nítido HD", desc: "Alto contraste" },
  { id: "ultra", label: "Ultra 8K", desc: "Micro-texturas táteis" },
];

const LIGHTING_OPTIONS: { id: MagnificLighting; label: string; icon: string }[] = [
  { id: "natural", label: "Natural (Golden)", icon: "☀️" },
  { id: "studio", label: "Estúdio", icon: "💡" },
  { id: "dramatic", label: "Dramática", icon: "⚡" },
  { id: "museum", label: "Museu & Galeria", icon: "🏛️" },
  { id: "night", label: "Noturna", icon: "🌙" },
];

const RATIO_OPTIONS: { id: StudioImageAspectRatio; label: string; ratioTag: string; desc: string; isOfficial?: boolean }[] = [
  { id: "3:4", label: "Vertical", ratioTag: "3:4", desc: "Preenche a margem vertical (padrão)", isOfficial: true },
  { id: "1:1", label: "Quadrada", ratioTag: "1:1", desc: "Formato quadrado 1:1" },
  { id: "4:3", label: "Clássica", ratioTag: "4:3", desc: "Formato clássico 4:3" },
  { id: "16:9", label: "Panorâmica", ratioTag: "16:9", desc: "Widescreen horizontal 16:9" },
];

export function StudioImageEditor({
  project,
  slide,
  userId,
  onChange,
  onProjectChange,
  onClose,
}: {
  project: StudioProject;
  slide: StudioSlide;
  userId: string;
  onChange: (patch: Partial<StudioSlide>) => void;
  onProjectChange?: (patch: Partial<StudioProject>) => void;
  onClose?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"generate" | "upscale" | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const referenceImages = project.referenceImages || [];

  const timelineItems = slide.timelineItems || [];
  const hasTimeline = timelineItems.length > 0;

  // Seleção de marco individual da linha do tempo
  const [activeMilestoneIdx, setActiveMilestoneIdx] = useState<number | null>(null);

  // Tabs: ia, material, upload
  const [activeTab, setActiveTab] = useState<"ia" | "material" | "upload">("ia");

  // Ferramentas e parâmetros da IA
  const [selectedEngine, setSelectedEngine] = useState<MagnificEngine>("photographic");
  const [selectedCreativity, setSelectedCreativity] = useState<MagnificCreativity>("medium");
  const [selectedHdr, setSelectedHdr] = useState<MagnificHdr>("standard");
  const [selectedLighting, setSelectedLighting] = useState<MagnificLighting>("natural");
  const [selectedRatio, setSelectedRatio] = useState<StudioImageAspectRatio>(
    () => (slide.image?.aspectRatio as StudioImageAspectRatio) || "3:4"
  );

  // Magic Prompt state
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);

  const selectedMilestone = activeMilestoneIdx !== null && timelineItems[activeMilestoneIdx]
    ? timelineItems[activeMilestoneIdx]
    : null;

  const activeImage: {
    url?: string;
    description?: string;
    source?: string;
    status?: string;
    aspectRatio?: StudioImageAspectRatio;
    fit?: "cover" | "contain";
  } = selectedMilestone?.image || slide.image || { description: "", source: "", status: "" };

  const isTimeline = slide.layout === "linha_do_tempo" || hasTimeline;

  const handleApplyImage = useCallback((newImage: {
    url?: string;
    description?: string;
    source?: string;
    status?: string;
    aspectRatio?: StudioImageAspectRatio;
    fit?: "cover" | "contain";
  }) => {
    const items = slide.timelineItems || [];
    const effectiveLayout = isTimeline
      ? "linha_do_tempo"
      : (newImage.url || slide.image?.description)
        ? (slide.layout === "topicos" ? "topicos_com_imagem" : (slide.layout && slide.layout !== "so_texto" ? slide.layout : "imagem_esquerda_texto_direita"))
        : (slide.layout === "topicos_com_imagem" ? "topicos" : slide.layout === "imagem_esquerda_texto_direita" ? "so_texto" : (slide.layout || "so_texto"));

    if (activeMilestoneIdx !== null && items[activeMilestoneIdx]) {
      const nextItems = [...items];
      nextItems[activeMilestoneIdx] = {
        ...nextItems[activeMilestoneIdx],
        image: newImage.url ? {
          url: newImage.url,
          description: newImage.description || nextItems[activeMilestoneIdx].text || nextItems[activeMilestoneIdx].label,
          source: newImage.source || "",
          aspectRatio: newImage.aspectRatio || selectedRatio,
          fit: newImage.fit || slide.image?.fit || "cover",
        } : undefined,
      };
      onChange({
        timelineItems: nextItems,
        layout: effectiveLayout,
        pending: slide.pending?.filter(item => !/imagem|crédito/i.test(item)),
      });
    } else {
      const nextItems = [...items];
      if (nextItems.length > 0 && newImage.url) {
        nextItems[0] = {
          ...nextItems[0],
          image: {
            url: newImage.url,
            description: newImage.description || nextItems[0].text || nextItems[0].label,
            source: newImage.source || "",
            aspectRatio: newImage.aspectRatio || selectedRatio,
            fit: newImage.fit || slide.image?.fit || "cover",
          },
        };
      }
      onChange({
        image: {
          ...slide.image,
          url: newImage.url,
          description: newImage.description || slide.title,
          source: newImage.source || "",
          status: newImage.status || "Pronta",
          aspectRatio: newImage.aspectRatio || selectedRatio,
          fit: newImage.fit || slide.image?.fit || "cover",
        },
        ...(nextItems.length > 0 ? { timelineItems: nextItems } : {}),
        layout: effectiveLayout,
        pending: slide.pending?.filter(item => !/imagem|crédito/i.test(item)),
      });
    }
  }, [activeMilestoneIdx, isTimeline, onChange, selectedRatio, slide.image, slide.layout, slide.pending, slide.timelineItems, slide.title]);

  function patchImage(update: Partial<typeof activeImage>) {
    const next = { ...activeImage, ...update };
    handleApplyImage(next);
  }

  async function generate(isUpscale = false) {
    setBusy(true);
    setBusyAction(isUpscale ? "upscale" : "generate");
    setError("");
    try {
      const promptSlide: StudioSlide = selectedMilestone
        ? {
            ...slide,
            title: `${selectedMilestone.label} - ${selectedMilestone.text || slide.title}`,
            content: selectedMilestone.text || slide.content,
            image: {
              description: activeImage.description || slide.title,
              source: activeImage.source || slide.image?.source || "",
              status: activeImage.status || slide.image?.status || "Rascunho",
              url: activeImage.url || slide.image?.url,
            },
          }
        : {
            ...slide,
            image: {
              description: activeImage.description || slide.title,
              source: activeImage.source || slide.image?.source || "",
              status: activeImage.status || slide.image?.status || "Rascunho",
              url: activeImage.url || slide.image?.url,
            },
          };
      const generated = await generateStudioImage(project, promptSlide, {
        engine: selectedEngine,
        creativity: selectedCreativity,
        hdr: isUpscale ? "ultra" : selectedHdr,
        lighting: selectedLighting,
        aspectRatio: selectedRatio,
        isUpscale,
        sourceImageUrl: isUpscale ? activeImage.url : undefined,
      });
      handleApplyImage(generated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar a imagem com IA.");
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function handleEnhancePrompt() {
    if (isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    setError("");
    const current = activeImage.description || slide.title;
    setPreviousPrompt(current);
    try {
      const enhanced = await enhancePromptWithMagnific(current, {
        title: slide.title,
        engine: selectedEngine,
        subject: project.subject,
      });
      patchImage({ description: enhanced });
    } catch {
      setError("Não foi possível otimizar o prompt no momento.");
    } finally {
      setIsEnhancingPrompt(false);
    }
  }

  function handleRestorePrompt() {
    if (previousPrompt) {
      patchImage({ description: previousPrompt });
      setPreviousPrompt(null);
    }
  }

  const upload = useCallback(async (file?: File) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const url = await uploadStudioImage(userId, project.id, slide.id, file);
      handleApplyImage({
        description: activeImage.description || (selectedMilestone ? `${selectedMilestone.label}: ${selectedMilestone.text || ""}` : slide.title),
        url,
        source: activeImage.source || "Fonte: imagem enviada pelo professor",
        status: "Enviada pelo professor — revisar autoria",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }, [userId, project.id, slide.id, slide.title, activeImage.description, activeImage.source, selectedMilestone, handleApplyImage]);

  useEffect(() => {
    if (activeTab !== "upload") return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            void upload(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeTab, upload]);

  function handleDeleteReferenceImage(imgId: string, imgUrl: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const nextImages = referenceImages.filter(item => item.id !== imgId);
    if (onProjectChange) {
      onProjectChange({ referenceImages: nextImages });
    }
    if (activeImage.url === imgUrl) {
      handleApplyImage({ ...activeImage, url: undefined, status: "Removida" });
    }
  }

  const isCurrentActiveSelected = Boolean(activeImage.url);
  const promptPlaceholder = selectedMilestone
    ? `Cena para ${selectedMilestone.label}: ${selectedMilestone.text || slide.title}`
    : "Descreva a cena histórica ou didática, ou use o botão 'Otimizar Prompt' para detalhar com IA.";

  const sourcePresets: { label: string; value: string }[] = [
    { label: "Pintura / Ilustração IA", value: "Fonte: pintura histórica gerada por IA" },
    { label: "Fotografia IA", value: "Fonte: fotografia realista gerada por IA" },
    {
      label: "Apostila / Material",
      value: project.sourceFileName ? `Fonte: ${project.sourceFileName}` : "Fonte: material didático de referência",
    },
    { label: "Domínio Público", value: "Fonte: Acervo Histórico / Domínio Público" },
  ];

  return (
    <section className="studio-image-editor">
      {/* SELETOR DE DATAS / MARCOS HISTÓRICOS (QUANDO HOUVER LINHA DO TEMPO) */}
      {hasTimeline && (
        <div className="studio-image-editor__scope-section">
          <div className="studio-image-editor__scope-header">
            <span className="studio-image-editor__scope-title">
              <Calendar size={13} /> Marcos históricos ({timelineItems.length}):
            </span>
          </div>
          <div className="studio-image-editor__scope-pills">
            <button
              type="button"
              className={`studio-image-editor__scope-pill ${activeMilestoneIdx === null ? "studio-image-editor__scope-pill--active" : ""}`}
              onClick={() => setActiveMilestoneIdx(null)}
            >
              Slide geral {slide.image?.url && "✓"}
            </button>
            {timelineItems.map((item, idx) => {
              const hasImg = Boolean(item.image?.url);
              const isActive = activeMilestoneIdx === idx;
              return (
                <button
                  key={`${item.label}-${idx}`}
                  type="button"
                  className={`studio-image-editor__scope-pill ${isActive ? "studio-image-editor__scope-pill--active" : ""} ${hasImg ? "studio-image-editor__scope-pill--has-img" : ""}`}
                  onClick={() => setActiveMilestoneIdx(idx)}
                >
                  {hasImg && <span className="studio-image-editor__pill-dot" />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* GRID DE DUAS COLUNAS SIMÉTRICAS */}
      <div className="studio-image-editor__layout-grid">
        {/* COLUNA ESQUERDA: PRÉVIA VISUAL, PROPORÇÃO E CRÉDITOS */}
        <div className="studio-image-editor__col-preview">
          <div className="studio-image-editor__preview-card">
            <div className="studio-image-editor__preview-header">
              <span className="studio-image-editor__preview-title">
                <ImageIcon size={14} />
                {selectedMilestone ? `Marco: ${selectedMilestone.label}` : "Prévia da Imagem"}
              </span>
              <span className={`studio-image-editor__status-badge ${isCurrentActiveSelected ? "studio-image-editor__status-badge--active" : ""}`}>
                {isCurrentActiveSelected ? "Definida" : "Sem imagem"}
              </span>
            </div>

            {/* PALCO VISUAL DA IMAGEM */}
            <div className={`studio-image-editor__stage studio-image-editor__stage--ratio-${selectedRatio.replace(":", "-")}`}>
              {activeImage.url ? (
                <div className="studio-image-editor__stage-content">
                  <img
                    className="studio-image-editor__stage-img"
                    src={activeImage.url}
                    alt={activeImage.description || slide.title}
                  />
                  <div className="studio-image-editor__stage-overlay">
                    <span className="studio-image-editor__ratio-tag">
                      {selectedRatio === "3:4" ? "Proporção 3:4" : selectedRatio === "1:1" ? "Proporção 1:1" : "Proporção 16:9"}
                    </span>
                    <button
                      type="button"
                      className="studio-image-editor__stage-remove-btn"
                      title="Remover esta imagem"
                      onClick={() => handleApplyImage({ ...activeImage, url: undefined, status: "Removida" })}
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="studio-image-editor__stage-empty">
                  <div className="studio-image-editor__stage-empty-icon">
                    <ImagePlus size={26} />
                  </div>
                  <strong>Nenhuma imagem selecionada</strong>
                  <p>Gere com a IA, escolha do material didático ou envie do computador.</p>
                </div>
              )}
            </div>

            {/* PROPORÇÃO E CRÉDITOS AGRUPADOS COM CLAREZA */}
            <div className="studio-image-editor__meta-box">
              <div className="studio-image-editor__meta-field">
                <span className="studio-image-editor__meta-label">Proporção no Slide:</span>
                <div className="studio-image-editor__ratio-row">
                  {RATIO_OPTIONS.map(ratioOpt => {
                    const isSelected = selectedRatio === ratioOpt.id;
                    return (
                      <button
                        key={ratioOpt.id}
                        type="button"
                        className={`studio-image-editor__ratio-btn ${isSelected ? "studio-image-editor__ratio-btn--active" : ""}`}
                        onClick={() => {
                          setSelectedRatio(ratioOpt.id);
                          patchImage({ aspectRatio: ratioOpt.id });
                        }}
                        title={ratioOpt.desc}
                      >
                        <span className="studio-image-editor__ratio-label">{ratioOpt.label}</span>
                        <span className="studio-image-editor__ratio-sub">{ratioOpt.ratioTag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="studio-image-editor__meta-field">
                <span className="studio-image-editor__meta-label">Fonte / Autoria e Créditos:</span>
                <input
                  type="text"
                  maxLength={1000}
                  className="studio-image-editor__meta-input"
                  value={activeImage.source || ""}
                  placeholder="Ex.: Fonte: pintura histórica gerada por IA"
                  onChange={e => patchImage({ source: e.target.value })}
                />
              </label>

              {/* ATALHOS DE FONTE EM GRADE 2x2 ALINHADA */}
              <div className="studio-image-editor__preset-section">
                <span className="studio-image-editor__preset-chips-label">Preenchimento rápido:</span>
                <div className="studio-image-editor__preset-chips">
                  {sourcePresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`studio-image-editor__preset-chip ${activeImage.source === preset.value ? "studio-image-editor__preset-chip--active" : ""}`}
                      onClick={() => patchImage({ source: preset.value })}
                      title={preset.value}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: MODOS, FERRAMENTAS E GERAÇÃO */}
        <div className="studio-image-editor__col-tools">
          {/* NAVEGAÇÃO POR ABAS SUPERIORES */}
          <div className="studio-image-editor__tabs">
            <button
              type="button"
              className={`studio-image-editor__tab ${activeTab === "ia" ? "studio-image-editor__tab--active" : ""}`}
              onClick={() => setActiveTab("ia")}
            >
              <Sparkles size={14} /> Criar com IA
            </button>
            <button
              type="button"
              className={`studio-image-editor__tab ${activeTab === "material" ? "studio-image-editor__tab--active" : ""}`}
              onClick={() => setActiveTab("material")}
            >
              <Images size={14} /> Do Material ({referenceImages.length})
            </button>
            <button
              type="button"
              className={`studio-image-editor__tab ${activeTab === "upload" ? "studio-image-editor__tab--active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              <Upload size={14} /> Enviar Arquivo
            </button>
          </div>

          {/* ABA 1: GERAR COM IA */}
          {activeTab === "ia" && (
            <div className="studio-image-editor__tab-panel studio-image-editor__tab-panel--ia">
              {/* PASSO 1: DESCRIÇÃO / PROMPT DA CENA */}
              <div className="studio-image-editor__step-box">
                <div className="studio-image-editor__prompt-header">
                  <label htmlFor="ia-prompt-input" className="studio-image-editor__section-title">
                    <span className="studio-image-editor__step-num">1</span>
                    Descrição da Cena (Prompt)
                  </label>
                  <div className="studio-image-editor__prompt-actions">
                    {previousPrompt && (
                      <button
                        type="button"
                        className="studio-image-editor__undo-btn"
                        onClick={handleRestorePrompt}
                        title="Restaurar prompt anterior"
                      >
                        <RotateCcw size={12} /> Desfazer
                      </button>
                    )}
                    <button
                      type="button"
                      className="studio-image-editor__enhance-btn"
                      disabled={isEnhancingPrompt || busy}
                      onClick={handleEnhancePrompt}
                      title="Expandir e detalhar a descrição com inteligência artificial"
                    >
                      {isEnhancingPrompt ? (
                        <>
                          <LoaderCircle size={12} className="studio-editor__spinner" />
                          <span>Otimizando...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 size={12} />
                          <span>Otimizar Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <textarea
                  id="ia-prompt-input"
                  rows={3}
                  maxLength={4000}
                  className="studio-image-editor__prompt-input"
                  value={activeImage.description || ""}
                  placeholder={promptPlaceholder}
                  onChange={e => patchImage({ description: e.target.value })}
                />
              </div>

              {/* PASSO 2: ESTILO VISUAL */}
              <div className="studio-image-editor__step-box">
                <div className="studio-image-editor__section-header">
                  <span className="studio-image-editor__section-title">
                    <span className="studio-image-editor__step-num">2</span>
                    Estilo Visual
                  </span>
                </div>
                <div className="studio-image-editor__engine-row">
                  {MAGNIFIC_ENGINES.map(engineOpt => {
                    const IconComp = engineOpt.icon;
                    const isSelected = selectedEngine === engineOpt.id;
                    return (
                      <button
                        key={engineOpt.id}
                        type="button"
                        className={`studio-image-editor__engine-btn ${isSelected ? "studio-image-editor__engine-btn--active" : ""}`}
                        onClick={() => setSelectedEngine(engineOpt.id)}
                        title={engineOpt.desc}
                      >
                        <IconComp size={16} />
                        <span>{engineOpt.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PASSO 3: PARÂMETROS DE RENDERIZAÇÃO EM 3 COLUNAS ALINHADAS */}
              <div className="studio-image-editor__step-box">
                <div className="studio-image-editor__section-header">
                  <span className="studio-image-editor__section-title">
                    <span className="studio-image-editor__step-num">3</span>
                    Ajustes de Renderização
                  </span>
                </div>

                <div className="studio-image-editor__precision-grid-3">
                  {/* CRIATIVIDADE */}
                  <div className="studio-image-editor__precision-group">
                    <span className="studio-image-editor__group-label">Criatividade</span>
                    <div className="studio-image-editor__segmented">
                      {CREATIVITY_OPTIONS.map(cOpt => (
                        <button
                          key={cOpt.id}
                          type="button"
                          className={`studio-image-editor__segmented-btn ${selectedCreativity === cOpt.id ? "studio-image-editor__segmented-btn--active" : ""}`}
                          onClick={() => setSelectedCreativity(cOpt.id)}
                          title={cOpt.desc}
                        >
                          {cOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* HDR & NITIDEZ */}
                  <div className="studio-image-editor__precision-group">
                    <span className="studio-image-editor__group-label">Nitidez & HDR</span>
                    <div className="studio-image-editor__segmented">
                      {HDR_OPTIONS.map(hOpt => (
                        <button
                          key={hOpt.id}
                          type="button"
                          className={`studio-image-editor__segmented-btn ${selectedHdr === hOpt.id ? "studio-image-editor__segmented-btn--active" : ""}`}
                          onClick={() => setSelectedHdr(hOpt.id)}
                          title={hOpt.desc}
                        >
                          {hOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ILUMINAÇÃO */}
                  <div className="studio-image-editor__precision-group">
                    <span className="studio-image-editor__group-label">Iluminação</span>
                    <select
                      className="studio-image-editor__lighting-select"
                      value={selectedLighting}
                      onChange={e => setSelectedLighting(e.target.value as MagnificLighting)}
                      aria-label="Iluminação da cena"
                    >
                      {LIGHTING_OPTIONS.map(lOpt => (
                        <option key={lOpt.id} value={lOpt.id}>
                          {lOpt.icon} {lOpt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* MENSAGEM DE ERRO SE HOUVER */}
              {error && (
                <div className="studio-image-editor__error-banner">
                  <Info size={14} />
                  <span>{error}</span>
                </div>
              )}

              {/* AÇÕES DE GERAÇÃO */}
              <div className="studio-image-editor__action-band">
                <div className="studio-image-editor__buttons-row">
                  <button
                    type="button"
                    className="studio-image-editor__generate-btn"
                    disabled={busy}
                    onClick={() => void generate(false)}
                  >
                    {busy && busyAction === "generate" ? (
                      <LoaderCircle className="studio-editor__spinner" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    <span>
                      {busy && busyAction === "generate"
                        ? "Gerando imagem..."
                        : activeImage.url
                          ? "Gerar nova versão com IA"
                          : `Gerar imagem com IA ${selectedMilestone ? `(${selectedMilestone.label})` : ""}`}
                    </span>
                  </button>

                  {activeImage.url && (
                    <button
                      type="button"
                      className="studio-image-editor__upscale-btn"
                      disabled={busy}
                      onClick={() => void generate(true)}
                      title="Refinar nitidez e micro-texturas da imagem atual"
                    >
                      {busy && busyAction === "upscale" ? (
                        <LoaderCircle className="studio-editor__spinner" size={14} />
                      ) : (
                        <ZoomIn size={14} />
                      )}
                      <span>
                        {busy && busyAction === "upscale" ? "Refinando..." : "Refinar Nitidez"}
                      </span>
                    </button>
                  )}
                </div>

                <div className="studio-image-editor__ia-hint">
                  <Info size={12} className="studio-image-editor__hint-icon" />
                  <span>
                    Geração em alta definição com enquadramento exato para cobrir a margem sem textos ou bordas.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: DO MATERIAL ORIGINAL */}
          {activeTab === "material" && (
            <div className="studio-image-editor__tab-panel studio-image-editor__tab-panel--material">
              {referenceImages.length > 0 ? (
                <>
                  <div className="studio-image-editor__material-header">
                    <p>
                      Selecione uma imagem extraída da apostila para aplicar {selectedMilestone ? `ao marco ${selectedMilestone.label}` : "a este slide"}:
                    </p>
                    <small>{referenceImages.length} disponíveis</small>
                  </div>

                  <div className="studio-image-editor__material-grid">
                    {referenceImages.map(img => {
                      const isSelected = activeImage.url === img.url;
                      return (
                        <div
                          key={img.id}
                          className={`studio-image-editor__material-card ${isSelected ? "studio-image-editor__material-card--selected" : ""}`}
                          onClick={() => handleApplyImage({
                            url: img.url,
                            description: img.name || img.label || activeImage.description || slide.title,
                            source: `Fonte: ${img.source || project.sourceFileName || "material didático original"}`,
                            status: "Selecionada do material didático",
                          })}
                        >
                          <div className="studio-image-editor__material-thumb-wrap">
                            <img
                              src={img.url}
                              alt={img.name || img.label || "Imagem do material"}
                              className="studio-image-editor__material-thumb"
                              loading="lazy"
                            />
                            {isSelected && (
                              <div className="studio-image-editor__material-check-badge">
                                <Check size={12} /> Em uso
                              </div>
                            )}
                            <button
                              type="button"
                              className="studio-image-editor__material-delete-btn"
                              title="Excluir imagem do projeto"
                              onClick={e => handleDeleteReferenceImage(img.id, img.url, e)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div className="studio-image-editor__material-info">
                            <span className="studio-image-editor__material-label">{img.name || img.label || "Imagem de referência"}</span>
                            {img.source && <small className="studio-image-editor__material-source">{img.source}</small>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="studio-image-editor__stage-empty">
                  <div className="studio-image-editor__stage-empty-icon">
                    <Images size={28} />
                  </div>
                  <strong>Nenhuma imagem extraída da apostila</strong>
                  <p>Não há imagens catalogadas no arquivo deste projeto. Você pode criar ilustrações inéditas na aba "Criar com IA" ou enviar arquivos em "Enviar Arquivo".</p>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: ENVIAR ARQUIVO PRÓPRIO */}
          {activeTab === "upload" && (
            <div className="studio-image-editor__tab-panel studio-image-editor__tab-panel--upload">
              <div
                className={`studio-image-editor__upload-zone ${isDragging ? "studio-image-editor__upload-zone--dragging" : ""} ${busy ? "studio-image-editor__upload-zone--busy" : ""}`}
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void upload(file);
                }}
                onClick={() => !busy && input.current?.click()}
              >
                <input
                  ref={input}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = "";
                  }}
                />

                <div className="studio-image-editor__upload-icon-wrapper">
                  {busy ? (
                    <LoaderCircle className="studio-editor__spinner studio-image-editor__upload-spinner" size={32} />
                  ) : (
                    <UploadCloud size={34} className="studio-image-editor__upload-icon" />
                  )}
                </div>

                <div className="studio-image-editor__upload-texts">
                  <h4 className="studio-image-editor__upload-title">
                    {busy
                      ? "Enviando e vinculando imagem ao slide..."
                      : isDragging
                      ? "Solte o arquivo aqui para enviar!"
                      : "Arraste e solte uma imagem aqui"}
                  </h4>
                  <p className="studio-image-editor__upload-desc">
                    ou selecione um arquivo de imagem diretamente do seu computador
                  </p>
                </div>

                <div className="studio-image-editor__upload-action-row">
                  <button
                    type="button"
                    className="studio-image-editor__upload-pick-btn"
                    disabled={busy}
                    onClick={e => {
                      e.stopPropagation();
                      input.current?.click();
                    }}
                  >
                    {busy ? <LoaderCircle className="studio-editor__spinner" size={15} /> : <FolderUp size={16} />}
                    <span>{busy ? "Enviando arquivo..." : "Selecionar do Computador"}</span>
                  </button>
                </div>

                <div className="studio-image-editor__upload-meta-pills">
                  <span className="studio-image-editor__upload-pill">PNG</span>
                  <span className="studio-image-editor__upload-pill">JPG / JPEG</span>
                  <span className="studio-image-editor__upload-pill">WEBP</span>
                  <span className="studio-image-editor__upload-pill">Até 10 MB</span>
                  <span className="studio-image-editor__upload-pill studio-image-editor__upload-pill--ctrl" title="Você pode colar qualquer imagem copiada diretamente da área de transferência">
                    <Clipboard size={11} /> Suporta Ctrl + V
                  </span>
                </div>
              </div>

              <div className="studio-image-editor__upload-hints-grid">
                <div className="studio-image-editor__upload-hint-card">
                  <div className="studio-image-editor__upload-hint-icon">
                    <Maximize2 size={15} />
                  </div>
                  <div className="studio-image-editor__upload-hint-body">
                    <strong>Resolução Ideal</strong>
                    <p>A partir de 1280×720 para nitidez máxima no PDF e PowerPoint.</p>
                  </div>
                </div>

                <div className="studio-image-editor__upload-hint-card">
                  <div className="studio-image-editor__upload-hint-icon">
                    <Sparkles size={15} />
                  </div>
                  <div className="studio-image-editor__upload-hint-body">
                    <strong>Enquadramento</strong>
                    <p>Escolha a proporção sob a prévia à esquerda para ajustar o corte.</p>
                  </div>
                </div>

                <div className="studio-image-editor__upload-hint-card">
                  <div className="studio-image-editor__upload-hint-icon">
                    <ShieldCheck size={15} />
                  </div>
                  <div className="studio-image-editor__upload-hint-body">
                    <strong>Fonte e Autoria</strong>
                    <p>Informe os créditos no painel esquerdo para manter o padrão didático.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RODAPÉ DO EDITOR ENXUTO E ALINHADO */}
      <footer className="studio-image-editor__footer">
        <div className="studio-image-editor__footer-status">
          {error ? (
            <p className="studio-image-editor__alert-error">⚠️ {error}</p>
          ) : busy ? (
            <p className="studio-image-editor__alert-busy">
              <LoaderCircle size={14} className="studio-editor__spinner" />
              <span>{busyAction === "upscale" ? "Refinando nitidez da imagem..." : "Gerando imagem com inteligência artificial..."}</span>
            </p>
          ) : activeImage.url ? (
            <span className="studio-image-editor__status-tag studio-image-editor__status-tag--success">
              <Check size={14} /> Imagem pronta e vinculada ao slide
            </span>
          ) : (
            <span className="studio-image-editor__status-tag studio-image-editor__status-tag--neutral">
              💡 Gere uma ilustração com IA, selecione da apostila ou envie do computador
            </span>
          )}
        </div>

        <div className="studio-image-editor__footer-actions">
          <button
            type="button"
            className="studio-image-editor__btn-confirm"
            onClick={() => {
              if (onClose) onClose();
            }}
            title="Concluir e voltar ao slide"
          >
            <Check size={16} />
            <span>Concluir</span>
          </button>
        </div>
      </footer>
    </section>
  );
}
