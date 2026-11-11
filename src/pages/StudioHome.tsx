import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildEncryptedUrl } from "../lib/routeCrypto";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Package,
  Presentation,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  Video,
  X,
} from "../lib/icons";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Layout } from "../components/ui/Layout";
import { auth, db, functions } from "../lib/firebase";
import { deleteStudioProject, getStudioProjects, isStudioProjectSynced } from "../lib/studioProjects";
import { removeStudioJob } from "../lib/studioJobs";
import { isMasterUser, isUserDeactivated, isUserAdmin } from "../lib/studioNavigation";
import type { StudioProject } from "../lib/studioProjects";
import type { Project } from "../types";

type Section = "inicio" | "projetos" | "modelos" | "ranking";
type ProjectKind = "jogo" | "slides" | "roteiro" | "pacote";
type FilterKind = "todos" | ProjectKind | "materiais";

interface RecentProject {
  id: string;
  title: string;
  kind: ProjectKind;
  detail: string;
  subject: string;
  grade: string;
  updatedAt: Date;
  href: string;
  downloadHref?: string;
  material?: string;
  local?: boolean;
  userId?: string;
  authorName?: string;
  authorEmail?: string;
  authorPhoto?: string | null;
  isOtherUser?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  count: number;
  photoURL?: string | null;
  email?: string | null;
  disabled?: boolean;
  role?: "master" | "admin" | "professor";
}

