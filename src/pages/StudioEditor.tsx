import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, Check, ChevronLeft, ChevronRight, Download, FileText, Gamepad2, Images, LoaderCircle, MonitorPlay, Package, Pencil, Plus, Presentation, RotateCcw, Save, Sparkles, Trash2, Upload, Video, X } from "lucide-react";
import { Layout } from "../components/ui/Layout";
import { auth } from "../lib/firebase";
import { getStudioJobs, subscribeStudioJobs, isStudioJobRunning, startStudioJob, markStudioJobSaved, removeStudioJob, withStudioDeadline } from "../lib/studioJobs";
import type { StudioJob } from "../lib/studioJobs";
import { extractStudioBriefing, formatBnccCodes, mergeStudioBriefing, type StudioBriefing } from "../lib/studioBriefing";
import { createStudioId, deleteStudioProject, getStudioProjects, hydrateProjectImages, saveStudioProject, studioFilename } from "../lib/studioProjects";
import type { ExtractedReferenceImage, StudioKind, StudioProject, StudioScene, StudioSlide } from "../lib/studioProjects";
import "../styles/studio/studio-editor.css";
import { readStudioReference } from "../lib/studioReference";
import { exportStudioPptx } from "../lib/studioPptx";
import { StudioSlideEditor } from "../components/studio/StudioSlideEditor";
import { StudioDeckPreview } from "../components/studio/StudioDeckPreview";
import { StudioSlideFrame } from "../components/studio/StudioSlidePreview";
import { StudioResendModal } from "../components/studio/StudioResendModal";
import { slideTypes, studioWarnings } from "../lib/studioGuidelines";
import { orderedStudioSlides, slideTypeLabels } from "../lib/studioNavigation";

const metadata = {
  slides: { title: "Slides Canvas", subtitle: "Transforme o conteúdo da aula em uma apresentação bem planejada.", icon: Presentation },
  roteiro: { title: "Roteiro de Gravação", subtitle: "Organize cada cena, da primeira fala à última orientação visual.", icon: Video },
  pacote: { title: "Pacote da aula", subtitle: "Um briefing compartilhado para planejar slides e roteiro de gravação.", icon: Package },
};

function newSlide(title = ""): StudioSlide {
  return { id: createStudioId(), title, content: "", notes: "", type: "conteudo", duration: 45 };
}

function newScene(title = ""): StudioScene {
  return { id: createStudioId(), title, duration: "", speech: "", visual: "" };
}

