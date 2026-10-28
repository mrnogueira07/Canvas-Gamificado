import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { AppSidebar } from "./AppSidebar";
import "../../styles/studio/studio.css";

export interface LayoutProps {
  children: React.ReactNode;
  toolbar?: React.ReactNode | ((collapsed: boolean, closeMobileMenu?: () => void) => React.ReactNode);
  bottomToolbar?: React.ReactNode | ((collapsed: boolean, closeMobileMenu?: () => void) => React.ReactNode);
  onNewFolderClick?: () => void;
  sidebar?: React.ReactNode;
  search?: string;
  onSearchChange?: (val: string) => void;
  view?: "projects" | "trash";
  onSelectView?: (view: "projects" | "trash") => void;
  projectCount?: number;
  trashCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  hideSidebar?: boolean;
}

export function Layout({ children, hideSidebar = false, ...props }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const items = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button, input');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); menuButton?.focus(); };
  }, [mobileOpen]);

  const handleLogout = async () => {
    try { await signOut(auth); navigate("/login"); }
    catch { setLogoutError("Não foi possível sair. Tente novamente."); }
  };
  const sidebarProps = { ...props, user: auth.currentUser, onLogout: handleLogout };

  return (
    <div className={`studio-shell ${hideSidebar ? "has-no-sidebar" : isCollapsed ? "sidebar-collapsed" : ""}`}>
      <a className="studio-skip-link" href="#studio-main">Ir para o conteúdo</a>
      {!hideSidebar && <AppSidebar {...sidebarProps} isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(value => !value)} className="studio-sidebar-desktop" />}
      {!hideSidebar && (
        <header className="studio-mobile-header">
          <a href="/inicio">
            <img src="/logo-innyx-icon.png" alt="INNYX" style={{ width: 22, height: 22, objectFit: "contain" }} /> MIND CANVAS
          </a>
          <button ref={menuButtonRef} className="studio-icon-button" aria-label="Abrir menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
        </header>
      )}
      {!hideSidebar && mobileOpen && (
        <div className="studio-mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div ref={menuRef} className="studio-mobile-dialog" role="dialog" aria-modal="true" aria-label="Menu de navegação" onClick={event => event.stopPropagation()}>
            <button className="studio-mobile-close studio-icon-button" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
              <X size={20} />
            </button>
            <AppSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
      <div ref={contentRef} className="studio-main-wrap">
        {logoutError && <p role="alert" className="studio-notice">{logoutError}</p>}
        <main id="studio-main">{children}</main>
        <footer className="studio-footer" aria-label="Rodapé institucional Mind Canvas">
          <div className="studio-footer__inner">
            <div className="studio-footer__brand">
              <span className="studio-footer__logo" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(59, 130, 246, 0.25)" stroke="#60a5fa" />
                  <path d="M2 17l10 5 10-5" stroke="#93c5fd" />
                  <path d="M2 12l10 5 10-5" stroke="#60a5fa" />
                </svg>
              </span>
              <span className="studio-footer__title">MIND CANVAS</span>
              <span className="studio-footer__divider" aria-hidden="true">·</span>
              <span className="studio-footer__by">by INNYX Educação</span>
              <span className="studio-footer__pill">BNCC &amp; IA Pedagógica</span>
            </div>

            <nav className="studio-footer__nav" aria-label="Atalhos do rodapé">
              <Link to="/inicio">Início</Link>
              <Link to="/projetos">Meus Projetos</Link>
              <Link to="/ranking">Ranking</Link>
              <Link to="/studio/slides">Slides Canvas</Link>
              <Link to="/studio/roteiro">Roteiro de Gravação</Link>
            </nav>

            <div className="studio-footer__meta">
              <span className="studio-footer__status">
                <span className="studio-footer__status-dot" aria-hidden="true" />
                Ambiente sincronizado
              </span>
              <span className="studio-footer__divider" aria-hidden="true">·</span>
              <span className="studio-footer__tagline">Feito para transformar a educação.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