const headings: Record<Section, { prefix: string; highlight: string; subtitle: React.ReactNode }> = {
  inicio: {
    prefix: "O que vamos ",
    highlight: "planejar hoje?",
    subtitle: (
      <>
        Transforme o conteúdo da apostila em <span className="studio-text-highlight">experiências ativas</span>,{" "}
        <span className="studio-text-highlight">jogos</span> e aulas completas alinhadas à BNCC.
      </>
    ),
  },
  projetos: {
    prefix: "Meus Projetos & ",
    highlight: "Materiais Didáticos",
    subtitle: (
      <>
        Central pedagógica unificada: gerencie <span className="studio-text-highlight">jogos</span>,{" "}
        <span className="studio-text-highlight">slides</span>, roteiros de gravação e apostilas em um só lugar.
      </>
    ),
  },
  modelos: {
    prefix: "Estruturas Pedagógicas ",
    highlight: "Oficiais",
    subtitle: (
      <>
        Modelos didáticos prontos e padronizados para engajar turmas do{" "}
        <span className="studio-text-highlight">Ensino Fundamental ao Médio</span>.
      </>
    ),
  },
  ranking: {
    prefix: "Inspiração Docente & ",
    highlight: "Engajamento",
    subtitle: (
      <>
        Reconhecimento das <span className="studio-text-highlight">criações pedagógicas</span> e metodologias ativas desenvolvidas pela equipe.
      </>
    ),
  },
};

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "seconds" in value) return new Date(Number((value as { seconds: number }).seconds) * 1000);
  const date = new Date(typeof value === "string" || typeof value === "number" ? value : 0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function getRows(games: Project[], drafts: StudioProject[], userSlug: string, section: Section = "inicio"): RecentProject[] {
  return [
    ...games.map(project => ({
      id: `game-${project.id}`,
      title: project.title || "Canvas sem título",
      kind: "jogo" as const,
      detail: `Jogo - ${project.formData?.gameType || "Canvas"}`,
      subject: project.formData?.subject || "—",
      grade: project.formData?.gradeLevel?.replace("Ensino ", "").replace("Fundamental ", "Fund. ") || "—",
      updatedAt: parseDate(project.updatedAt || project.createdAt),
      href: buildEncryptedUrl(`/canvas-generator/${userSlug}`, { id: project.id, from: section === "projetos" ? "projetos" : undefined }),
      downloadHref: buildEncryptedUrl(`/canvas-generator/${userSlug}`, { id: project.id, from: section === "projetos" ? "projetos" : undefined, download: "1" }),
      material: project.pdfFileName || undefined,
    })),
    ...drafts.map(project => ({
      id: `studio-${project.id}`,
      title: project.title?.trim() && !/^(Projeto|Rascunho) sem título$/i.test(project.title.trim()) ? project.title : project.slides?.find(slide => slide.type === "capa")?.title?.trim() || project.slides?.[0]?.title?.trim() || "Rascunho sem título",
      kind: project.kind,
      detail: project.kind === "slides" ? "Slides Canvas" : project.kind === "roteiro" ? "Roteiro de gravação" : "Pacote de aula",
      subject: project.subject || "—",
      grade: project.gradeLevel?.replace("Ensino ", "").replace("Fundamental ", "Fund. ") || "—",
      updatedAt: parseDate(project.updatedAt),
      href: buildEncryptedUrl(`/studio/${project.kind}`, { id: project.id, stage: "edit", from: section === "projetos" ? "projetos" : undefined }),
      downloadHref: buildEncryptedUrl(`/studio/${project.kind}`, { id: project.id, stage: "edit", from: section === "projetos" ? "projetos" : undefined, download: "1" }),
      material: project.sourceContent?.trim() ? "Conteúdo-base do projeto" : undefined,
      local: !isStudioProjectSynced(project.id),
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function StudioHomeView({
  section = "inicio",
  games = [],
  drafts = [],
  otherUsersProjects = [],
  loading = false,
  error = "",
  userName = "",
  userSlug = "usuario",
  team = [],
  teamLoading = false,
  teamError = "",
  onToggleUserDisabled,
  onUpdateUserRole,
}: {
  section?: Section;
  games?: Project[];
  drafts?: StudioProject[];
  otherUsersProjects?: RecentProject[];
  loading?: boolean;
  error?: string;
  userName?: string;
  userSlug?: string;
  team?: TeamMember[];
  teamLoading?: boolean;
  teamError?: string;
  onToggleUserDisabled?: (userId: string, nextDisabled: boolean) => Promise<void> | void;
  onUpdateUserRole?: (userId: string, nextRole: "admin" | "professor") => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKind>("todos");
  const [projectScope, setProjectScope] = useState<"mine" | "others" | "all">("mine");
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>("all");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<RecentProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(true);
  const homeRef = useRef<HTMLDivElement>(null);

  const currentUser = auth.currentUser;
  const isMaster = isMasterUser(currentUser?.displayName || userName, currentUser?.email || (userSlug ? `${userSlug}@innyx.com` : ""));
  const isAdmin = isMaster || isUserAdmin(team.find(m => m.id === currentUser?.uid));

  const deactivatedCount = useMemo(() => team.filter(m => Boolean(m.disabled)).length, [team]);
  const visibleTeam = useMemo(() => {
    return team.filter(member => {
      if (member.disabled) {
        return isAdmin && showDeactivated;
      }
      return true;
    });
  }, [team, isAdmin, showDeactivated]);

  // GSAP micro-animations on mount
  useEffect(() => {
    if (!homeRef.current) return;
    const ctx = gsap.context(() => {
      // Gentle floating animation on package artwork
      gsap.to(".studio-package-art span", {
        y: -3,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.16,
      });
    }, homeRef);

    return () => ctx.revert();
  }, [section]);

  async function handleDeleteConfirmed() {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      if (projectToDelete.id.startsWith("studio-")) {
        const rawId = projectToDelete.id.replace(/^studio-/, "");
        if (auth.currentUser) {
          deleteStudioProject(auth.currentUser.uid, rawId);
          removeStudioJob(auth.currentUser.uid, rawId);
        }
      } else if (projectToDelete.kind === "jogo") {
        const rawId = projectToDelete.id.replace(/^game-/, "");
        await deleteDoc(doc(db, "projects", rawId));
      }
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  }

  const ownRows = useMemo(() => getRows(games, drafts, userSlug, section), [games, drafts, userSlug, section]);

  const otherAuthors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    otherUsersProjects.forEach(proj => {
      const uid = proj.userId || proj.authorEmail || proj.authorName || "unknown";
      const current = map.get(uid);
      if (current) {
        current.count += 1;
      } else {
        map.set(uid, {
          id: uid,
          name: proj.authorName || proj.authorEmail || "Educador(a)",
          count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [otherUsersProjects]);

  const rows = useMemo(() => {
    if (!isMaster || section !== "projetos" || projectScope === "mine") {
      return ownRows;
    }
    const base = projectScope === "others"
      ? otherUsersProjects
      : [...ownRows, ...otherUsersProjects].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    if (selectedAuthorId === "all") return base;
    return base.filter(row => (row.userId || row.authorEmail || row.authorName) === selectedAuthorId);
  }, [isMaster, section, projectScope, ownRows, otherUsersProjects, selectedAuthorId]);

  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // Materials extracted from all projects
  const materialRows = rows.filter(row => row.material && normalize(`${row.title} ${row.material} ${row.subject} ${row.authorName || ""}`).includes(normalize(search)));

  const matchingRows = rows.filter(row => {
    if (filter === "materiais") return false;
    const matchesFilter = filter === "todos" || row.kind === filter;
    const matchesSearch = normalize(`${row.title} ${row.subject} ${row.detail} ${row.material || ""} ${row.authorName || ""}`).includes(normalize(search));
    return matchesFilter && matchesSearch;
  });

  const visibleRows = section === "inicio" ? matchingRows.slice(0, 6) : matchingRows;
  const returnParam = section === "projetos" ? "?from=projetos" : "?from=inicio";
  const gameHref = `/canvas-generator/${userSlug}${returnParam}`;

  const cards = [
    {
      kind: "game",
      theme: "purple" as const,
      icon: Gamepad2,
      formatLabel: "FORMATO 01 · GAMIFICAÇÃO ATIVA",
      title: "Game Canvas",
      description: "Transforma os conteúdos e objetivos da apostila no roteiro de um jogo: mecânica, fases, desafios e feedbacks pedagógicos.",
      features: [
        "Matriz curricular e dinâmicas de jogo",
        "Regras e fases estruturadas por objetivo",
        "Banco pedagógico de perguntas e feedbacks",
      ],
      cta: "Criar jogo",
      href: gameHref,
      badge: games.length ? `${games.length} ${games.length === 1 ? "projeto" : "projetos"}` : "Principal",
    },
    {
      kind: "slides",
      theme: "blue" as const,
      icon: Presentation,
      formatLabel: "FORMATO 02 · SEQUÊNCIA DIDÁTICA",
      title: "Slides Canvas",
      description: "Estrutura a apresentação da aula: introdução, objetivos de aprendizagem, conceitos, exemplos e atividade.",
      features: [
        "Roteiro slide a slide orientado à BNCC",
        "Notas do professor e sugestões visuais",
        "PowerPoint no modelo oficial INNYX",
      ],
      cta: "Criar slides",
      href: `/studio/slides${returnParam}`,
      badge: "Novo",
    },
    {
      kind: "script",
      theme: "emerald" as const,
      icon: Video,
      formatLabel: "FORMATO 03 · AUDIOVISUAL PEDAGÓGICO",
      title: "Roteiro de Gravação",
      description: "Planeja a videoaula cena a cena: fala do educador, tempo sugerido, teleprompter e recursos visuais em tela.",
      features: [
        "Decupagem por cena com tempo pedagógico",
        "Falas prontas para o teleprompter do docente",
        "Indicações de tela, lettering e recursos de apoio",
      ],
      cta: "Em desenvolvimento",
      href: `/studio/roteiro${returnParam}`,
      badge: "Em desenvolvimento",
      inDevelopment: true,
    },
  ];

  // Integrated filter tabs: in "projetos" we offer all formats + materiais
  const filterTabs: { value: FilterKind; label: string; count?: number }[] = section === "projetos"
    ? [
        { value: "todos", label: "Todos os Projetos", count: rows.length },
        { value: "jogo", label: "Jogos", count: rows.filter(r => r.kind === "jogo").length },
        { value: "slides", label: "Slides", count: rows.filter(r => r.kind === "slides").length },
        { value: "roteiro", label: "Roteiros", count: rows.filter(r => r.kind === "roteiro").length },
        { value: "pacote", label: "Pacotes", count: rows.filter(r => r.kind === "pacote").length },
        { value: "materiais", label: "Materiais da Apostila", count: materialRows.length },
      ]
    : [
        { value: "todos", label: "Todos" },
        { value: "jogo", label: "Jogos" },
        { value: "slides", label: "Slides" },
        { value: "roteiro", label: "Roteiros" },
      ];

  return (
    <Layout>
      <div className="studio-home" ref={homeRef}>
        {/* Topline breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="studio-topline"
        >
          <span>
            <span className="studio-eyebrow">WORKSPACE PEDAGÓGICO</span>
            <ChevronRight size={12} />
            <span>
              {section === "inicio"
                ? "Visão geral"
                : section === "projetos"
                ? "Meus Projetos & Materiais"
                : section === "modelos"
                ? "Modelos Didáticos"
                : "Equipe Docente"}
            </span>
          </span>
          <span className="studio-internal-badge">
            <GraduationCap size={13} strokeWidth={1.5} /> Plataforma Pedagógica · INNYX
          </span>
        </motion.div>

        {/* Page Heading */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="studio-page-heading"
        >
          <div>
            <p className="studio-greeting">Olá, {userName ? userName.split(" ")[0] : "educador(a)"}</p>
            <h1>
              {headings[section].prefix}
              <span className="studio-heading-highlight">{headings[section].highlight}</span>
            </h1>
            <p className="studio-heading-description">{headings[section].subtitle}</p>
          </div>
          {section !== "ranking" && section !== "modelos" && (
            <label className="studio-search">
              <Search size={17} />
              <input
                aria-label="Buscar projetos, temas, disciplinas ou materiais..."
                placeholder="Buscar projetos, matérias ou apostila..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              {search && (
                <button aria-label="Limpar busca" onClick={() => setSearch("")}>
                  <X size={14} />
                </button>
              )}
            </label>
          )}
        </motion.header>

        {/* ===================== INÍCIO (DASHBOARD) ===================== */}
        {section === "inicio" && (
          <>
            <div className="studio-section-heading">
              <h2>Escolha o formato pedagógico</h2>
              <span>Todos integrados ao conteúdo didático da apostila</span>
            </div>

            <motion.div
              className="studio-creation-grid"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.08 } },
              }}
            >
              {cards.map(({ kind, theme, icon: Icon, formatLabel, title, description, features, cta, href, badge, inDevelopment }) => (
                <motion.article
                  variants={{
                    hidden: { opacity: 0, y: 18 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
                  }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.985 }}
                  className={`studio-creation-card card-${kind} card--${theme}${inDevelopment ? " is-dev" : ""}`}
                  key={kind}
                >
                  <div className="creation-card-top">
                    <span className={`creation-icon creation-icon--${theme}`}>
                      <Icon size={24} strokeWidth={1.75} />
                    </span>
                    <span className={`creation-badge creation-badge--${theme}${inDevelopment ? " creation-badge--dev" : ""}`}>{badge}</span>
                  </div>
                  <span className={`creation-eyebrow creation-eyebrow--${theme}`}>{formatLabel}</span>
                  <h3>{title}</h3>
                  <p className="creation-description">{description}</p>
                  <ul>
                    {features.map(feature => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link className={`creation-cta creation-cta--${theme}${inDevelopment ? " creation-cta--dev" : ""}`} to={href} state={{ from: "/inicio" }}>
                    {cta} <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                </motion.article>
              ))}
            </motion.div>

            {/* Banner de integração multiformato */}
            <motion.div
              className="studio-package-banner"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="studio-package-art" aria-hidden="true">
                <span><Presentation size={17} strokeWidth={1.5} /></span>
                <span><Gamepad2 size={17} strokeWidth={1.5} /></span>
                <span><Video size={17} strokeWidth={1.5} /></span>
              </div>
              <div>
                <span className="studio-package-tag">INTEGRAÇÃO MULTIFORMATO</span>
                <h3>Pacote Pedagógico Completo</h3>
                <p>Planeje slides conceituais, roteiro de videoaula e dinâmicas gamificadas no mesmo briefing pedagógico.</p>
              </div>
              <Link to={`/studio/pacote${returnParam}`} state={{ from: "/inicio" }}>Planejar pacote completo</Link>
            </motion.div>
          </>
        )}

        {/* ===================== MODELOS OFICIAIS ===================== */}
        {section === "modelos" && (
          <section className="studio-template-library">
            <div className="studio-section-heading">
              <h2>Modelos pedagógicos oficiais INNYX</h2>
              <span>Identidade visual e pedagógica pronta para suas aulas</span>
            </div>
            <div className="studio-template-grid">
              {[
                {
                  line: "Konectar.me",
                  slug: "konectar-me",
                  description: "Conteúdo escolar estruturado com tipografia Teachers e destaques didáticos em azul.",
                  color: "blue",
                },
                {
                  line: "Konecta Kids",
                  slug: "konecta-kids",
                  description: "Visual lúdico para o ciclo infantil/fundamental 1, tipografia Teachers e destaques em roxo.",
                  color: "purple",
                },
                {
                  line: "Educação Corporativa",
                  slug: "educacao-corporativa",
                  description: "Apresentações profissionais, estudos de caso, competências socioemocionais e corporativas.",
                  color: "teal",
                },
              ].map(template => (
                <article className={`studio-template-card template-${template.color}`} key={template.slug}>
                  <div className="studio-template-image">
                    <img src={`/templates/${template.slug}-capa.png`} alt={`Capa do modelo ${template.line}`} loading="lazy" />
                  </div>
                  <div className="studio-template-content">
                    <span className="studio-eyebrow">SLIDES · MODELO OFICIAL</span>
                    <h3>{template.line}</h3>
                    <p>{template.description}</p>
                    <span className="studio-template-meta">16:9 <span>•</span> PowerPoint editável</span>
                    <Link to={buildEncryptedUrl("/studio/slides", { linha: template.line })}>
                      Usar este modelo <ArrowRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="studio-model-note" style={{ marginTop: 24 }}>
              <Layers3 size={22} />
              <div>
                <h3>Uma estrutura, a sua abordagem</h3>
                <p>Personalize o conteúdo, a etapa de ensino e o objetivo de aprendizagem. Os editores de slides e roteiros permitem adicionar, editar e reorganizar as etapas da sua aula.</p>
              </div>
            </div>
          </section>
        )}

        {/* ===================== PROJETOS & MATERIAIS (INTEGRADO) ===================== */}
        {(section === "inicio" || section === "projetos") && (
          <motion.section
            className="studio-recent"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <div className="studio-section-heading recent-heading">
              <div>
                <h2>{section === "inicio" ? "Continue de onde parou" : "Todos os Projetos & Materiais Pedagógicos"}</h2>
                {section === "projetos" && (
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8e93a6" }}>
                    Jogos, slides, roteiros e apostilas vinculadas reunidos em uma visualização centralizada.
                  </p>
                )}
              </div>

              {/* Animated Filter Tabs with Motion sliding pill */}
              <div className="studio-filter-tabs" role="group" aria-label="Filtrar projetos por formato ou material">
                {filterTabs.map(({ value, label, count }) => {
                  const isActive = filter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={isActive}
                      className={isActive ? "active" : ""}
                      onClick={() => setFilter(value)}
                      style={{ position: "relative" }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="activeFilterPill"
                          className="studio-filter-pill-active"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        />
                      )}
                      <span style={{ position: "relative", zIndex: 2 }}>
                        {label}
                        {count !== undefined && (
                          <span style={{ marginLeft: 6, fontSize: "10px", opacity: 0.75 }}>
                            ({count})
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="studio-notice" role="status">{error}</p>}

            {/* PAINEL MASTER DE VISUALIZAÇÃO DE PROJETOS DOS OUTROS USUÁRIOS */}
            {isMaster && section === "projetos" && (
              <div
                className="studio-master-projects-bar"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(59, 130, 246, 0.08))",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "10.5px",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      background: "rgba(139, 92, 246, 0.25)",
                      color: "#ddd6fe",
                    }}
                  >
                    👑 ACESSO MASTER
                  </span>
                  <div role="group" aria-label="Escopo de visualização de projetos" style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      { id: "mine" as const, label: `Meus Projetos (${ownRows.length})` },
                      { id: "others" as const, label: `Projetos de Outros Usuários (${otherUsersProjects.length})` },
                      { id: "all" as const, label: `Todos da Plataforma (${ownRows.length + otherUsersProjects.length})` },
                    ].map(tab => {
                      const active = projectScope === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setProjectScope(tab.id);
                            if (tab.id === "mine") setSelectedAuthorId("all");
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "10px",
                            fontSize: "12px",
                            fontWeight: active ? 700 : 500,
                            border: active ? "1px solid rgba(167, 139, 250, 0.6)" : "1px solid rgba(255, 255, 255, 0.1)",
                            background: active ? "rgba(139, 92, 246, 0.32)" : "rgba(15, 23, 42, 0.45)",
                            color: active ? "#ffffff" : "#cbd5e1",
                            cursor: "pointer",
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {projectScope !== "mine" && otherAuthors.length > 0 && (
                    <select
                      aria-label="Filtrar por educador"
                      value={selectedAuthorId}
                      onChange={e => setSelectedAuthorId(e.target.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: "rgba(15, 23, 42, 0.75)",
                        border: "1px solid rgba(167, 139, 250, 0.35)",
                        color: "#f8fafc",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">Todos os educadores ({otherAuthors.length})</option>
                      {otherAuthors.map(author => (
                        <option key={author.id} value={author.id}>
                          {author.name} ({author.count} {author.count === 1 ? "projeto" : "projetos"})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#c4b5fd" }}>
                  <LockKeyhole size={13} />
                  <span>Permitido <strong>visualizar</strong> e <strong>baixar</strong> · Recriação desabilitada para outros usuários</span>
                </span>
              </div>
            )}

            {/* SEÇÃO INTEGRADA DE MATERIAIS DA APOSTILA */}
            {filter === "materiais" ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="studio-material-grid"
              >
                {!materialRows.length ? (
                  <div className="studio-empty-state studio-empty-panel" style={{ gridColumn: "1 / -1" }}>
                    <BookOpen size={32} />
                    <h3>{search ? "Nenhum material encontrado" : "Tudo começa com um bom material"}</h3>
                    <p>
                      {search
                        ? "Tente buscar por outro termo ou nome de projeto."
                        : "Anexe apostilas em PDF ao criar jogos ou insira o conteúdo-base aos slides e roteiros. Seus materiais didáticos aparecerão automaticamente nesta central."}
                    </p>
                    <Link className="studio-text-link" to="/inicio">
                      Criar novo projeto com apostila <ArrowRight size={15} />
                    </Link>
                  </div>
                ) : (
                  materialRows.map(row => (
                    <div key={row.id}>
                      <Link className="studio-material-card" to={row.href} state={{ from: section === "projetos" ? "/projetos" : "/inicio" }}>
                        <span className={`creation-icon type-${row.kind}`}>
                          <FileText size={24} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: "9.5px", fontWeight: 700, letterSpacing: "1px", color: "#a78bfa", marginBottom: 3 }}>
                            MATERIAL DIDÁTICO / APOSTILA
                          </span>
                          <h3 style={{ margin: "0 0 4px", fontSize: "14px", color: "#ffffff", fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.material}
                          </h3>
                          <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#8e93a6" }}>
                            Vinculado ao projeto: <strong style={{ color: "#d2d6e4" }}>{row.title}</strong>
                          </p>
                          <small style={{ fontSize: "11px", color: "#6e7284" }}>
                            {row.subject} · {row.grade} · {row.local ? "Neste navegador" : "Sincronizado"}
                          </small>
                        </div>
                        <ArrowRight size={17} />
                      </Link>
                    </div>
                  ))
                )}
              </motion.div>
            ) : (
              /* TABELA DE PROJETOS COM TRANSIÇÃO ANIMADA */
              <div className="studio-project-table-wrap">
                <table className="studio-project-table">
                  <thead>
                    <tr>
                      <th>PROJETO DIDÁTICO</th>
                      <th>FORMATO</th>
                      <th>COMPONENTE CURRICULAR</th>
                      <th>ETAPA / SÉRIE</th>
                      <th>ÚLTIMA ATUALIZAÇÃO</th>
                      <th><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={6}>
                          <div className="studio-empty-state" role="status">
                            <Sparkles className="animate-spin" size={20} style={{ margin: "0 auto 8px" }} />
                            Carregando seus projetos pedagógicos…
                          </div>
                        </td>
                      </tr>
                    )}
                    {!loading && !visibleRows.length && (
                      <tr>
                        <td colSpan={6}>
                          <div className="studio-empty-state">
                            <FolderOpen size={30} />
                            <h3>{search || filter !== "todos" ? "Nenhum projeto encontrado" : "Sua biblioteca pedagógica começa aqui"}</h3>
                            <p>
                              {search || filter !== "todos"
                                ? "Experimente outro termo ou formato nas abas acima."
                                : "Escolha um formato acima para criar sua primeira experiência pedagógica."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                    <AnimatePresence mode="popLayout">
                      {!loading &&
                        visibleRows.map(row => (
                          <motion.tr
                            key={row.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                          >
                            <td>
                              <Link to={row.href} state={{ from: section === "projetos" ? "/projetos" : "/inicio" }}>
                                <span className={`project-mini-icon type-${row.kind}`}>
                                  {row.kind === "jogo" ? (
                                    <Gamepad2 size={16} strokeWidth={1.5} />
                                  ) : row.kind === "slides" ? (
                                    <Presentation size={16} strokeWidth={1.5} />
                                  ) : row.kind === "roteiro" ? (
                                    <Video size={16} strokeWidth={1.5} />
                                  ) : (
                                    <Package size={16} strokeWidth={1.5} />
                                  )}
                                </span>
                                <div>
                                  <span style={{ display: "block" }}>{row.title}</span>
                                  {row.isOtherUser && row.authorName && (
                                    <small style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#c4b5fd", fontSize: "10.5px", fontWeight: 600, marginTop: 2, marginRight: 8 }}>
                                      👤 {row.authorName}
                                    </small>
                                  )}
                                  {row.material && (
                                    <small style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#9da1b2", fontSize: "10.5px", marginTop: 2 }}>
                                      <FileText size={11} strokeWidth={1.5} /> {row.material}
                                    </small>
                                  )}
                                </div>
                              </Link>
                            </td>
                            <td>
                              <span className={`studio-type-tag type-${row.kind}`}>{row.detail}</span>
                            </td>
                            <td>{row.subject}</td>
                            <td>{row.grade}</td>
                            <td>{row.updatedAt.getTime() ? row.updatedAt.toLocaleDateString("pt-BR") : "—"}</td>
                            <td>
                              <div className="studio-row-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                                {row.isOtherUser ? (
                                  <>
                                    <Link
                                      to={row.href}
                                      state={{ from: section === "projetos" ? "/projetos" : "/inicio" }}
                                      title={`Visualizar ${row.title} (somente leitura)`}
                                      aria-label={`Visualizar ${row.title}`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        padding: "5px 10px",
                                        borderRadius: "8px",
                                        fontSize: "11.5px",
                                        fontWeight: 600,
                                        background: "rgba(139, 92, 246, 0.16)",
                                        border: "1px solid rgba(139, 92, 246, 0.35)",
                                        color: "#ddd6fe",
                                        textDecoration: "none",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <Eye size={13} />
                                      <span>Visualizar</span>
                                    </Link>
                                    <Link
                                      to={row.downloadHref || row.href}
                                      state={{ from: section === "projetos" ? "/projetos" : "/inicio" }}
                                      title={`Baixar ${row.title}`}
                                      aria-label={`Baixar ${row.title}`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        padding: "5px 10px",
                                        borderRadius: "8px",
                                        fontSize: "11.5px",
                                        fontWeight: 600,
                                        background: "rgba(16, 185, 129, 0.15)",
                                        border: "1px solid rgba(16, 185, 129, 0.35)",
                                        color: "#6ee7b7",
                                        textDecoration: "none",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <Download size={13} />
                                      <span>Baixar</span>
                                    </Link>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="studio-row-action studio-row-action--delete"
                                      title={`Excluir ${row.title}`}
                                      aria-label={`Excluir ${row.title}`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setProjectToDelete(row);
                                      }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                    <Link to={row.href} state={{ from: section === "projetos" ? "/projetos" : "/inicio" }} className="studio-row-arrow" aria-label={`Abrir ${row.title}`}>
                                      <ChevronRight size={17} />
                                    </Link>
                                  </>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal de confirmação de exclusão com AnimatePresence */}
            <AnimatePresence>
              {projectToDelete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="studio-modal-backdrop"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="delete-home-title"
                >
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 15 }}
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    className="studio-modal"
                  >
                    <div className="studio-modal__header">
                      <div className="studio-modal__icon-wrap studio-modal__icon-wrap--danger">
                        <Trash2 size={22} />
                      </div>
                      <div>
                        <h2 id="delete-home-title">Excluir projeto pedagógico</h2>
                        <p>Tem certeza de que deseja excluir <strong>{projectToDelete.title}</strong>?</p>
                      </div>
                    </div>
                    <p className="studio-modal__desc">
                      Esta ação é permanente e não poderá ser desfeita.{" "}
                      {projectToDelete.local
                        ? "O rascunho e todos os slides serão removidos permanentemente deste navegador."
                        : "O projeto será excluído da sua biblioteca pedagógica."}
                    </p>
                    <div className="studio-modal__actions">
                      <button
                        type="button"
                        className="studio-button studio-button--quiet"
                        onClick={() => setProjectToDelete(null)}
                        disabled={isDeleting}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="studio-button studio-button--danger-solid"
                        onClick={() => void handleDeleteConfirmed()}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Excluindo…" : "Sim, excluir projeto"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer da tabela */}
            <div className="studio-table-footer">
              <span>
                {loading
                  ? "Sincronizando biblioteca…"
                  : filter === "materiais"
                  ? `${materialRows.length} ${materialRows.length === 1 ? "material vinculado" : "materiais vinculados"}`
                  : `${matchingRows.length} ${matchingRows.length === 1 ? "projeto" : "projetos"}${
                      section === "inicio" && matchingRows.length > 6 ? " · mostrando os 6 mais recentes" : ""
                    }`}
              </span>
              {section === "inicio" ? (
                <Link to="/projetos">
                  Ver todos os projetos e materiais <ArrowRight size={14} />
                </Link>
              ) : (
                <Link to="/inicio">
                  Planejar novo projeto pedagógico <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </motion.section>
        )}

        {/* ===================== RANKING PEDAGÓGICO ===================== */}
        {section === "ranking" && (
          <section>
            <div className="studio-section-heading">
              <h2>Inspiração & Criações da Equipe</h2>
              <span>
                <Trophy size={15} /> Projetos salvos pelos educadores
              </span>
            </div>

            {isMaster && (
              <div className="studio-ranking-master-toolbar">
                <span className="studio-ranking-master-badge">👑 PAINEL MASTER INNYX</span>
                <span>Como Administrador Master, você pode definir se cada educador é <strong>Administrador</strong> ou <strong>Professor</strong>, além de <strong>visualizar</strong> e <strong>baixar</strong> os projetos de qualquer usuário (recriação bloqueada).</span>
              </div>
            )}

            {isAdmin && deactivatedCount > 0 && (
              <div className="studio-ranking-admin-toolbar">
                <label className="studio-ranking-admin-toggle">
                  <input
                    type="checkbox"
                    checked={showDeactivated}
                    onChange={(e) => setShowDeactivated(e.target.checked)}
                  />
                  <span>
                    Exibir contas com e-mail desativado ({deactivatedCount}) — <em>visível apenas para o Administrador</em>
                  </span>
                </label>
                <span className="studio-ranking-admin-hint">
                  {showDeactivated
                    ? "Educadores comuns não visualizam essas contas no ranking."
                    : "Modo de visualização pública ativado."}
                </span>
              </div>
            )}

            {teamError && <p className="studio-notice" role="alert">{teamError}</p>}
            <div className="studio-leaderboard">
              {teamLoading ? (
                <div className="studio-empty-state" role="status">Carregando contribuições…</div>
              ) : visibleTeam.length ? (
                visibleTeam.map((member, index) => {
                  const isCurrentUser = auth.currentUser?.uid === member.id;
                  const initial = (member.name || "E").slice(0, 1).toUpperCase();
                  const isMemberMaster = isMasterUser(member.name, member.email);
                  const memberRole = isMemberMaster ? "master" : (member.role === "admin" ? "admin" : "professor");
                  const memberProjects = isCurrentUser
                    ? ownRows
                    : otherUsersProjects.filter(
                        p =>
                          p.userId === member.id ||
                          (member.email && p.authorEmail && p.authorEmail.toLowerCase() === member.email.toLowerCase())
                      );
                  const isExpanded = isMaster && expandedMemberId === member.id;
                  return (
                    <div key={member.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <motion.div
                        className={`studio-leader-row ${isCurrentUser ? "is-current-user" : ""} ${member.disabled ? "is-disabled" : ""}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <span className={`leader-position ${index < 3 ? "leader-top" : ""}`}>
                          {index === 0 ? <Trophy size={20} /> : String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="studio-team-avatar">
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt={member.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                                const fallback = e.currentTarget.parentElement?.querySelector(".studio-team-avatar-fallback") as HTMLElement | null;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <span
                            className="studio-team-avatar-fallback"
                            style={{ display: member.photoURL ? "none" : "flex" }}
                          >
                            {initial}
                          </span>
                        </span>
                        <div className="studio-leader-info">
                          <strong>
                            {member.name}
                            {isMemberMaster && (
                              <span className="studio-leader-badge-master" title="Usuário Administrador MASTER">👑 MASTER</span>
                            )}
                            {!isMemberMaster && memberRole === "admin" && (
                              <span className="studio-leader-badge-admin" title="Usuário Administrador">🛡️ Administrador</span>
                            )}
                            {!isMemberMaster && memberRole === "professor" && (
                              <span className="studio-leader-badge-professor" title="Professor da Rede">🎓 Professor</span>
                            )}
                            {member.disabled && (
                              <span className="studio-leader-badge-disabled" title="Conta com e-mail institucional inativo. Para reativar, o e-mail precisa ser ativado novamente.">
                                🚫 Desativado
                              </span>
                            )}
                            {isCurrentUser && <span className="studio-leader-badge-you">Você</span>}
                          </strong>
                        </div>
                        <div className="studio-leader-row-actions">
                          <span className="studio-leader-project-count">{member.count} {member.count === 1 ? "projeto" : "projetos"}</span>
                          {isMaster && memberProjects.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                              title={`Ver projetos de ${member.name}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "5px 11px",
                                borderRadius: "9px",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                background: isExpanded ? "rgba(139, 92, 246, 0.32)" : "rgba(139, 92, 246, 0.15)",
                                border: "1px solid rgba(139, 92, 246, 0.4)",
                                color: "#ddd6fe",
                                cursor: "pointer",
                              }}
                            >
                              <Eye size={13} />
                              <span>{isExpanded ? "Ocultar projetos" : "Ver projetos"}</span>
                            </button>
                          )}
                          {isMaster && !isMemberMaster && onUpdateUserRole && (
                            <div className="studio-leader-role-picker" title="Como Administrador MASTER, altere a função da pessoa: Administrador ou Professor">
                              <span className="studio-leader-role-picker-label">Função:</span>
                              <select
                                className="studio-leader-role-select"
                                value={memberRole === "admin" ? "admin" : "professor"}
                                onChange={(e) => void onUpdateUserRole(member.id, e.target.value as "admin" | "professor")}
                                aria-label={`Alterar função de ${member.name}`}
                              >
                                <option value="professor">🎓 Professor</option>
                                <option value="admin">🛡️ Administrador</option>
                              </select>
                            </div>
                          )}
                          {isAdmin && !isMemberMaster && !member.disabled && onToggleUserDisabled && (
                            <button
                              type="button"
                              className="studio-leader-admin-action"
                              onClick={() => void onToggleUserDisabled(member.id, true)}
                              title="Marcar conta como e-mail desativado"
                            >
                              Desativar
                            </button>
                          )}
                          {member.disabled && (
                            <span
                              className="studio-leader-deactivated-note"
                              title="Conta inativa. A reativação só ocorre quando o e-mail institucional for ativado novamente."
                            >
                              E-mail desativado
                            </span>
                          )}
                        </div>
                      </motion.div>

                      {isExpanded && (
                        <div
                          className="studio-leader-projects-drawer"
                          style={{
                            margin: "0 0 8px 28px",
                            padding: "12px 16px",
                            borderRadius: "12px",
                            background: "rgba(15, 23, 42, 0.65)",
                            border: "1px solid rgba(139, 92, 246, 0.28)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "4px" }}>
                            <strong style={{ fontSize: "12px", color: "#e2e8f0" }}>
                              Projetos de {member.name} ({memberProjects.length})
                            </strong>
                            {!isCurrentUser && (
                              <span style={{ fontSize: "11px", color: "#c4b5fd", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <LockKeyhole size={12} /> Visualização e download liberados · Recriação não permitida
                              </span>
                            )}
                          </div>
                          {memberProjects.map(proj => (
                            <div
                              key={proj.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: "10px",
                                padding: "8px 12px",
                                borderRadius: "10px",
                                background: "rgba(30, 41, 59, 0.55)",
                                border: "1px solid rgba(255, 255, 255, 0.07)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                <span className={`project-mini-icon type-${proj.kind}`}>
                                  {proj.kind === "jogo" ? (
                                    <Gamepad2 size={15} strokeWidth={1.5} />
                                  ) : proj.kind === "slides" ? (
                                    <Presentation size={15} strokeWidth={1.5} />
                                  ) : proj.kind === "roteiro" ? (
                                    <Video size={15} strokeWidth={1.5} />
                                  ) : (
                                    <Package size={15} strokeWidth={1.5} />
                                  )}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <strong style={{ display: "block", fontSize: "13px", color: "#f8fafc" }}>{proj.title}</strong>
                                  <small style={{ fontSize: "11px", color: "#94a3b8" }}>
                                    {proj.detail} · {proj.subject} · {proj.grade} · {proj.updatedAt.getTime() ? proj.updatedAt.toLocaleDateString("pt-BR") : "—"}
                                  </small>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Link
                                  to={proj.href}
                                  state={{ from: "/ranking" }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "5px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 600,
                                    background: "rgba(139, 92, 246, 0.2)",
                                    border: "1px solid rgba(139, 92, 246, 0.4)",
                                    color: "#ddd6fe",
                                    textDecoration: "none",
                                  }}
                                >
                                  <Eye size={13} />
                                  <span>Visualizar</span>
                                </Link>
                                <Link
                                  to={proj.downloadHref || proj.href}
                                  state={{ from: "/ranking" }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    padding: "5px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 600,
                                    background: "rgba(16, 185, 129, 0.16)",
                                    border: "1px solid rgba(16, 185, 129, 0.38)",
                                    color: "#6ee7b7",
                                    textDecoration: "none",
                                  }}
                                >
                                  <Download size={13} />
                                  <span>Baixar</span>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="studio-empty-state">
                  <Trophy size={30} />
                  <h3>Um espaço para reconhecer cada contribuição</h3>
                  <p>Os projetos pedagógicos salvos pela equipe aparecerão neste ranking de engajamento.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}

export default function StudioHome({ section = "inicio" }: { section?: Section }) {
  const user = auth.currentUser;
  const userSlug = user?.email?.split("@")[0].replace(/\./g, "-") || "usuario";
  const [games, setGames] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<StudioProject[]>(() => (user ? getStudioProjects(user.uid) : []));
  const [otherUsersProjects, setOtherUsersProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState("");

  useEffect(() => {
    if (!user) return;
    const isMaster = isMasterUser(user.displayName, user.email);
    const refresh = () => setDrafts(getStudioProjects(user.uid));
    window.addEventListener("mind-canvas:projects-changed", refresh);
    window.addEventListener("storage", refresh);

    const usersCache = new Map<string, { name: string; email: string; photoURL: string | null }>();
    if (isMaster) {
      getDocs(collection(db, "users"))
        .then(snap => {
          snap.docs.forEach(d => {
            const uData = d.data();
            usersCache.set(d.id, {
              name: String(uData.name || uData.displayName || "Educador(a)"),
              email: String(uData.email || ""),
              photoURL: (uData.photoURL || uData.photoUrl || null) as string | null,
            });
          });
        })
        .catch(() => {});
    }

    const projectsQuery = isMaster
      ? collection(db, "projects")
      : query(collection(db, "projects"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      projectsQuery,
      snapshot => {
        const gamesList: Project[] = [];
        const othersList: RecentProject[] = [];

        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const ownerId = typeof data.userId === "string" ? data.userId : "";

          if (!ownerId || ownerId === user.uid) {
            if (!data.kind || data.kind === "jogo" || data.formData) {
              gamesList.push({ ...data, id: docSnap.id } as Project);
            }
          } else if (isMaster) {
            const cachedAuthor = usersCache.get(ownerId);
            const authorEmail = String(data.authorEmail || data.userEmail || cachedAuthor?.email || "");
            const authorName = String(
              data.authorName ||
                data.userName ||
                cachedAuthor?.name ||
                (authorEmail ? authorEmail.split("@")[0] : "Educador(a)")
            );
            const authorPhoto = (data.authorPhoto || data.userPhoto || cachedAuthor?.photoURL || null) as string | null;
            const isStudio = ["slides", "roteiro", "pacote"].includes(String(data.kind));

            if (isStudio) {
              const kind = data.kind as ProjectKind;
              const rawTitle = typeof data.title === "string" ? data.title.trim() : "";
              const slidesArr = Array.isArray(data.slides) ? (data.slides as { type?: string; title?: string }[]) : [];
              const title =
                rawTitle && !/^(Projeto|Rascunho) sem título$/i.test(rawTitle)
                  ? rawTitle
                  : slidesArr.find(s => s.type === "capa")?.title?.trim() ||
                    slidesArr[0]?.title?.trim() ||
                    "Apresentação sem título";
              othersList.push({
                id: `studio-${docSnap.id}`,
                title,
                kind,
                detail: kind === "slides" ? "Slides Canvas" : kind === "roteiro" ? "Roteiro de gravação" : "Pacote de aula",
                subject: String(data.subject || "—"),
                grade: String(data.gradeLevel || data.grade || "—")
                  .replace("Ensino ", "")
                  .replace("Fundamental ", "Fund. "),
                updatedAt: parseDate(data.updatedAt || data.createdAt),
                href: buildEncryptedUrl(`/studio/${kind}`, {
                  id: docSnap.id,
                  stage: kind === "slides" ? "result" : "edit",
                  from: section === "projetos" ? "projetos" : undefined,
                  view: "1",
                }),
                downloadHref: buildEncryptedUrl(`/studio/${kind}`, {
                  id: docSnap.id,
                  stage: kind === "slides" ? "result" : "edit",
                  from: section === "projetos" ? "projetos" : undefined,
                  view: "1",
                  download: "1",
                }),
                material: typeof data.sourceFileName === "string" && data.sourceFileName
                  ? data.sourceFileName
                  : typeof data.sourceContent === "string" && data.sourceContent.trim()
                  ? "Conteúdo-base do projeto"
                  : undefined,
                userId: ownerId,
                authorName,
                authorEmail,
                authorPhoto,
                isOtherUser: true,
              });
            } else {
              const formData = (data.formData || {}) as { gameType?: string; subject?: string; gradeLevel?: string };
              othersList.push({
                id: `game-${docSnap.id}`,
                title: String(data.title || "Canvas sem título"),
                kind: "jogo",
                detail: `Jogo - ${formData.gameType || data.gameType || "Canvas"}`,
                subject: String(formData.subject || data.subject || "—"),
                grade: String(formData.gradeLevel || data.grade || "—")
                  .replace("Ensino ", "")
                  .replace("Fundamental ", "Fund. "),
                updatedAt: parseDate(data.updatedAt || data.createdAt),
                href: buildEncryptedUrl(`/canvas-generator/${userSlug}`, {
                  id: docSnap.id,
                  from: section === "projetos" ? "projetos" : undefined,
                  view: "1",
                }),
                downloadHref: buildEncryptedUrl(`/canvas-generator/${userSlug}`, {
                  id: docSnap.id,
                  from: section === "projetos" ? "projetos" : undefined,
                  view: "1",
                  download: "1",
                }),
                material: typeof data.pdfFileName === "string" && data.pdfFileName ? data.pdfFileName : undefined,
                userId: ownerId,
                authorName,
                authorEmail,
                authorPhoto,
                isOtherUser: true,
              });
            }
          }
        });

        othersList.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setGames(gamesList);
        setOtherUsersProjects(othersList);
        setLoading(false);
        setError("");
      },
      () => {
        try {
          const cached: unknown = JSON.parse(localStorage.getItem("gamecanvas_projects") || "[]");
          setGames(Array.isArray(cached) ? cached.filter((project: Project) => project.userId === user.uid) : []);
        } catch {
          setGames([]);
        }
        setError("Não foi possível sincronizar os jogos. Exibindo os projetos disponíveis neste navegador.");
        setLoading(false);
      }
    );
    return () => {
      unsubscribe();
      window.removeEventListener("mind-canvas:projects-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [user]);

  useEffect(() => {
    if (section !== "ranking") return;
    let active = true;

    // Sincroniza usuário autenticado atual caso photoURL ainda não esteja salvo
    if (user?.uid) {
      setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: user.displayName || user.email?.split("@")[0] || "Educador(a)",
          email: user.email || "",
          photoURL: user.photoURL || null,
          updatedAt: new Date(),
        },
        { merge: true }
      ).catch(() => {});
    }

    // Tenta sincronizar avatares da equipe caso a Cloud Function esteja implantada
    try {
      const syncFn = httpsCallable(functions, "syncTeamAvatars");
      syncFn().catch(() => {});
    } catch {
      // Ignora silenciosamente se o Cloud Function ainda não estiver implantado
    }

    Promise.all([getDocs(collection(db, "projects")), getDocs(collection(db, "users"))])
      .then(([projects, users]) => {
        if (!active) return;
        const counts = new Map<string, number>();
        const usersInfo = new Map<string, { name: string; photoURL: string | null; email: string | null; disabled?: boolean; role?: "master" | "admin" | "professor" }>();

        // Cache local para persistência imediata de contas desativadas pelo Admin
        let localDeactivated = new Set<string>();
        try {
          const raw = localStorage.getItem("mind_canvas_deactivated_users_cache");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localDeactivated = new Set(parsed.map((x: unknown) => String(x).toLowerCase().trim()));
            }
          }
        } catch {}

        users.docs.forEach(docItem => {
          const data = docItem.data();
          const name = String(data.name || data.displayName || "Educador(a)");
          const photoURL = (data.photoURL || data.photoUrl || data.avatarUrl || data.avatar || data.picture || data.image || null) as string | null;
          const email = (data.email as string) || null;
          const isLocallyDeactivated = localDeactivated.has(docItem.id.toLowerCase().trim()) || (email ? localDeactivated.has(email.toLowerCase().trim()) : false);
          const disabled = isLocallyDeactivated || isUserDeactivated({
            email,
            disabled: data.disabled,
            isDeactivated: data.isDeactivated,
            status: data.status,
            active: data.active,
          });
          const role: "master" | "admin" | "professor" = isMasterUser(name, email)
            ? "master"
            : (data.role === "admin" || data.isAdmin === true)
            ? "admin"
            : "professor";
          usersInfo.set(docItem.id, { name, photoURL, email, disabled, role });
        });

        projects.docs.forEach(docItem => {
          const data = docItem.data();
          const id = data.userId;
          if (typeof id === "string") {
            counts.set(id, (counts.get(id) || 0) + 1);
            if (!usersInfo.has(id)) {
              const email = (data.authorEmail || data.userEmail || null) as string | null;
              const name = String(data.authorName || data.userName || "Educador(a)");
              const isLocallyDeactivated = localDeactivated.has(id.toLowerCase().trim()) || (email ? localDeactivated.has(email.toLowerCase().trim()) : false);
              const role: "master" | "admin" | "professor" = isMasterUser(name, email) ? "master" : "professor";
              usersInfo.set(id, {
                name,
                photoURL: (data.authorPhoto || data.userPhoto || null) as string | null,
                email,
                disabled: isLocallyDeactivated || isUserDeactivated({ email, disabled: data.disabled }),
                role,
              });
            } else {
              const current = usersInfo.get(id)!;
              if (!current.photoURL && (data.authorPhoto || data.userPhoto)) {
                current.photoURL = (data.authorPhoto || data.userPhoto) as string;
              }
              if (!current.email && (data.authorEmail || data.userEmail)) {
                current.email = (data.authorEmail || data.userEmail) as string;
              }
            }
          }
        });

        // Garante que o usuário logado utilize a foto mais atual do Google Auth
        if (user) {
          const current = usersInfo.get(user.uid);
          const isMaster = isMasterUser(user.displayName, user.email);
          const userRole: "master" | "admin" | "professor" = isMaster ? "master" : (current?.role || "professor");
          usersInfo.set(user.uid, {
            name: user.displayName || current?.name || user.email?.split("@")[0] || "Educador(a)",
            photoURL: user.photoURL || current?.photoURL || null,
            email: user.email || current?.email || null,
            disabled: false,
            role: userRole,
          });
        }

        const teamList: TeamMember[] = Array.from(counts, ([id, count]) => {
          const u = usersInfo.get(id);
          return {
            id,
            count,
            name: u?.name || "Educador(a)",
            photoURL: u?.photoURL || null,
            email: u?.email || null,
            disabled: Boolean(u?.disabled),
            role: u?.role || (isMasterUser(u?.name, u?.email) ? "master" : "professor"),
          };
        }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        setTeam(teamList);
        setTeamLoading(false);
      })
      .catch(() => {
        if (active) {
          setTeamError("Não foi possível carregar o ranking. Tente novamente mais tarde.");
          setTeamLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [section, user]);

  const handleToggleUserDisabled = async (userId: string, nextDisabled: boolean) => {
    const member = team.find(m => m.id === userId);
    if (!member) return;

    if (isMasterUser(member.name, member.email)) {
      alert("Não é permitido desativar a conta do Administrador Master.");
      return;
    }

    const confirmMsg = `Confirma a desativação da conta de "${member.name}" no ranking?\n\nA conta será marcada como desativada e ficará visível apenas para os administradores.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    // 1. Atualização otimista imediata na interface
    setTeam(prev =>
      prev.map(m => (m.id === userId ? { ...m, disabled: nextDisabled } : m))
    );

    // 2. Persistência no cache local (imediata e resiliente)
    try {
      const stored = JSON.parse(localStorage.getItem("mind_canvas_deactivated_users_cache") || "[]");
      const list = Array.isArray(stored) ? stored : [];
      const updated = nextDisabled
        ? Array.from(new Set([...list, userId, member.email].filter((x): x is string => Boolean(x))))
        : list.filter((x: string) => x !== userId && x !== member.email);
      localStorage.setItem("mind_canvas_deactivated_users_cache", JSON.stringify(updated));
    } catch (cacheErr) {
      console.warn("Aviso ao salvar cache de desativação:", cacheErr);
    }

    // 3. Persistência no Firestore
    try {
      await setDoc(
        doc(db, "users", userId),
        {
          disabled: nextDisabled,
          status: nextDisabled ? "deactivated" : "active",
          updatedAt: new Date(),
          ...(member.name ? { name: member.name } : {}),
          ...(member.email ? { email: member.email } : {}),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao atualizar status do usuário no Firestore:", err);
    }
  };

  const handleUpdateUserRole = async (userId: string, nextRole: "admin" | "professor") => {
    // Atualização otimista imediata na interface
    setTeam(prev =>
      prev.map(member => (member.id === userId ? { ...member, role: nextRole } : member))
    );

    try {
      await setDoc(
        doc(db, "users", userId),
        { role: nextRole, isAdmin: nextRole === "admin", updatedAt: new Date() },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao atualizar função do usuário no Firestore:", err);
    }
  };

  return (
    <StudioHomeView
      key={section}
      section={section}
      games={games}
      drafts={drafts}
      otherUsersProjects={otherUsersProjects}
      loading={loading}
      error={error}
      userName={user?.displayName || user?.email?.split("@")[0] || ""}
      userSlug={userSlug}
      team={team}
      teamLoading={teamLoading}
      teamError={teamError}
      onToggleUserDisabled={handleToggleUserDisabled}
      onUpdateUserRole={handleUpdateUserRole}
    />
  );
}
