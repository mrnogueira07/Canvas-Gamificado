import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  FolderOpen,
  Trophy,
  PlusCircle,
  ChevronsUpDown,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Gamepad2,
  Presentation,
  Video,
  Package,
} from "lucide-react";
import type { User } from "firebase/auth";
import { isMasterUser } from "../../lib/studioNavigation";

export interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  user: User | null;
  onLogout: () => void;
  onNewFolderClick?: () => void;
  search?: string;
  onSearchChange?: (val: string) => void;
  view?: "projects" | "trash";
  onSelectView?: (view: "projects" | "trash") => void;
  projectCount?: number;
  trashCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  customToolbar?: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
  customBottomToolbar?: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
  className?: string;
  onNavigate?: () => void;
}

export function AppSidebar({
  isCollapsed,
  onToggleCollapse,
  user,
  onLogout,
  projectCount = 0,
  className = "",
  onNavigate,
}: AppSidebarProps) {
  const location = useLocation();
  const isStudioRoute = location.pathname.startsWith("/studio/") || location.pathname.startsWith("/canvas-generator");
  const [createOpen, setCreateOpen] = useState(() => isStudioRoute);
  const userSlug = user?.email?.split("@")[0].replace(/\./g, "-") || "usuario";
  const isCanvasGenerator = location.pathname.startsWith("/canvas-generator");
  const isMaster = isMasterUser(user?.displayName, user?.email);

  const [prevPathname, setPrevPathname] = useState(location.pathname);

  // Ao navegar por categorias principais (Início, Meus Projetos, Modelos, Ranking), fecha "Criar no Estúdio"; ao entrar em rotas de estúdio, abre automaticamente.
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    const isMainCategory = ["/inicio", "/projetos", "/modelos", "/ranking"].some(path =>
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
    if (isMainCategory) {
      setCreateOpen(false);
    } else if (location.pathname.startsWith("/studio/") || location.pathname.startsWith("/canvas-generator")) {
      setCreateOpen(true);
    }
  }

  const handleCategoryClick = () => {
    setCreateOpen(false);
    onNavigate?.();
  };

  return (
    <aside className={`studio-sidebar ${isCollapsed ? "is-collapsed" : ""} ${className}`} aria-label="Navegação do estúdio">
      {/* 1. Header com Logo e Marca */}
      <div className="studio-sidebar-header">
        <NavLink to="/inicio" className="studio-brand" onClick={handleCategoryClick} aria-label="Mind Canvas — Início">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="studio-brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(255, 255, 255, 0.22)" stroke="#ffffff" />
              <path d="M2 17l10 5 10-5" stroke="#ffffff" />
              <path d="M2 12l10 5 10-5" stroke="#ffffff" />
            </svg>
          </motion.div>
          {!isCollapsed && <span className="studio-brand-title">Mind Canvas</span>}
        </NavLink>
      </div>

      {/* 2. Seletor de Workspace & Perfil do Educador (Estilo Imagem 2) */}
      <div className="studio-workspace-section">
        {!isCollapsed ? (
          <>
            <div className="studio-workspace-selector" role="button" tabIndex={0} title="Workspace: INNYX Educacional">
              <span className="studio-workspace-name">Workspace INNYX</span>
              <ChevronsUpDown size={14} className="studio-workspace-chevron" />
            </div>

            <div className="studio-sidebar-profile-card">
              <div className="studio-sidebar-avatar-wrapper">
                <span className={`studio-sidebar-avatar ${isMaster ? "studio-sidebar-avatar--master" : ""}`}>
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user?.displayName || "Educador"} referrerPolicy="no-referrer" />
                  ) : (
                    (user?.displayName || user?.email || "U").slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="studio-sidebar-online-pip" title="Conectado" />
              </div>
              <div className="studio-sidebar-profile-details">
                <div className="studio-sidebar-name-row">
                  <strong className="studio-sidebar-profile-name">
                    {user?.displayName || user?.email?.split("@")[0] || "Educador"}
                  </strong>
                  {isMaster && (
                    <span className="studio-sidebar-tag-master" title="Usuário Administrador MASTER">👑 MASTER</span>
                  )}
                </div>
                <span className={`studio-sidebar-profile-role ${isMaster ? "studio-sidebar-profile-role--master" : ""}`}>
                  {isMaster ? "Administrador MASTER · INNYX" : "Educador(a) · INNYX"}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="studio-collapsed-profile-header">
            <button type="button" className="studio-workspace-selector--mini" title="Workspace INNYX" onClick={onToggleCollapse}>
              <ChevronsUpDown size={15} />
            </button>
            <span
              className={`studio-sidebar-avatar studio-sidebar-avatar--mini ${isMaster ? "studio-sidebar-avatar--master" : ""}`}
              title={`${user?.displayName || "Educador"}${isMaster ? " (MASTER)" : ""}`}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                (user?.displayName || user?.email || "U").slice(0, 1).toUpperCase()
              )}
            </span>
          </div>
        )}
      </div>

      {/* 3. Lista de Navegação Principal (Áreas do Sistema) */}
      <div className="studio-sidebar-scroll">
        <nav className="studio-nav-group" aria-label="Áreas principais">
          {/* Início / Dashboard */}
          <NavLink
            to="/inicio"
            onClick={handleCategoryClick}
            title={isCollapsed ? "Início" : undefined}
            className={({ isActive }) => `studio-nav-item ${isActive ? "is-active" : ""}`}
          >
            <div className="studio-nav-item__icon-wrap">
              <LayoutGrid size={18} strokeWidth={1.8} />
            </div>
            {!isCollapsed && <span>Início</span>}
          </NavLink>

          {/* Meus Projetos (Central Integrada) */}
          <NavLink
            to="/projetos"
            onClick={handleCategoryClick}
            title={isCollapsed ? "Meus Projetos" : undefined}
            className={({ isActive }) => `studio-nav-item ${isActive ? "is-active" : ""}`}
          >
            <div className="studio-nav-item__icon-wrap">
              <FolderOpen size={18} strokeWidth={1.8} />
              {isCollapsed && projectCount > 0 && <span className="studio-pip" />}
            </div>
            {!isCollapsed && (
              <>
                <span>Meus Projetos</span>
                {projectCount > 0 && <span className="studio-badge-count">{projectCount}</span>}
              </>
            )}
          </NavLink>

          {/* Ranking & Gamificação */}
          <NavLink
            to="/ranking"
            onClick={handleCategoryClick}
            title={isCollapsed ? "Ranking da Equipe" : undefined}
            className={({ isActive }) => `studio-nav-item ${isActive ? "is-active" : ""}`}
          >
            <div className="studio-nav-item__icon-wrap">
              <Trophy size={18} strokeWidth={1.8} />
            </div>
            {!isCollapsed && <span>Ranking</span>}
          </NavLink>
        </nav>

        {/* 4. Grupo Hierárquico Colapsável (Criar no Estúdio) */}
        {!isCollapsed ? (
          <div className="studio-tree-section">
            <button
              type="button"
              className="studio-tree-header"
              onClick={() => setCreateOpen(!createOpen)}
              aria-expanded={createOpen}
            >
              <div className="studio-tree-header__left">
                <PlusCircle size={17} strokeWidth={1.8} />
                <span>Criar no Estúdio</span>
              </div>
              <ChevronDown size={14} className={`studio-tree-chevron ${createOpen ? "is-open" : ""}`} />
            </button>

            {createOpen && (
              <div className="studio-tree-branch">
                <div className="studio-tree-line" />
                <div className="studio-tree-items">
                  {/* Game Canvas */}
                  <NavLink
                    to={`/canvas-generator/${userSlug}`}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `studio-tree-item studio-tree-item--game ${isActive || isCanvasGenerator ? "is-active is-highlighted" : ""}`
                    }
                    title="Game Canvas — Roteiro de jogo a partir de conteúdo pedagógico"
                  >
                    <Gamepad2 size={16} strokeWidth={1.7} className="studio-tree-icon studio-tree-icon--purple" />
                    <span>Game Canvas</span>
                    <span className="studio-tree-badge studio-tree-badge--purple">Jogo</span>
                  </NavLink>

                  {/* Slides Canvas */}
                  <NavLink
                    to="/studio/slides"
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `studio-tree-item studio-tree-item--slides ${isActive ? "is-active is-highlighted" : ""}`
                    }
                    title="Slides Canvas — Apresentações completas com IA"
                  >
                    <Presentation size={16} strokeWidth={1.7} className="studio-tree-icon studio-tree-icon--blue" />
                    <span>Slides Canvas</span>
                    <span className="studio-tree-badge studio-tree-badge--blue">Novo</span>
                  </NavLink>

                  {/* Roteiro de Gravação */}
                  <NavLink
                    to="/studio/roteiro"
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `studio-tree-item studio-tree-item--roteiro ${isActive ? "is-active is-highlighted" : ""}`
                    }
                    title="Roteiro de Gravação — Videoaulas decupadas cena a cena"
                  >
                    <Video size={16} strokeWidth={1.7} className="studio-tree-icon studio-tree-icon--emerald" />
                    <span>Roteiro de Aula</span>
                    <span className="studio-tree-badge studio-tree-badge--emerald">Vídeo</span>
                  </NavLink>

                  {/* Pacote de Aula */}
                  <NavLink
                    to="/studio/pacote"
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `studio-tree-item studio-tree-item--pacote ${isActive ? "is-active is-highlighted" : ""}`
                    }
                    title="Pacote Completo — Jogo, slides e roteiro integrados"
                  >
                    <Package size={16} strokeWidth={1.7} className="studio-tree-icon studio-tree-icon--rose" />
                    <span>Pacote de Aula</span>
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Modo colapsado: Card de Ação Rápida de Criação */
          <div className="studio-collapsed-group">
            <NavLink
              to={`/canvas-generator/${userSlug}`}
              className="studio-collapsed-active-card studio-collapsed-active-card--purple"
              title="Criar Game Canvas"
              onClick={onNavigate}
            >
              <PlusCircle size={17} strokeWidth={2} />
            </NavLink>
          </div>
        )}
      </div>

      {/* Rodapé: Ações de sessão e recolhimento do menu */}
      <div className="studio-sidebar-footer">
        <div className="studio-sidebar-footer__dock">
          <button
            type="button"
            className="studio-collapse"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <PanelLeftOpen size={15} /> : <><PanelLeftClose size={15} /><span>Recolher</span></>}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="studio-logout-pill"
            aria-label="Sair da conta"
            title="Sair da conta"
          >
            <LogOut size={15} />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