function newProject(kind: StudioKind, line = "Konectar.me"): StudioProject {
  return {
    line, id: createStudioId(), kind, title: "", subject: "", gradeLevel: "", objective: "", sourceContent: "",
    targetSlideCount: 10,
    slides: kind === "roteiro" ? [] : [...slideTypes.filter(type => type !== "formula").map(type => ({ ...newSlide(), type }))],
    scenes: kind === "slides" ? [] : [newScene("Abertura"), newScene("Explicação e demonstração"), newScene("Síntese e atividade")],
    updatedAt: new Date().toISOString(),
  };
}

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= items.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function SlidesFlow({
  project, job, stage, recentProjects, fileInput, importing, importStatus, error, message, progressClock,
  exporting, onStage, onUpdate, onImport, onPaste, onGenerate, onOpenProject, onOpenResend, onDownload, onSelectSlide,
}: {
  project: StudioProject; job?: StudioJob; stage: "recent" | "prepare" | "progress" | "result"; recentProjects: StudioProject[]; progressClock: number;
  fileInput: React.RefObject<HTMLInputElement | null>; importing: boolean; importStatus: string; error: string; message: string;
  exporting?: boolean;
  onStage: (stage: "recent" | "prepare" | "progress" | "result" | "edit") => void; onUpdate: (patch: Partial<StudioProject>) => void;
  onImport: (file?: File) => void; onPaste: (text: string) => void; onGenerate: () => void; onOpenProject: (id: string) => void;
  onOpenResend: () => void;
  onDownload?: (format?: "pptx" | "pdf" | "roteiro") => void;
  onSelectSlide?: (id: string) => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const templates = [
    { name: "Konectar.me", slug: "konectar-me", badge: "Recomendado", format: "Aula Síntese (10 slides)", audience: "Ensino Médio e Superior", tone: "blue" },
    { name: "Konecta Kids", slug: "konecta-kids", format: "Lúdico e ilustrado", audience: "Ensino Fundamental I", tone: "orange" },
    { name: "Educação Corporativa", slug: "educacao-corporativa", format: "Treinamentos e workshops", audience: "Capacitação profissional", tone: "violet" },
  ];
  const orderedSlides = orderedStudioSlides(project.slides);
  const totalSeconds = orderedSlides.reduce((total, slide) => total + (Number(slide.duration) || 0), 0);
  const duration = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  const steps = [
    "Lendo a apostila e sintetizando os conceitos-chave",
    "Estruturando a aula passo a passo para os alunos",
    "Tratando as imagens da apostila",
    "Aplicando o modelo oficial Konectar.me e área de segurança",
    "Escrevendo o roteiro didático de fala do professor",
    "Conferindo a clareza e o checklist pedagógico"
  ];
  const currentStep = job?.status === "ready" ? 6 : Math.min(5, job?.progressStep ?? 0);
  const progress = job?.status === "ready" ? 100 : Math.min(96, [12, 30, 47, 64, 79, 91][currentStep]);
  const elapsedSeconds = job?.startedAt ? Math.max(0, Math.floor((progressClock - job.startedAt) / 1000)) : 0;
  const reviewItems = [...new Set([...(project.alerts || []), ...studioWarnings(project)])];
  const hasGeneratedSlides = project.slides.some(slide => Boolean(slide.content?.trim() || slide.notes?.trim()));
  const sampleSlides: StudioSlide[] = [
    { id: "sample-cover", title: "Uma nova descoberta", content: "", notes: "", type: "capa", duration: 30 },
    { id: "sample-objective", title: "O que vamos aprender", content: "Conheça os conceitos principais e descubra como eles se conectam ao seu dia a dia.", notes: "", type: "objetivo_bncc", objective: "Compreender os conceitos centrais da aula.", duration: 45 },
    { id: "sample-content", title: "Ideias principais", content: "• Um conceito por vez\n• Exemplos próximos da realidade\n• Uma atividade para praticar", notes: "", type: "conteudo", duration: 45 },
  ];
  const slidesForPreview = hasGeneratedSlides ? orderedSlides : sampleSlides;
  const activePreviewIndex = Math.min(previewIndex, slidesForPreview.length - 1);
  const activePreviewSlide = slidesForPreview[activePreviewIndex] || sampleSlides[0];
  const previewProject = hasGeneratedSlides ? project : { ...project, title: project.title || "Uma nova descoberta", subject: project.subject || "Tema da aula" };

  return <div className={`studio-slides-flow studio-slides-flow--${stage}`}>
    {stage === "recent" && <main className="studio-slides-recent">
      <div className="studio-slides-recent-heading">
        <div>
          <span>CONTINUE DE ONDE PAROU</span>
          <h1>Projetos recentes</h1>
          <p>Abra uma apresentação para continuar ou crie uma nova aula estruturada pela IA.</p>
        </div>
        <button type="button" className="studio-slides-primary" onClick={() => onStage("prepare")}>
          <Plus size={17} /> Nova apresentação
        </button>
      </div>
      {recentProjects.length ? (
        <div className="studio-slides-recent-grid">
          {recentProjects.map(recent => (
            <button type="button" className="studio-slides-recent-card" key={recent.id} onClick={() => onOpenProject(recent.id)}>
              <span className="studio-slides-recent-card__icon"><Presentation size={20} /></span>
              <span className="studio-slides-recent-card__count">{recent.slides.length} slides</span>
              <strong>{recent.title || "Projeto sem título"}</strong>
              <small>{[recent.subject, recent.line || "Konectar.me"].filter(Boolean).join(" · ")}</small>
              <span className="studio-slides-recent-card__date">Atualizado em {new Date(recent.updatedAt).toLocaleDateString("pt-BR")}</span>
              <ArrowUpRight className="studio-slides-recent-card__arrow" size={17} />
            </button>
          ))}
        </div>
      ) : (
        <section className="studio-slides-recent-empty">
          <span><Presentation size={25} /></span>
          <h2>Nenhuma apresentação recente</h2>
          <p>Quando você criar e salvar slides, eles aparecerão aqui para você retomar a qualquer momento.</p>
          <button type="button" className="studio-slides-primary" onClick={() => onStage("prepare")}>
            <Plus size={17} /> Criar primeira apresentação
          </button>
        </section>
      )}
    </main>}

    {stage === "prepare" && <main className="studio-slides-create">
      <div className="studio-slides-intro">
        <span className="studio-slides-intro-badge"><Sparkles size={12} /> Planejamento Pedagógico</span>
        <h1>Criar aula a partir do material</h1>
        <p>A IA sintetiza a apostila enviada e cria uma aula didática passo a passo para seus alunos entenderem os conceitos com facilidade.</p>
      </div>

      <div className="studio-slides-setup-layout">
        <div className="studio-slides-setup">
          <section className="studio-slides-card studio-slides-models-card">
            <h2><span>1</span> Modelo pedagógico</h2>
            <div className="studio-template-grid">
              {templates.map(template => {
                const isSelected = (project.line || "Konectar.me") === template.name;
                return (
                  <button
                    type="button"
                    key={template.slug}
                    className={`studio-model-card studio-model-card--${template.tone}${isSelected ? " is-selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => onUpdate({ line: template.name, targetSlideCount: template.name === "Konectar.me" ? Math.min(10, Math.max(9, project.targetSlideCount || 10)) : Math.max(5, project.targetSlideCount || 10) })}
                  >
                    <div className="studio-model-card__body">
                      <div className="studio-model-card__header">
                        <strong>{template.name}</strong>
                        {template.badge && <span className="studio-model-card__badge">{template.badge}</span>}
                      </div>
                      <span className="studio-model-card__meta">
                        {template.format} · <small>{template.audience}</small>
                      </span>
                    </div>
                    <span className="studio-model-card__radio" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="studio-slides-card studio-slides-upload-card">
            <h2><span>2</span> Apostila ou Material Didático</h2>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={event => { onImport(event.target.files?.[0]); event.target.value = ""; }}
            />
            <button
              type="button"
              className="studio-slides-dropzone"
              disabled={importing}
              onClick={() => fileInput.current?.click()}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); onImport(event.dataTransfer.files?.[0]); }}
            >
              <div className="studio-slides-dropzone__icon">
                {importing ? <LoaderCircle className="studio-editor__spinner" size={24} /> : <Upload size={22} />}
              </div>
              <div className="studio-slides-dropzone__text">
                <strong>{importing ? importStatus : "Envie a apostila ou material didático"}</strong>
                <small>Arraste o arquivo (PDF ou Word) para a IA resumir o conteúdo e criar a aula</small>
              </div>
            </button>
            {project.sourceContent && (
              <div className="studio-slides-file">
                <span className="studio-slides-file__type">
                  {project.sourceFileName?.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}
                </span>
                <span className="studio-slides-file__meta">
                  <strong>{project.sourceFileName || "Material de referência"}</strong>
                  <small>{project.sourceContent.length.toLocaleString("pt-BR")} caracteres carregados</small>
                </span>
                <button type="button" disabled={importing} aria-label="Remover material" onClick={() => onUpdate({ sourceContent: "", sourceFileName: undefined, referenceImages: [] })}>
                  <X size={17} />
                </button>
              </div>
            )}
            <button className="studio-slides-text-toggle" type="button" disabled={importing} onClick={() => setPasteOpen(open => !open)}>
              {pasteOpen ? "Fechar entrada de texto" : "Prefere colar o texto diretamente?"}
            </button>
            {pasteOpen && (
              <div className="studio-slides-paste">
                <textarea rows={5} disabled={importing} value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="Cole aqui o texto da apostila ou trecho que servirá de base para a aula…" />
                <button
                  type="button"
                  disabled={!pasteText.trim() || importing}
                  onClick={() => {
                    onPaste(pasteText);
                    setPasteOpen(false);
                  }}
                >
                  Usar este texto como material
                </button>
              </div>
            )}
          </section>

          <div className="studio-slides-create-action">
            <button
              type="button"
              className={`studio-slides-primary${(!project.sourceContent?.trim() || importing || Boolean(job && isStudioJobRunning(job))) ? " is-disabled" : ""}`}
              disabled={!project.sourceContent?.trim() || importing || Boolean(job && isStudioJobRunning(job))}
              aria-busy={importing || Boolean(job && isStudioJobRunning(job))}
              onClick={onGenerate}
            >
              {(importing || (job && isStudioJobRunning(job))) ? <LoaderCircle className="studio-editor__spinner" size={19} /> : <Sparkles size={19} />}
              {importing ? "Lendo material enviado…" : (job && isStudioJobRunning(job)) ? "Criando aula com IA…" : "Criar aula com IA"}
            </button>
            <span className="studio-slides-create-caption">Síntese pedagógica e diagramação automática no modelo {project.line || "Konectar.me"}</span>
          </div>
          {(error || message) && (
            <p className={`studio-slides-feedback${error ? " has-error" : ""}`} role={error ? "alert" : "status"}>
              {error || message}
            </p>
          )}
        </div>

        <section className="studio-slides-preview-panel" aria-label="Prévia navegável dos slides">
          <div className="studio-slides-preview-heading">
            <div>
              <span className="studio-preview-eyebrow">ESTRUTURA PEDAGÓGICA</span>
              <h2>{hasGeneratedSlides ? project.title || "Apresentação da aula" : project.line || "Konectar.me"}</h2>
            </div>
          </div>
          <div className="studio-slides-preview-stage">
            <StudioSlideFrame project={previewProject} slide={activePreviewSlide} />
          </div>
          <div className="studio-slides-preview-controls">
            <button type="button" aria-label="Slide anterior" disabled={activePreviewIndex === 0} onClick={() => setPreviewIndex(index => Math.max(0, index - 1))}>
              <ChevronLeft size={18} />
            </button>
            <div className="studio-slides-preview-dots" aria-label="Selecionar slide">
              {slidesForPreview.map((slide, index) => (
                <button
                  type="button"
                  key={slide.id}
                  aria-label={`Slide ${index + 1}`}
                  aria-current={index === activePreviewIndex ? "true" : undefined}
                  onClick={() => setPreviewIndex(index)}
                />
              ))}
            </div>
            <span className="studio-slides-preview-counter">{activePreviewIndex + 1} de {slidesForPreview.length}</span>
            <button type="button" aria-label="Próximo slide" disabled={activePreviewIndex >= slidesForPreview.length - 1} onClick={() => setPreviewIndex(index => Math.min(slidesForPreview.length - 1, index + 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      </div>
    </main>}

    {stage === "progress" && <main className="studio-slides-progress-wrap" aria-live="polite">
      <section className="studio-slides-progress-card">
        <span className="studio-slides-progress-icon"><Sparkles size={27} /></span>
        <span className="studio-slides-eyebrow">INTELIGÊNCIA PEDAGÓGICA</span>
        <h1>Criando seus slides...</h1>
        <p className="studio-slides-progress-subtitle">Modelo {project.line || "Konectar.me"} · {project.title || "Aula a partir da apostila"}</p>
        <div className="studio-slides-progress-track" role="progressbar" aria-label="Progresso da criação dos slides" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="studio-slides-progress-caption">
          <span>{job?.message || "Lendo a apostila e os tópicos…"}<small>{elapsedSeconds}s decorridos · cerca de 30s</small></span>
          <strong>{progress}%</strong>
        </div>
        <ol className="studio-slides-steps">
          {steps.map((step, index) => (
            <li key={step} className={index < currentStep ? "is-done" : index === currentStep ? "is-current" : ""}>
              <span>{index < currentStep ? <Check size={15} /> : index === currentStep ? <LoaderCircle size={17} /> : null}</span>
              {step}
            </li>
          ))}
        </ol>
        {job?.result && <button type="button" className="studio-slides-view-results" onClick={() => onStage("edit")}>Ir para o editor de slides →</button>}
        {error && <p className="studio-slides-feedback has-error" role="alert">{error}<button type="button" onClick={() => onStage("prepare")}>Voltar</button></p>}
      </section>
    </main>}

    {stage === "result" && <main className="studio-slides-result">
      <div className="studio-slides-result-heading">
        <div>
          <p className="studio-slides-ready"><Check size={16} /> Apresentação gerada com sucesso!</p>
          <h1>{project.title || "Apresentação da aula"}</h1>
          <p>{project.line || "Konectar.me"} · {project.line === "Konectar.me" ? "Aula síntese" : "Apresentação"} · {orderedSlides.length} slides prontos · ~{duration} de fala estimada</p>
        </div>
        <div className="studio-slides-result-top-actions">
          <button type="button" className="studio-slides-primary" disabled={exporting} onClick={() => onDownload ? onDownload("pptx") : null}>
            {exporting ? <LoaderCircle size={17} className="studio-editor__spinner" /> : <Download size={17} />}
            Baixar PowerPoint (.pptx)
          </button>
          <button type="button" className="studio-slides-secondary" onClick={() => onStage("edit")}>
            <Pencil size={15} /> Editar slide a slide
          </button>
        </div>
      </div>

      <div className="studio-slides-result-layout">
        <div>
          <p style={{ margin: "0 0 14px", color: "var(--studio-text-muted, #8b90a2)", fontSize: "13.5px" }}>
            💡 <strong>Dica:</strong> Clique em qualquer miniatura abaixo para abrir a edição detalhada daquele slide (textos, imagens e notas do apresentador).
          </p>
          <section className="studio-slides-thumbnails" aria-label="Miniaturas dos slides">
            {orderedSlides.map((slide, index) => (
              <button
                type="button"
                className="studio-slide-thumb"
                key={slide.id}
                onClick={() => {
                  onSelectSlide?.(slide.id);
                  onStage("edit");
                }}
              >
                <span className="studio-slide-thumb__preview">
                  <StudioSlideFrame project={project} slide={slide} />
                </span>
                <strong>{index + 1} &nbsp;{slide.title || slideTypeLabels[slide.type || "conteudo"]}</strong>
                <span className="studio-slide-thumb__action"><Pencil size={11} /> Editar slide</span>
              </button>
            ))}
          </section>
        </div>

        <aside className="studio-slides-result-aside">
          <section className="studio-slides-downloads">
            <h3>Opções de Arquivo</h3>
            <button type="button" className="studio-slides-primary" disabled={exporting} onClick={() => onDownload ? onDownload("pptx") : null}>
              {exporting ? <LoaderCircle size={16} className="studio-editor__spinner" /> : <Download size={16} />} PowerPoint Editável (.pptx)
            </button>
            <button type="button" className="studio-slides-secondary" disabled={exporting} onClick={() => onDownload ? onDownload("pdf") : null}>
              {exporting ? <LoaderCircle size={16} className="studio-editor__spinner" /> : <FileText size={16} />} Documento PDF (.pdf)
            </button>
            <button type="button" className="studio-slides-secondary" disabled={exporting} onClick={() => onDownload ? onDownload("roteiro") : null}>
              <FileText size={16} /> Roteiro com Fala e Direção (.txt)
            </button>
          </section>

          <section className="studio-slides-review">
            <h2>Checklist da Apresentação</h2>
            {reviewItems.length ? (
              <ul>{reviewItems.slice(0, 7).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
            ) : (
              <p>O conteúdo está pronto e estruturado no modelo oficial.</p>
            )}
          </section>

          <div className="studio-slides-result-actions">
            <button type="button" className="studio-slides-btn-resend" onClick={onOpenResend}>
              <Upload size={16} /> Reenviar material didático
            </button>
            <button type="button" className="studio-slides-restart" onClick={() => onStage("prepare")}>
              <RotateCcw size={14} /> Criar nova aula do zero
            </button>
          </div>
          {(error || message) && (
            <p className={`studio-slides-feedback${error ? " has-error" : ""}`} role={error ? "alert" : "status"}>
              {error || message}
            </p>
          )}
        </aside>
      </div>
    </main>}
  </div>;
}

function StudioWorkspace({ kind, userId, projectId }: { kind: StudioKind; userId: string; projectId: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const returnPath = searchParams.get("from") === "projetos" || location.state?.from === "/projetos" ? "/projetos" : "/inicio";
  const returnLabel = returnPath === "/projetos" ? "Voltar para Meus Projetos" : "Voltar ao início";
  const [initial] = useState(() => getStudioProjects(userId).find((item) => item.id === projectId && item.kind === kind));
  const [project, setProject] = useState<StudioProject>(() => {
    const completedJob = getStudioJobs().find(job => job.userId === userId && job.projectId === projectId);
    const unsavedResult = completedJob?.status === "error" ? completedJob.result : undefined;
    return unsavedResult ?? initial ?? completedJob?.result ?? newProject(kind, ["Konectar.me", "Konecta Kids", "Educa\u00e7\u00e3o Corporativa"].includes(searchParams.get("linha") || "") ? searchParams.get("linha")! : "Konectar.me");
  });
  const [recentProjects, setRecentProjects] = useState<StudioProject[]>(() => getStudioProjects(userId).filter(item => item.kind === "slides").slice(0, 6));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(projectId && !initial ? "Este rascunho não foi encontrado neste navegador. Você pode iniciar um novo projeto." : "");
  const jobs = useSyncExternalStore(subscribeStudioJobs, getStudioJobs);
  const job = jobs.find(item => item.userId === userId && item.projectId === project.id);
  const generating = isStudioJobRunning(job);
  const [stage, setStage] = useState<"recent" | "prepare" | "progress" | "result" | "edit">(() => {
    const urlStage = searchParams.get("stage");
    if (urlStage === "edit" || urlStage === "prepare" || urlStage === "progress" || urlStage === "result" || urlStage === "recent") {
      return urlStage;
    }
    if (job && isStudioJobRunning(job)) return "progress";
    if (projectId) return "edit";
    if (kind === "slides" && !searchParams.has("linha")) return "recent";
    return "prepare";
  });
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedSlideId, setSelectedSlideId] = useState<string | undefined>(undefined);
  const [progressClock, setProgressClock] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<"slides" | "roteiro">(kind === "roteiro" ? "roteiro" : "slides");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [pastedContent, setPastedContent] = useState("");
  const [slideCountText, setSlideCountText] = useState(() => String(project.targetSlideCount || 10));
  const slideCountInputRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const autoRetried = useRef(false);
  const alive = useRef(true);
  const info = metadata[kind];
  const Icon = info.icon;
  const hasGeneratedSlides = project.slides.some(slide => Boolean(slide.content?.trim() || slide.notes?.trim()));

  useEffect(() => {
    const urlStage = searchParams.get("stage");
    if (urlStage === "edit" || urlStage === "prepare" || urlStage === "progress" || urlStage === "result" || urlStage === "recent") {
      setStage(urlStage);
    }
  }, [searchParams]);

  useEffect(() => {
    const refreshRecentProjects = () => {
      setRecentProjects(getStudioProjects(userId).filter(item => item.kind === "slides").slice(0, 6));
      if (projectId) {
        const found = getStudioProjects(userId).find(item => item.id === projectId && item.kind === kind);
        if (found) {
          setProject(prev => {
            if (prev.id !== projectId) return hydrateProjectImages(found);
            return prev.updatedAt > found.updatedAt
              ? hydrateProjectImages(prev, found)
              : hydrateProjectImages(found, prev);
          });
          setError("");
        }
      }
    };
    window.addEventListener("mind-canvas:projects-changed", refreshRecentProjects);
    window.addEventListener("storage", refreshRecentProjects);
    return () => {
      window.removeEventListener("mind-canvas:projects-changed", refreshRecentProjects);
      window.removeEventListener("storage", refreshRecentProjects);
    };
  }, [userId, projectId, kind]);
  useEffect(() => {
    if (project.targetSlideCount && String(project.targetSlideCount) !== slideCountText && document.activeElement !== slideCountInputRef.current) {
      setSlideCountText(String(project.targetSlideCount));
    }
  }, [project.targetSlideCount, slideCountText]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);

  // Sincroniza os slides gerados pela IA automaticamente para a tela
  useEffect(() => {
    if (!job?.result) return;
    if (job.status === "illustrating" || job.status === "ready") {
      setProject(job.result);
      setDirty(false);
      if (job.status === "ready") {
        setStage("edit");
        setMessage(job.message || "Slides preenchidos com sucesso a partir do conteúdo de referência!");
      } else if (kind === "slides") {
        setStage("progress");
      }
    } else if (job.status === "error") {
      if (job.result) {
        setProject(job.result);
        setDirty(false);
      }
      setError(job.message || "Não foi possível concluir a geração dos slides. Tente novamente.");
      if (kind === "slides") setStage("prepare");
    }
  }, [job?.result, job?.status, job?.message, kind]);

  useEffect(() => {
    if (!generating || kind !== "slides") return;
    const timer = window.setInterval(() => setProgressClock(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [generating, kind]);

  function update(patch: Partial<StudioProject>) {
    setProject((current) => ({ ...current, ...patch }));
    setDirty(true);
    setMessage("");
  }

  function save() {
    try {
      const saved = saveStudioProject(userId, project);
      markStudioJobSaved(userId, saved);
      setProject(saved);
      setDirty(false);
      setError("");
      setMessage("Rascunho salvo neste navegador.");
      if (!projectId) setSearchParams({ id: saved.id }, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error && cause.message.startsWith("Não foi possível") ? cause.message : "Não foi possível salvar neste navegador. Verifique o espaço disponível ou exporte seu trabalho.");
    }
  }

  function handleDeleteProject() {
    deleteStudioProject(userId, project.id);
    removeStudioJob(userId, project.id);
    setDirty(false);
    navigate(returnPath, { replace: true });
  }

  async function download(format: "pptx" | "pdf" | "roteiro" = "pptx") {
    setExporting(true);
    setError("");
    setMessage("");
    try {
      if (format === "pdf") {
        const { exportStudioPdf } = await import("../lib/studioPdf");
        await exportStudioPdf(project);
      } else if (format === "roteiro") {
        const content = orderedStudioSlides(project.slides).map((slide, index) => {
          const duration = slide.duration ? ` · ${slide.duration}s` : "";
          return `${String(index + 1).padStart(2, "0")} · ${slide.title || slideTypeLabels[slide.type || "conteudo"]}${duration}\n${slide.notes || "Fala pendente de revisão."}`;
        }).join("\n\n");
        const blob = new Blob([`ROTEIRO DE FALA — ${project.title}\n${project.subject} · ${project.gradeLevel}\n\n${content}\n`], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = `${studioFilename(project)}_ROTEIRO.txt`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      } else await exportStudioPptx(project);
      if (alive.current) setMessage(format === "pdf" ? "PDF da aula exportado para o estúdio." : format === "roteiro" ? "Roteiro de fala baixado." : "PowerPoint exportado com textos editáveis e notas do apresentador.");
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Não foi possível exportar a apresentação. Tente novamente.");
    } finally {
      if (alive.current) setExporting(false);
    }
  }

  /**
   * Processa o conteúdo inserido: extrai briefing e prepara o material, aguardando o clique no botão para gerar a aula
   */
  async function processReferenceContent(content: string, fileName?: string, referenceImages?: ExtractedReferenceImage[]) {
    const trimmed = content.trim();
    if (!trimmed) {
      setError("O conteúdo de referência está vazio. Insira um texto ou envie um arquivo.");
      return;
    }
    setImporting(true);
    setError("");
    setMessage("");
    setImportStatus(referenceImages?.length ? `Lendo documento e ${referenceImages.length} imagens originais…` : "Lendo conteúdo de referência…");

    try {
      // 1. Extrair briefing com IA a partir do conteúdo de referência
      setImportStatus("Identificando tema e dados do briefing…");
      let extracted = {};
      try {
        extracted = await extractStudioBriefing(trimmed, project.line || "Konectar.me");
      } catch (cause) {
        console.warn("Extração de briefing automática parcial:", cause);
      }

      if (!alive.current) return;

      const patch = mergeStudioBriefing(project, extracted);
      const corporate = project.line === "Educação Corporativa";
      const kids = project.line === "Konecta Kids";

      const title = project.title.trim() || patch.title?.trim() || "Aula a partir da Referência";
      const subject = project.subject.trim() || patch.subject?.trim() || "Geral";
      const gradeLevel = project.gradeLevel || patch.gradeLevel || (corporate ? "" : "Fundamental 2");
      const objective = project.objective.trim() || patch.objective?.trim() || `Compreender os conceitos essenciais de ${title}`;
      const exercise = project.exercise?.trim() || patch.exercise?.trim() || (project.line === "Konectar.me" && kind === "slides" ? "" : "Exercício prático de fixação e reflexão sobre o conteúdo");
      const schoolYear = project.schoolYear?.trim() || patch.schoolYear?.trim() || (corporate ? "" : "Ano regular");
      const bimester = project.bimester?.trim() || patch.bimester?.trim() || (corporate ? "" : "1º Bimestre");
      const subtitle = project.subtitle?.trim() || patch.subtitle?.trim() || (corporate ? "Capacitação Profissional" : "");
      const teacher = project.teacher?.trim() || patch.teacher?.trim() || (kids ? "Professor(a)" : "");
      const curriculum = project.curriculum?.trim() || patch.curriculum?.trim() || "";
      const observations = project.observations?.trim() || patch.observations?.trim() || "";
      const imagesToStore = referenceImages !== undefined ? referenceImages : (project.referenceImages || []);

      const updatedProject: StudioProject = {
        ...project,
        sourceContent: trimmed,
        sourceFileName: fileName || project.sourceFileName || (fileName === undefined && !project.sourceFileName ? "Texto inserido" : project.sourceFileName),
        referenceImages: imagesToStore,
        title,
        subject,
        gradeLevel,
        objective,
        exercise,
        schoolYear,
        bimester,
        subtitle,
        teacher,
        curriculum,
        observations,
        updatedAt: new Date().toISOString(),
      };

      const saved = saveStudioProject(userId, updatedProject);
      setProject(saved);
      setDirty(false);

      const actionLabel = kind === "slides" ? "Criar aula com IA" : "Gerar estrutura da aula";
      setMessage(imagesToStore.length > 0
        ? `Material carregado (${imagesToStore.length} imagem(ns) extraída(s))! Clique em "${actionLabel}" para continuar.`
        : `Material carregado com sucesso! Clique em "${actionLabel}" para continuar.`);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Não foi possível processar o conteúdo. Tente novamente.");
    } finally {
      if (alive.current) {
        setImporting(false);
        setImportStatus("");
      }
    }
  }

  async function importText(file?: File) {
    if (!file) return;
    setImporting(true);
    setError("");
    setMessage("");
    setImportStatus("Lendo documento e extraindo imagens…");
    try {
      const doc = await withStudioDeadline(readStudioReference(file), 130000, "A leitura do documento excedeu o tempo de espera. Tente importar novamente.");
      if (!alive.current) return;
      await processReferenceContent(doc.text, file.name, doc.images);
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : "Não foi possível ler este documento. Tente outro arquivo.");
        setImporting(false);
        setImportStatus("");
      }
    }
  }

  const generate = useCallback(async () => {
    if (!project.sourceContent?.trim()) {
      setError("Insira o conteúdo de referência (envie um documento PDF/Word ou cole o texto) para que a IA preencha os slides.");
      return;
    }
    setError("");
    const corporate = project.line === "Educação Corporativa";
    const kids = project.line === "Konecta Kids";
    const projectToGenerate: StudioProject = {
      ...project,
      title: project.title.trim() || "Aula a partir da Referência",
      subject: project.subject.trim() || "Geral",
      gradeLevel: project.gradeLevel || (corporate ? "" : "Fundamental 2"),
      objective: project.objective.trim() || `Compreender os conceitos de ${project.title.trim() || "conteúdo de referência"}`,
      exercise: project.exercise?.trim() || (project.line === "Konectar.me" && kind === "slides" ? "" : "Exercício prático de fixação dos conceitos"),
      schoolYear: project.schoolYear?.trim() || (corporate ? "" : "Ano regular"),
      bimester: project.bimester?.trim() || (corporate ? "" : "1º Bimestre"),
      subtitle: project.subtitle?.trim() || (corporate ? "Capacitação" : ""),
      teacher: project.teacher?.trim() || (kids ? "Professor(a)" : ""),
      targetSlideCount: project.targetSlideCount || 10,
      updatedAt: new Date().toISOString(),
    };
    try {
      const saved = saveStudioProject(userId, projectToGenerate);
      setProject(saved);
      setDirty(false);
      startStudioJob(userId, saved);
      if (kind === "slides") setStage("progress");
      setMessage("A IA está preenchendo os slides a partir do conteúdo de referência...");
      if (!projectId) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("id", saved.id);
        setSearchParams(nextParams, { replace: true });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a geração.");
    }
  }, [project, userId, kind, setError, setProject, setDirty, setStage, setMessage, projectId, searchParams, setSearchParams]);

  async function handleResendMaterial({ file, text, updateBriefing }: { file?: File; text?: string; updateBriefing: boolean }) {
    setImporting(true);
    setError("");
    setMessage("");
    try {
      let content = "";
      let fileName = "";
      let images: ExtractedReferenceImage[] = [];

      if (file) {
        setImportStatus("Lendo novo documento e extraindo imagens…");
        const doc = await withStudioDeadline(readStudioReference(file), 130000, "A leitura do documento excedeu o tempo de espera. Tente importar novamente.");
        if (!alive.current) return;
        content = doc.text;
        fileName = file.name;
        images = doc.images || [];
      } else if (text) {
        content = text.trim();
        fileName = "Texto inserido";
        images = [];
      }

      if (!content.trim()) {
        throw new Error("O material enviado está vazio. Verifique o arquivo ou texto.");
      }

      setImportStatus("Identificando tema e dados do briefing…");
      let extracted: StudioBriefing = {};
      if (updateBriefing) {
        try {
          extracted = await extractStudioBriefing(content, project.line || "Konectar.me");
        } catch (cause) {
          console.warn("Extração de briefing automática parcial no reenvio:", cause);
        }
      }

      if (!alive.current) return;

      const patch: StudioBriefing = updateBriefing ? extracted : mergeStudioBriefing(project, extracted);
      const corporate = project.line === "Educação Corporativa";
      const kids = project.line === "Konecta Kids";

      const title = patch.title?.trim() || project.title.trim() || "Aula a partir da Referência";
      const subject = patch.subject?.trim() || project.subject.trim() || "Geral";
      const gradeLevel = patch.gradeLevel || project.gradeLevel || (corporate ? "" : "Fundamental 2");
      const objective = patch.objective?.trim() || project.objective.trim() || `Compreender os conceitos essenciais de ${title}`;
      const exercise = patch.exercise?.trim() || project.exercise?.trim() || (project.line === "Konectar.me" && kind === "slides" ? "" : "Exercício prático de fixação e reflexão sobre o conteúdo");
      const schoolYear = patch.schoolYear?.trim() || project.schoolYear?.trim() || (corporate ? "" : "Ano regular");
      const bimester = patch.bimester?.trim() || project.bimester?.trim() || (corporate ? "" : "1º Bimestre");
      const subtitle = patch.subtitle?.trim() || project.subtitle?.trim() || (corporate ? "Capacitação Profissional" : "");
      const teacher = patch.teacher?.trim() || project.teacher?.trim() || (kids ? "Professor(a)" : "");
      const curriculum = patch.curriculum?.trim() || project.curriculum?.trim() || "";
      const observations = patch.observations?.trim() || project.observations?.trim() || "";

      const updatedProject: StudioProject = {
        ...project,
        sourceContent: content,
        sourceFileName: fileName || project.sourceFileName,
        referenceImages: images,
        title,
        subject,
        gradeLevel,
        objective,
        exercise,
        schoolYear,
        bimester,
        subtitle,
        teacher,
        curriculum,
        observations,
        alerts: [],
        updatedAt: new Date().toISOString(),
      };

      const saved = saveStudioProject(userId, updatedProject);
      setProject(saved);
      setDirty(false);
      if (!projectId) setSearchParams({ id: saved.id }, { replace: true });

      setImportStatus("Gerando nova apresentação a partir do material reenviado…");
      startStudioJob(userId, saved);
      if (kind === "slides") setStage("progress");
      setMessage("Novo material recebido! A IA está estruturando e recriando os slides da aula.");
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : "Não foi possível processar o novo material.");
      }
      throw cause;
    } finally {
      if (alive.current) {
        setImporting(false);
        setImportStatus("");
      }
    }
  }

  useEffect(() => {
    if (searchParams.get("retry") !== "1" || autoRetried.current || generating) return;
    autoRetried.current = true;
    if (!project.sourceContent?.trim()) {
      setError("A apostila não está mais disponível neste rascunho. Envie o arquivo novamente para tentar gerar a aula.");
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("retry");
    setSearchParams(nextParams, { replace: true });
    void generate();
  }, [searchParams, setSearchParams, project.sourceContent, generating, generate]);

  const warnings = studioWarnings(project);
  const editSlide = (id: string, patch: Partial<StudioSlide>) => {
    setProject(current => ({ ...current, slides: current.slides.map(item => item.id === id ? { ...item, ...patch } : item) }));
    setDirty(true); setMessage("");
  };
  const editScene = (id: string, patch: Partial<StudioScene>) => update({ scenes: project.scenes.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const slug = auth.currentUser?.email?.split("@")[0].replace(/\./g, "-") || "usuario";

  if (kind === "slides") {
    return (
      <div id="main-page-wrapper" className="generator-workspace flex flex-col overflow-hidden relative print:h-auto print:block print:overflow-visible print:!bg-white">
        {previewOpen && <StudioDeckPreview project={project} onClose={() => setPreviewOpen(false)} />}
        <StudioResendModal
          isOpen={showResendModal}
          onClose={() => setShowResendModal(false)}
          currentFileName={project.sourceFileName}
          currentContentLength={project.sourceContent?.length}
          line={project.line}
          onSubmit={handleResendMaterial}
        />

        {/* Toolbar no padrão visual do Game Canvas */}
        <header className="generator-toolbar print:hidden relative z-20">
          <div className="generator-toolbar-brand">
            <button
              type="button"
              aria-label={returnLabel}
              title={returnLabel}
              onClick={() => (dirty || generating) ? setShowUnsavedModal(true) : navigate(returnPath)}
            >
              <ArrowLeft size={18} />
            </button>
            <span className="generator-brand-icon" title="Mind Canvas">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(255, 255, 255, 0.22)" stroke="#ffffff" />
                <path d="M2 17l10 5 10-5" stroke="#ffffff" />
                <path d="M2 12l10 5 10-5" stroke="#ffffff" />
              </svg>
            </span>
            <span className="generator-brand-name">MIND CANVAS</span>
            <span className="generator-toolbar-divider" />
            <span className="generator-product-name"><Presentation size={17} /> Slides Canvas</span>
          </div>

          <div className="generator-document-status">
            <span className={dirty ? 'is-unsaved' : ''} />
            {generating ? 'Criando slides com IA' : importing ? importStatus : dirty ? 'Alterações não salvas' : hasGeneratedSlides ? 'Slides prontos' : 'Novo projeto'}
          </div>

          <div className="generator-toolbar-actions">
            {stage === "edit" ? (
              <>
                {Boolean(project.sourceContent?.trim()) && (
                  <button
                    type="button"
                    className={`generator-action-btn ${!hasGeneratedSlides ? "generator-action-btn--primary" : ""}`}
                    disabled={generating || importing}
                    onClick={() => void generate()}
                    title="Preencher todos os slides com IA a partir do material de referência"
                  >
                    {generating ? <LoaderCircle size={14} className="studio-editor__spinner" /> : <Sparkles size={14} />}
                    <span>{hasGeneratedSlides ? "Recriar com IA" : "Gerar slides com IA"}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="generator-action-btn"
                  title="Reenviar material de referência"
                  onClick={() => setShowResendModal(true)}
                >
                  <Upload size={14} /> <span>Reenviar material</span>
                </button>
                <button
                  type="button"
                  className="generator-action-btn generator-action-btn--primary"
                  disabled={generating || importing}
                  onClick={save}
                  title="Salvar alterações"
                >
                  <Save size={14} /> <span>Salvar</span>
                </button>
                <button
                  type="button"
                  className="generator-action-btn"
                  disabled={generating || importing || exporting}
                  onClick={() => void download("pptx")}
                  title="Baixar apresentação em PowerPoint (.pptx)"
                >
                  {exporting ? <LoaderCircle size={14} className="studio-editor__spinner" /> : <Download size={14} />}
                  <span>PowerPoint (.pptx)</span>
                </button>
                <button
                  type="button"
                  className="generator-action-btn"
                  disabled={generating || importing || exporting}
                  onClick={() => void download("pdf")}
                  title="Baixar apresentação em PDF"
                >
                  <FileText size={14} /> <span>PDF</span>
                </button>
                <button
                  type="button"
                  className="generator-action-btn generator-action-btn--danger"
                  disabled={generating || importing}
                  onClick={() => setShowDeleteModal(true)}
                  title="Excluir projeto"
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : stage === "prepare" ? (
              <>
                {hasGeneratedSlides && (
                  <button
                    type="button"
                    className="generator-action-btn"
                    onClick={() => setStage("edit")}
                    title="Ir para o editor de slides"
                  >
                    <Pencil size={14} /> <span>Editar slides</span>
                  </button>
                )}
              </>
            ) : null}
          </div>
        </header>

        {/* Modal de confirmacao para sair sem salvar */}
        {showUnsavedModal && (
          <div className="generator-confirm-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="generator-confirm-dialog p-8 max-w-sm w-full relative overflow-hidden">
              <div className="relative z-10 flex flex-col items-center">
                <div className="generator-confirm-icon flex items-center justify-center mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <ArrowLeft className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div className="text-center mb-6">
                  <h3 className="generator-confirm-title text-xl font-bold mb-2 text-white">Sair sem salvar?</h3>
                  <p className="generator-confirm-description text-sm text-slate-400">
                    Existem alterações não salvas. Se você sair agora, você perderá as modificações recentes.
                  </p>
                </div>
                <div className="w-full space-y-2">
                  <button
                    type="button"
                    className="generator-action-btn generator-action-btn--primary w-full justify-center py-2.5"
                    onClick={() => {
                      save();
                      setShowUnsavedModal(false);
                      navigate(returnPath);
                    }}
                  >
                    Salvar e sair
                  </button>
                  <button
                    type="button"
                    className="generator-action-btn w-full justify-center py-2.5 text-slate-300"
                    onClick={() => {
                      setShowUnsavedModal(false);
                      navigate(returnPath);
                    }}
                  >
                    Sair sem salvar
                  </button>
                  <button
                    type="button"
                    className="generator-action-btn w-full justify-center py-2.5 text-slate-400 bg-transparent border-transparent"
                    onClick={() => setShowUnsavedModal(false)}
                  >
                    Continuar editando
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de exclusao */}
        {showDeleteModal && (
          <div className="studio-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
            <div className="studio-modal">
              <div className="studio-modal__header">
                <div className="studio-modal__icon-wrap studio-modal__icon-wrap--danger">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h2 id="delete-project-title">Excluir projeto</h2>
                  <p>Tem certeza de que deseja excluir <strong>{project.title || "esta apresentação"}</strong>?</p>
                </div>
              </div>
              <p className="studio-modal__desc">
                Esta ação é irreversível. O projeto e todos os slides serão removidos permanentemente.
              </p>
              <div className="studio-modal__actions">
                <button type="button" className="studio-button studio-button--quiet" onClick={() => setShowDeleteModal(false)}>
                  Cancelar
                </button>
                <button type="button" className="studio-button studio-button--danger-solid" onClick={handleDeleteProject}>
                  Sim, excluir projeto
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace de conteudo */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto relative z-10 custom-scrollbar">
          {stage !== "edit" ? (
            <SlidesFlow
              project={project}
              job={job}
              stage={stage}
              recentProjects={recentProjects}
              fileInput={fileInput}
              progressClock={progressClock}
              importing={importing}
              importStatus={importStatus}
              error={error}
              message={message}
              exporting={exporting}
              onStage={setStage}
              onUpdate={update}
              onImport={file => { void importText(file); }}
              onPaste={text => { void processReferenceContent(text, "Texto colado", []); }}
              onGenerate={() => void generate()}
              onOpenProject={id => {
                setStage("edit");
                const from = searchParams.get("from");
                const nextParams = new URLSearchParams();
                nextParams.set("id", id);
                nextParams.set("stage", "edit");
                if (from) nextParams.set("from", from);
                navigate(`/studio/slides?${nextParams.toString()}`);
              }}
              onOpenResend={() => setShowResendModal(true)}
              onDownload={download}
              onSelectSlide={setSelectedSlideId}
            />
          ) : (
            <div className="studio-slides-workspace">
              {Boolean(!hasGeneratedSlides && project.sourceContent?.trim()) && (
                <div style={{ margin: "16px 24px 0", padding: "16px 20px", background: "linear-gradient(135deg, rgba(30, 58, 138, 0.75), rgba(49, 46, 129, 0.75))", border: "1px solid rgba(96, 165, 250, 0.4)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", color: "#fff", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <Sparkles style={{ color: "#fbbf24", flexShrink: 0 }} size={24} />
                    <div>
                      <strong style={{ display: "block", fontSize: "0.95rem", color: "#fff" }}>Material carregado: {project.sourceFileName || "Apostila"}</strong>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#bfdbfe" }}>A IA pode ler o conteúdo e preencher todos os 9 slides automaticamente com roteiro e ilustrações.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="generator-action-btn generator-action-btn--primary"
                    style={{ whiteSpace: "nowrap", padding: "8px 18px", fontSize: "0.88rem" }}
                    disabled={generating || importing}
                    onClick={() => void generate()}
                  >
                    {generating ? <LoaderCircle size={15} className="studio-editor__spinner" /> : <Sparkles size={15} />}
                    <span>Gerar aula agora</span>
                  </button>
                </div>
              )}
              <StudioSlideEditor
                project={project}
                userId={userId}
                initialSlideId={selectedSlideId}
                onSlidesChange={slides => update({ slides })}
                onSlideChange={editSlide}
                onProjectChange={update}
                onSelectSlide={setSelectedSlideId}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout hideSidebar={true}>
      {previewOpen && <StudioDeckPreview project={project} onClose={() => setPreviewOpen(false)} />}
      <StudioResendModal
        isOpen={showResendModal}
        onClose={() => setShowResendModal(false)}
        currentFileName={project.sourceFileName}
        currentContentLength={project.sourceContent?.length}
        line={project.line}
        onSubmit={handleResendMaterial}
      />
      <div className={`studio-editor studio-editor--${kind}`}>
        <header className="studio-editor__heading">
          <div>
            <Link to={returnPath} className="studio-editor__back"><ArrowLeft size={15} /> {returnLabel}</Link>
            <div className="studio-editor__title"><span><Icon size={23} /></span><div><p>MIND CANVAS / ESTÚDIO</p><h1>{info.title}</h1></div></div>
            <p className="studio-editor__subtitle">{info.subtitle}</p>
          </div>
          <div className="studio-editor__actions">
            {kind !== "roteiro" && <button type="button" className="studio-button studio-button--quiet" disabled={generating || importing || project.slides.length === 0} onClick={() => setPreviewOpen(true)}><MonitorPlay size={16} /> Prévia dos slides</button>}
            {kind !== "roteiro" && <button type="button" className="studio-button studio-button--quiet" disabled={generating || importing || exporting} onClick={() => void download("pdf")}><FileText size={16} /> Exportar PDF</button>}
            <button type="button" className="studio-button studio-button--quiet" disabled={generating || importing || exporting} onClick={() => void download()}>{exporting ? <LoaderCircle size={16} className="studio-editor__spinner" /> : <Download size={16} />}{exporting ? "Preparando arquivo…" : "PowerPoint editável"}</button>
            <button type="button" className="studio-button studio-button--primary" onClick={save} disabled={generating || importing}><Save size={16} /> Salvar rascunho</button>
            <button type="button" className="studio-button studio-button--danger" onClick={() => setShowDeleteModal(true)} disabled={generating || importing} title="Excluir projeto"><Trash2 size={16} /> Excluir projeto</button>
          </div>
        </header>

        {showDeleteModal && (
          <div className="studio-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
            <div className="studio-modal">
              <div className="studio-modal__header">
                <div className="studio-modal__icon-wrap studio-modal__icon-wrap--danger">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h2 id="delete-project-title">Excluir projeto</h2>
                  <p>Tem certeza de que deseja excluir <strong>{project.title || "este projeto"}</strong>?</p>
                </div>
              </div>
              <p className="studio-modal__desc">
                Esta ação é irreversível. O projeto e todos os slides serão removidos permanentemente deste navegador.
              </p>
              <div className="studio-modal__actions">
                <button
                  type="button"
                  className="studio-button studio-button--quiet"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="studio-button studio-button--danger-solid"
                  onClick={handleDeleteProject}
                >
                  Sim, excluir projeto
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="studio-editor__storage"><span className={dirty ? "studio-editor__status studio-editor__status--dirty" : "studio-editor__status"}>{dirty ? <span /> : <Check size={13} />}{dirty ? "Alterações não salvas" : initial ? "Rascunho local" : "Novo projeto"}</span><span>Salvamento manual · disponível apenas neste navegador e nesta conta.</span></div>
        {job && job.status !== "ready" && <div role="status" className={`studio-editor__notice${job.status === "error" ? " studio-editor__notice--error" : ""}`}>{job.message}{generating && " Você pode sair desta tela e continuar pelo menu."}</div>}
        {error && <div role="alert" className="studio-editor__notice studio-editor__notice--error">{error}</div>}
        {message && (!job || job.status !== "ready" || job.message !== message) && <div role="status" className="studio-editor__notice">{message}</div>}
        {importing && <div role="status" className="studio-editor__notice">{importStatus}</div>}

        <nav className="studio-workflow" aria-label="Etapas de criação">
          <button type="button" aria-current={stage === "prepare" ? "step" : undefined} onClick={() => setStage("prepare")}><span>01</span><div><strong>Preparar a aula</strong><small>Briefing e documento de referência</small></div></button>
          <button type="button" aria-current={stage === "edit" ? "step" : undefined} onClick={() => setStage("edit")}><span>02</span><div><strong>Editar e revisar</strong><small>{project.scenes.length} cenas · conteúdo, fala e notas</small></div></button>
        </nav>
        <div className={`studio-editor__columns studio-editor__columns--${stage}`}>

          <aside className="studio-editor__briefing">
            <section className="studio-panel">
              <div className="studio-panel__heading"><span className="studio-panel__step">01</span><div><h2>Briefing da aula</h2><p>Envie o documento para preencher os campos automaticamente e revise antes de gerar.</p></div></div>
              <fieldset disabled={generating || importing} className="studio-editor__fieldset">
                <label className="studio-field">Linha INNYX<select value={project.line || "Konectar.me"} onChange={event => update({ line: event.target.value, ...(event.target.value === "Konectar.me" ? { targetSlideCount: Math.min(10, Math.max(9, project.targetSlideCount || 10)) } : {}) })}><option>Konectar.me</option><option>Konecta Kids</option><option>Educação Corporativa</option></select></label>
                <label className="studio-field">Título do projeto<input value={project.title} maxLength={200} onChange={(event) => update({ title: event.target.value })} placeholder="Ex.: Uma viagem pelo sistema solar" /></label>
                <label className="studio-field">Matéria<input value={project.subject} maxLength={100} onChange={(event) => update({ subject: event.target.value })} placeholder="Ex.: Ciências" /></label>
                {project.line !== "Educação Corporativa" && <label className="studio-field">Etapa de ensino<select value={project.gradeLevel} onChange={(event) => update({ gradeLevel: event.target.value })}><option value="">Selecione uma etapa</option><option>Educação Infantil</option><option>Fundamental 1</option><option>Fundamental 2</option><option>Ensino Médio</option><option>Ensino Superior</option><option>Educação Profissional</option></select></label>}
                {project.line !== "Educação Corporativa" && <label className="studio-field">Ano/série<input maxLength={300} value={project.schoolYear || ""} onChange={event => update({ schoolYear: event.target.value })} /></label>}
                {project.line !== "Educação Corporativa" && <label className="studio-field">Bimestre<input maxLength={300} value={project.bimester || ""} onChange={event => update({ bimester: event.target.value })} /></label>}
                {project.line === "Konecta Kids" && <label className="studio-field">Professor(a)<input maxLength={300} value={project.teacher || ""} onChange={event => update({ teacher: event.target.value })} /></label>}
                {project.line === "Educação Corporativa" && <label className="studio-field">Subtítulo da capa (Corporativa)<input maxLength={300} value={project.subtitle || ""} onChange={event => update({ subtitle: event.target.value })} /></label>}
                {kind !== "roteiro" && (
                  <label className="studio-field">
                    {project.line === "Konectar.me" ? "Quantidade de slides (Aula Síntese: 9 ou 10)" : "Quantidade de slides (mínimo 5)"}
                    <input
                      ref={slideCountInputRef}
                      type="number"
                      min={project.line === "Konectar.me" ? 9 : 5}
                      max={project.line === "Konectar.me" ? 10 : 30}
                      value={slideCountText}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setSlideCountText(raw);
                        const val = parseInt(raw, 10);
                        if (!Number.isNaN(val) && val >= 1 && val <= 50) {
                          update({ targetSlideCount: val });
                        }
                      }}
                      onBlur={() => {
                        const val = parseInt(slideCountText, 10);
                        const minSlides = project.line === "Konectar.me" ? 9 : 5;
                        const maxSlides = project.line === "Konectar.me" ? 10 : 30;
                        const safeVal = Number.isNaN(val) ? 10 : Math.max(minSlides, Math.min(maxSlides, val));
                        setSlideCountText(String(safeVal));
                        update({ targetSlideCount: safeVal });
                      }}
                      placeholder="10"
                    />
                  </label>
                )}
                <label className="studio-field">Código da BNCC (sem parênteses, separados por vírgula)<input maxLength={400} value={project.curriculum || ""} onChange={event => update({ curriculum: formatBnccCodes(event.target.value) })} placeholder="Ex.: EF06MA18, EF06MA19" /></label>
                <label className="studio-field">Exercício escolhido / estudo de caso<textarea rows={2} maxLength={4000} value={project.exercise || ""} onChange={event => update({ exercise: event.target.value })} /></label>
                <label className="studio-field">Observações do professor<textarea rows={2} maxLength={4000} value={project.observations || ""} onChange={event => update({ observations: event.target.value })} /></label>
                <label className="studio-field">Objetivo de aprendizagem<textarea rows={3} maxLength={4000} value={project.objective} onChange={(event) => update({ objective: event.target.value })} placeholder="O que os estudantes devem compreender ao final da aula?" /></label>
              </fieldset>
            </section>
            <section className="studio-panel">
              <div className="studio-panel__heading">
                <span className="studio-panel__step"><Sparkles size={16} /></span>
                <div>
                  <h2>Conteúdo de referência</h2>
                  <p>Ao inserir o conteúdo, a IA preenche os slides e o briefing a partir da referência.</p>
                </div>
              </div>

              {/* Abas de seleção de formato de entrada */}
              <div className="studio-reference-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={inputMode === "file" ? "active" : ""}
                  onClick={() => setInputMode("file")}
                  disabled={generating || importing}
                >
                  <Upload size={14} /> Enviar documento (PDF/Word)
                </button>
                <button
                  type="button"
                  role="tab"
                  className={inputMode === "text" ? "active" : ""}
                  onClick={() => setInputMode("text")}
                  disabled={generating || importing}
                >
                  <FileText size={14} /> Colar texto
                </button>
              </div>

              {inputMode === "file" ? (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    hidden
                    onChange={(event) => { void importText(event.target.files?.[0]); event.target.value = ""; }}
                  />
                  <button
                    type="button"
                    className="studio-upload"
                    disabled={generating || importing}
                    onClick={() => fileInput.current?.click()}
                  >
                    {importing ? <LoaderCircle size={28} className="studio-editor__spinner" /> : <Upload size={28} />}
                    <strong>{importing ? importStatus : project.sourceFileName ? "Substituir documento de referência" : "Selecionar documento (PDF ou Word)"}</strong>
                    <span>Envie o arquivo para extrair o briefing e as imagens. Depois clique no botão abaixo para gerar · PDF até 20 MB, Word até 50 MB</span>
                  </button>
                </>
              ) : (
                <div className="studio-reference-paste">
                  <textarea
                    rows={6}
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    placeholder="Cole aqui o texto ou trecho da apostila / artigo de referência..."
                    disabled={generating || importing}
                  />
                  <button
                    type="button"
                    className="studio-button studio-button--primary studio-button--full"
                    disabled={generating || importing || !pastedContent.trim()}
                    onClick={() => void processReferenceContent(pastedContent, "Texto colado", [])}
                  >
                    {importing ? <LoaderCircle size={16} className="studio-editor__spinner" /> : <Sparkles size={16} />}
                    {importing ? importStatus : "Carregar conteúdo de referência"}
                  </button>
                </div>
              )}

              {/* Exibição do documento / texto atualmente inserido */}
              {project.sourceContent && (
                <div className="studio-reference-file">
                  <FileText size={22} />
                  <div>
                    <strong>{project.sourceFileName || "Conteúdo de referência ativo"}</strong>
                    <small>
                      {project.sourceContent.length.toLocaleString("pt-BR")} caracteres de referência
                      {project.referenceImages && project.referenceImages.length > 0
                        ? ` · ${project.referenceImages.length} imagem(ns) extraída(s)`
                        : " · pronto para os slides"}
                    </small>
                  </div>
                  <button
                    type="button"
                    disabled={generating || importing}
                    aria-label="Remover documento"
                    title="Remover conteúdo de referência"
                    onClick={() => update({ sourceContent: "", sourceFileName: undefined, referenceImages: [] })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Miniaturas das imagens originais extraídas do documento de referência */}
              {project.referenceImages && project.referenceImages.length > 0 && (
                <div className="studio-reference-gallery">
                  <div className="studio-reference-gallery__header">
                    <Images size={15} />
                    <strong>Imagens originais do material ({project.referenceImages.length})</strong>
                  </div>
                  <p className="studio-reference-gallery__help">
                    Estas imagens foram retiradas diretamente do seu arquivo original e serão associadas aos slides de conteúdo da aula.
                  </p>
                  <div className="studio-reference-gallery__list">
                    {project.referenceImages.map((img, idx) => (
                      <div key={img.id || idx} className="studio-reference-gallery__item" title={img.name}>
                        <button
                          type="button"
                          className="studio-reference-gallery__delete"
                          title={`Excluir ${img.name}`}
                          aria-label={`Excluir ${img.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const remaining = (project.referenceImages || []).filter(item => item.id !== img.id);
                            update({ referenceImages: remaining });
                          }}
                        >
                          <X size={11} />
                        </button>
                        <img src={img.url} alt={img.name} />
                        <span>{img.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {project.sourceContent && (
                <details className="studio-reference-details">
                  <summary>Ver texto de referência inserido</summary>
                  <div className="studio-reference-preview">
                    {project.sourceContent.slice(0, 1000)}
                    {project.sourceContent.length > 1000 && "..."}
                  </div>
                </details>
              )}

              <p className="studio-editor__hint">
                A IA extrai os dados da referência, preenche o briefing e constrói a sequência de slides completa com títulos, textos, notas e imagens.
              </p>

              <button
                type="button"
                className="studio-button studio-button--primary studio-button--full"
                disabled={generating || importing || !project.sourceContent}
                aria-busy={generating || importing}
                onClick={() => void generate()}
              >
                {(generating || importing) ? <LoaderCircle size={17} className="studio-editor__spinner" /> : <img src="/logo-innyx-icon.png" alt="INNYX" style={{ width: 16, height: 16, objectFit: "contain", filter: "brightness(0) invert(1)" }} />}
                {importing ? "Lendo material enviado…" : generating ? "Preenchendo slides com a IA…" : project.slides.some(s => s.content) ? "Regerar estrutura dos slides" : "Gerar estrutura da aula"}
              </button>

              <button
                type="button"
                className="studio-button studio-button--quiet studio-button--full"
                onClick={() => setStage("edit")}
              >
                Ir para edição dos slides <ArrowUpRight size={16} />
              </button>
            </section>
            {kind === "pacote" && <section className="studio-editor__game"><Gamepad2 size={20} /><h3>Complete com um jogo</h3><p>Crie o Game Canvas no editor de jogos. O planejamento do jogo é salvo separadamente.</p><Link to={`/canvas-generator/${slug}`}>Abrir editor de jogos <ArrowUpRight size={15} /></Link></section>}
          </aside>

          <section className="studio-panel studio-editor__content">
            <div className="studio-panel__heading studio-panel__heading--spread"><div className="studio-editor__content-label"><span className="studio-panel__step">02</span><div><h2>Planejamento do conteúdo</h2><p>Organize, revise e refine cada etapa.</p></div></div><span className="studio-editor__count">{activeTab === "slides" ? `${project.slides.length} slides` : `${project.scenes.length} cenas`}</span></div>
            {kind === "pacote" && <div className="studio-editor__tabs" role="tablist" aria-label="Conteúdos do pacote"><button type="button" role="tab" aria-selected={activeTab === "slides"} onClick={() => setActiveTab("slides")}><MonitorPlay size={16} /> Slides Canvas</button><button type="button" role="tab" aria-selected={activeTab === "roteiro"} onClick={() => setActiveTab("roteiro")}><Video size={16} /> Roteiro de gravação</button></div>}
            <details className="studio-editor__notice"><summary>Checklist INNYX · {warnings.length} pendências</summary><p>Aula de 12 minutos · quarto direito livre para o professor. Revise fontes, imagens e fidelidade à apostila.</p><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
            <fieldset disabled={generating || importing} className="studio-editor__fieldset">
              {activeTab === "slides" ? <StudioSlideEditor project={project} userId={userId} onSlidesChange={slides => update({ slides })} onSlideChange={editSlide} onProjectChange={update} /> : project.scenes.map((scene, index) => (
                <details className="studio-item studio-item--collapsible" key={scene.id} open={index === 0}>
                  <summary className="studio-item__heading"><span>CENA {String(index + 1).padStart(2, "0")}</span><strong className="studio-item__summary-title">{scene.title || "Nova cena"}</strong><div><button type="button" title="Mover cena para cima" aria-label={`Mover cena ${index + 1} para cima`} disabled={index === 0} onClick={() => update({ scenes: moveItem(project.scenes, index, -1) })}><ArrowUp size={15} /></button><button type="button" title="Mover cena para baixo" aria-label={`Mover cena ${index + 1} para baixo`} disabled={index === project.scenes.length - 1} onClick={() => update({ scenes: moveItem(project.scenes, index, 1) })}><ArrowDown size={15} /></button><button type="button" title="Excluir cena" aria-label={`Excluir cena ${index + 1}`} onClick={() => update({ scenes: project.scenes.filter((item) => item.id !== scene.id) })}><Trash2 size={15} /></button></div></summary>
                  <div className="studio-item__scene-title"><label className="studio-field">Título da cena<input value={scene.title} maxLength={300} onChange={(event) => editScene(scene.id, { title: event.target.value })} placeholder="O que acontece nesta cena?" /></label><label className="studio-field">Tempo estimado<input value={scene.duration} maxLength={50} onChange={(event) => editScene(scene.id, { duration: event.target.value })} placeholder="Ex.: 30s" /></label></div>
                  <label className="studio-field">Fala / teleprompter<textarea value={scene.speech} rows={4} maxLength={20000} onChange={(event) => editScene(scene.id, { speech: event.target.value })} placeholder="Escreva a fala do apresentador exatamente como será gravada." /></label>
                  <label className="studio-field studio-field--notes">Visual e direção<textarea value={scene.visual} rows={3} maxLength={20000} onChange={(event) => editScene(scene.id, { visual: event.target.value })} placeholder="Enquadramento, texto em tela, imagens de apoio e transições." /></label>
                </details>
              ))}
              {activeTab === "roteiro" && project.scenes.length === 0 && <div className="studio-editor__empty"><FileText size={30} /><h3>Seu conteúdo começa aqui</h3><p>Adicione o primeiro item ou crie uma estrutura a partir do briefing.</p></div>}
              {activeTab === "roteiro" && <button type="button" className="studio-editor__add" onClick={() => update({ scenes: [...project.scenes, newScene()] })}><Plus size={17} /> Adicionar cena</button>}
            </fieldset>
            <div className="studio-editor__export-note"><Download size={16} /><p>Baixe a apresentação em PowerPoint no modelo da linha INNYX, com textos editáveis e notas do apresentador. Para Konecta Kids, usamos o modelo oficial de capa, objetivo/BNCC, conteúdo e encerramento. Revise as imagens geradas e as notas antes de gravar.</p></div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

export default function StudioEditor({ kind }: { kind: StudioKind }) {
  const [params] = useSearchParams();
  const userId = auth.currentUser?.uid || "";
  const projectId = params.get("id");
  return <StudioWorkspace key={`${userId}:${kind}:${projectId || params.get("linha") || "new"}`} kind={kind} userId={userId} projectId={projectId} />;
}



