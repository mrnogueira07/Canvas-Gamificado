import React, { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { ProjectCard } from "../components/ui/Card";
import {
  Plus,
  Search,
  Trash2,
  FileText,
  LayoutGrid,
  List,
  Filter,
  SearchX,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  addDoc,
  updateDoc,
} from "firebase/firestore";

const STORAGE_KEY = "gamecanvas_projects";
const TRASH_KEY = "gamecanvas_trash";

interface TrashedProject extends Omit<Project, "createdAt"> {
  createdAt: string;
  deletedAt: string;
}

interface Folder {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  parentId?: string | null;
}

const FOLDER_COLORS = [
  {
    value: "indigo",
    bg: "bg-indigo-500",
    light: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-600",
  },
  {
    value: "rose",
    bg: "bg-rose-500",
    light: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-600",
  },
  {
    value: "emerald",
    bg: "bg-emerald-500",
    light: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
  },
  {
    value: "amber",
    bg: "bg-amber-500",
    light: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-600",
  },
  {
    value: "violet",
    bg: "bg-violet-500",
    light: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-600",
  },
  {
    value: "sky",
    bg: "bg-sky-500",
    light: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-600",
  },
];

/**
 * Utilitário para obter as cores configuradas para uma pasta
 */
function getColorConfig(color: string) {
  return FOLDER_COLORS.find((c) => c.value === color) || FOLDER_COLORS[0];
}

// ───────────────────────────────────────────────────────────────────────────
// ── COMPONENTES AUXILIARES ────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────

// ── Folder Components ──
function FolderCard({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
  onMoveFolder,
  displayMode = "grid",
  onDropItem,
}: {
  folder: Folder;
  count: number;
  onOpen: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onMoveFolder: (folder: Folder) => void;
  displayMode?: "grid" | "compact";
  onDropItem?: (itemId: string, itemType: "project" | "folder") => void;
}) {
  const cc = getColorConfig(folder.color);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsEditing(true);
  };

  const handleRenameSubmit = () => {
    if (editName.trim() && editName !== folder.name) {
      onRename(folder.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type && data.id) {
        if (data.type === "folder" && data.id === folder.id) return; // prevent dropping into itself
        onDropItem?.(data.id, data.type);
      }
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "folder", id: folder.id }));
    e.dataTransfer.effectAllowed = "move";
    
    // Better dragging visuals
    const clonedRow = e.currentTarget.cloneNode(true) as HTMLElement;
    clonedRow.style.width = getComputedStyle(e.currentTarget).width;
    clonedRow.style.height = getComputedStyle(e.currentTarget).height;
    clonedRow.classList.add('drag-ghost');
    clonedRow.style.position = 'absolute';
    clonedRow.style.top = '-9999px';
    document.body.appendChild(clonedRow);
    
    e.dataTransfer.setDragImage(clonedRow, 20, 20);
    
    // Cleanup after drag starts
    setTimeout(() => clonedRow.remove(), 100);
  };

  const isCompact = displayMode === "compact";

  return (
    <div 
      className={`relative group w-full flex flex-col ${isCompact ? "" : "aspect-[3/4]"}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        onClick={() => {
          if (!isEditing) onOpen(folder.id);
        }}
        onContextMenu={handleContextMenu}
        className={`w-full flex-1 flex ${isCompact ? "flex-row items-center justify-start gap-4 p-3" : "flex-col items-center justify-center gap-3 p-5"} ${cc.light} border-2 ${isDragOver ? "border-indigo-500 scale-[1.02]" : cc.border} rounded-3xl hover:shadow-lg transition-all active:scale-95 cursor-pointer relative overflow-hidden`}
      >
        <div
          className={`${isCompact ? "w-10 h-10 rounded-xl" : "w-14 h-14 rounded-2xl"} ${cc.bg} flex items-center justify-center shadow-md relative z-10 shrink-0`}
        >
          <FolderOpen className={`${isCompact ? "w-5 h-5" : "w-7 h-7"} text-white`} />
        </div>
        <div className={`relative z-10 w-full px-2 ${isCompact ? "text-left flex-1" : "text-center"}`}>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              className={`w-full ${isCompact ? "text-left text-sm" : "text-center text-[10px]"} font-black uppercase tracking-wider leading-tight bg-white/80 border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-indigo-400`}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className={`flex ${isCompact ? "items-center justify-between" : "flex-col"}`}>
              <p
                className={`${isCompact ? "text-[13px]" : "text-[11px]"} font-black ${cc.text} uppercase tracking-wider leading-tight truncate`}
              >
                {folder.name}
              </p>
              <p className={`text-[10px] text-slate-400 font-bold ${isCompact ? "" : "mt-1"}`}>
                {count} item{count !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </button>

      <div className={`absolute ${isCompact ? "top-1/2 -translate-y-1/2 right-2 flex-row gap-2" : "top-2 right-2 flex-col gap-1"} z-20 opacity-0 group-hover:opacity-100 transition-opacity flex`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveFolder(folder);
          }}
          className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-500 transition-colors cursor-pointer text-slate-400 mt-1"
          title="Mover Pasta"
        >
          <Folder className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(folder.id);
          }}
          className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer text-slate-400 mt-1"
          title="Excluir Pasta"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


// ───────────────────────────────────────────────────────────────────────────
// ── PERSISTÊNCIA (LOCALSTORAGE BACKUP) ────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────

/**
 * Carrega projetos do cache local (usado como fallback ou quando offline)
 */
function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored).map((p: any) => ({
      ...p,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    }));
  } catch (error) {
    console.warn("Erro ao carregar cache local de projetos:", error);
    return [];
  }
}

/**
 * Carrega a lixeira do cache local
 */
function loadTrash(): TrashedProject[] {
  try {
    const stored = localStorage.getItem(TRASH_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Salva projetos no cache local
 */
function saveProjects(projects: Project[]) {
  const serializable = projects.map((p) => ({
    ...p,
    createdAt:
      p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt:
      p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

/**
 * Salva a lixeira no cache local
 */
function saveTrash(trash: TrashedProject[]) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

// ───────────────────────────────────────────────────────────────────────────
// ── COMPONENTE PRINCIPAL: DASHBOARD ────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [trash, setTrash] = useState<TrashedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"projects" | "trash">("projects");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Folder management state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("indigo");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [movingProject, setMovingProject] = useState<Project | null>(null);
  const [movingFolder, setMovingFolder] = useState<Folder | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<
    string | null
  >(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"grid" | "compact">(
    () => (localStorage.getItem("gamecanvas_displayMode") as "grid" | "compact") || "grid"
  );
  
  const handleDisplayMode = (mode: "grid"|"compact") => {
    setDisplayMode(mode);
    localStorage.setItem("gamecanvas_displayMode", mode);
  };

  // Estados de Filtro
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");

  /**
   * Reseta todos os filtros e busca para o estado original
   */
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setGradeFilter("all");
    setSubjectFilter("all");
    setYearFilter("all");
    setQuarterFilter("all");
  };

  /**
   * Efeito Inicial: Busca dados do Firebase (ou fallback local)
   */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        let projectsData: Project[] = [];

        if (user) {
          // 1. Busca Projetos do Firestore
          const q = query(
            collection(db, "projects"),
            where("userId", "==", user.uid),
          );
          const querySnapshot = await getDocs(q);
          projectsData = querySnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const parseDate = (val: any) => {
              if (!val) return new Date();
              if (val.seconds) return new Date(val.seconds * 1000);
              if (val instanceof Date) return val;
              const d = new Date(val);
              return isNaN(d.getTime()) ? new Date() : d;
            };
            return {
              ...data,
              id: docSnap.id,
              createdAt: parseDate(data.createdAt),
              updatedAt: parseDate(data.updatedAt),
            } as Project;
          });

          // 2. Busca Pastas do Firestore
          const fq = query(
            collection(db, "folders"),
            where("userId", "==", user.uid),
          );
          const fSnap = await getDocs(fq);
          const foldersData = fSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Folder,
          );
          setFolders(foldersData);

          // 3. Atualiza cache local para trabalho offline posterior
          saveProjects(projectsData);
        } else {
          // Fallback sem usuário (offline ou dev)
          projectsData = loadProjects();
        }

        // Ordenação Inicial: Por ordem explícita ou por data
        projectsData.sort((a, b) => {
          if (typeof a.order === 'number' && typeof b.order === 'number') {
            return b.order - a.order; // Decrescente (maior em primeiro)
          }
          const timeA = (a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0)).getTime();
          const timeB = (b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0)).getTime();
          return timeB - timeA;
        });

        setProjects(projectsData);
        setTrash(loadTrash());
      } catch (error) {
        console.error("Erro ao sincronizar dados com Firestore:", error);
        setProjects(loadProjects()); // Fallback emergencial
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ─── Folder Operations ───────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const user = auth.currentUser;
    if (!user) return;

    const folderData: Omit<Folder, "id"> = {
      name: newFolderName.trim(),
      color: newFolderColor,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      parentId: currentFolderId || null,
    };

    try {
      const ref = await addDoc(collection(db, "folders"), folderData);
      setFolders((prev) => [...prev, { id: ref.id, ...folderData }]);
      setNewFolderName("");
      setNewFolderColor("indigo");
      setShowNewFolderModal(false);
    } catch (err) {
      console.error("Erro ao criar pasta:", err);
    }
  };

  const handleRenameFolderInline = async (
    folderId: string,
    newName: string,
  ) => {
    try {
      await updateDoc(doc(db, "folders", folderId), { name: newName });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f)),
      );
    } catch (err) {
      console.error("Erro ao renomear pasta:", err);
    }
  };

  const handleRenameFolder = async () => {
    if (!editingFolder || !editingFolder.name.trim()) return;
    try {
      await updateDoc(doc(db, "folders", editingFolder.id), {
        name: editingFolder.name.trim(),
        color: editingFolder.color,
      });
      setFolders((prev) =>
        prev.map((f) => (f.id === editingFolder.id ? editingFolder : f)),
      );
      setEditingFolder(null);
    } catch (err) {
      console.error("Erro ao renomear pasta modal:", err);
    }
  };

  const handleDeleteFolderClick = (folderId: string) => {
    const count = projects.filter(
      (p) => (p as any).folderId === folderId,
    ).length + folders.filter(f => f.parentId === folderId).length;
    if (count > 0) {
      setConfirmDeleteFolderId(folderId);
    } else {
      handleDeleteFolder(folderId);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const batch = writeBatch(db);
      const projectsToDelete = projects.filter(
        (p) => (p as any).folderId === folderId,
      );

      projectsToDelete.forEach((p) => {
        if (p.id) batch.delete(doc(db, "projects", p.id));
      });
      batch.delete(doc(db, "folders", folderId));

      await batch.commit();

      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setProjects((prev) =>
        prev.filter((p) => (p as any).folderId !== folderId),
      );
      setConfirmDeleteFolderId(null);
      if (currentFolderId === folderId) setCurrentFolderId(null);
    } catch (err) {
      console.error("Erro ao excluir pasta e conteúdos:", err);
    }
  };

  const handleMoveToFolder = async (
    project: Project,
    folderId: string | null,
  ) => {
    try {
      if (project.id) {
        await updateDoc(doc(db, "projects", project.id), { folderId });
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, folderId } : p)),
      );
      setMovingProject(null);
    } catch (err) {
      console.error("Erro ao mover projeto:", err);
    }
  };

  const handleMoveFolderToFolder = async (
    targetFolder: Folder,
    parentId: string | null,
  ) => {
    if (targetFolder.id === parentId) return;
    try {
      if (targetFolder.id) {
        await updateDoc(doc(db, "folders", targetFolder.id), { parentId });
      }
      setFolders((prev) =>
        prev.map((f) => (f.id === targetFolder.id ? { ...f, parentId } : f)),
      );
      setMovingFolder(null);
    } catch (err) {
      console.error("Erro ao mover pasta:", err);
    }
  };

  const handleReorderProject = async (targetId: string, itemType: "project" | "folder", dragId: string) => {
    if (itemType !== "project" || targetId === dragId) return;

    // Obtém apenas os projetos que estão sendo exibidos (mesma pasta)
    const currentList = currentFolderId
      ? projects.filter((p) => (p as any).folderId === currentFolderId)
      : projects.filter((p) => !(p as any).folderId);

    // Garante estado ordenado como na tela
    const sorted = [...currentList].sort((a, b) => {
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return b.order - a.order;
      }
      const timeA = (a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0)).getTime();
      const timeB = (b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0)).getTime();
      return timeB - timeA;
    });

    const dragIndex = sorted.findIndex(p => p.id === dragId);
    const dropIndex = sorted.findIndex(p => p.id === targetId);

    if (dragIndex === -1 || dropIndex === -1) return;

    // Remove do index raiz e insere no target
    const [draggedItem] = sorted.splice(dragIndex, 1);
    sorted.splice(dropIndex, 0, draggedItem);

    // Atualiza order baseando-se no length (maior = topo/início)
    const updates: { id: string, order: number }[] = [];
    const baseOrder = sorted.length * 10;
    sorted.forEach((p, idx) => {
      const newOrder = baseOrder - (idx * 10);
      if (p.order !== newOrder) {
        updates.push({ id: p.id, order: newOrder });
      }
    });

    if (updates.length > 0) {
      setProjects(prev => prev.map(p => {
        const update = updates.find(u => u.id === p.id);
        return update ? { ...p, order: update.order } : p;
      }));

      // Firebase Batch Update
      if (auth.currentUser) {
        try {
          const batch = writeBatch(db);
          let count = 0;
          updates.forEach(u => {
            if (count < 500) { // Safely within 500 limit batch
              batch.update(doc(db, "projects", u.id), { order: u.order });
              count++;
            }
          });
          await batch.commit();
        } catch (error) {
          console.error("Erro ao reordenar:", error);
        }
      }
    }
  };

  // ─── Project Operations ──────────────────────────────────────────────────
  const moveToTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    try {
      if (auth.currentUser) await deleteDoc(doc(db, "projects", id));
      const dateToIso = (d: any) =>
        d instanceof Date ? d.toISOString() : String(d);
      const trashed: TrashedProject = {
        ...project,
        createdAt: dateToIso(project.createdAt),
        updatedAt: dateToIso(project.updatedAt),
        deletedAt: new Date().toLocaleDateString("pt-BR"),
      };
      const updatedProjects = projects.filter((p) => p.id !== id);
      const updatedTrash = [...trash, trashed];
      setProjects(updatedProjects);
      setTrash(updatedTrash);
      saveProjects(updatedProjects);
      saveTrash(updatedTrash);
    } catch (error) {
      console.error("Erro ao mover para lixeira:", error);
    }
  };

  const restoreFromTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const trashed = trash.find((p) => p.id === id);
    if (!trashed) return;
    try {
      const restored: Project = {
        ...trashed,
        createdAt: new Date(trashed.createdAt),
        updatedAt: trashed.updatedAt ? new Date(trashed.updatedAt) : new Date(),
      };
      if (auth.currentUser) {
        await setDoc(doc(db, "projects", id), {
          ...restored,
          createdAt:
            restored.createdAt instanceof Date
              ? restored.createdAt.toISOString()
              : String(restored.createdAt),
          updatedAt:
            restored.updatedAt instanceof Date
              ? restored.updatedAt.toISOString()
              : String(restored.updatedAt),
        });
      }
      const updatedTrash = trash.filter((p) => p.id !== id);
      const updatedProjects = [...projects, restored];
      setTrash(updatedTrash);
      setProjects(updatedProjects);
      saveTrash(updatedTrash);
      saveProjects(updatedProjects);
    } catch (error) {
      console.error("Erro ao restaurar:", error);
    }
  };

  const deletePermanently = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTrash = trash.filter((p) => p.id !== id);
    setTrash(updatedTrash);
    saveTrash(updatedTrash);
    setConfirmDeleteId(null);
  };

  const confirmEmptyTrash = () => {
    setTrash([]);
    saveTrash([]);
    setConfirmDeleteId(null);
  };

  const moveAllToTrash = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user && projects.length > 0) {
        const batch = writeBatch(db);
        projects.forEach((p) => {
          if (p.id) batch.delete(doc(db, "projects", p.id));
        });
        await batch.commit();
      }
      const now = new Date().toLocaleDateString("pt-BR");
      const dateToIso = (d: any) =>
        d instanceof Date ? d.toISOString() : String(d);
      const newTrashed: TrashedProject[] = projects.map((p) => ({
        ...p,
        createdAt: dateToIso(p.createdAt),
        updatedAt: dateToIso(p.updatedAt),
        deletedAt: now,
      }));
      const updatedTrash = [...trash, ...newTrashed];
      setProjects([]);
      setTrash(updatedTrash);
      saveProjects([]);
      saveTrash(updatedTrash);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Erro ao mover tudo para lixeira:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = (list: any[]) => {
    return list.filter((p) => {
      const matchesSearch =
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.formData?.subject?.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        typeFilter === "all" || p.formData?.gameType === typeFilter;
      const matchesGrade =
        gradeFilter === "all" || p.formData?.gradeLevel === gradeFilter;
      const matchesSubject =
        subjectFilter === "all" || p.formData?.subject === subjectFilter;
      const matchesYear =
        yearFilter === "all" || p.formData?.year === yearFilter;
      const matchesQuarter =
        quarterFilter === "all" || p.formData?.quarter === quarterFilter;
      return (
        matchesSearch &&
        matchesType &&
        matchesGrade &&
        matchesSubject &&
        matchesYear &&
        matchesQuarter
      );
    });
  };

  // Projects in current folder context
  const projectsInView = currentFolderId
    ? projects.filter((p) => (p as any).folderId === currentFolderId)
    : projects.filter((p) => !(p as any).folderId);

  const filteredProjects = filterProjects(projectsInView);
  const filteredTrash = filterProjects(trash);

  const gameTypes = Array.from(
    new Set(projects.map((p) => p.formData?.gameType).filter(Boolean)),
  );
  const gradeLevels = Array.from(
    new Set(projects.map((p) => p.formData?.gradeLevel).filter(Boolean)),
  );
  const subjects = Array.from(
    new Set(projects.map((p) => p.formData?.subject).filter(Boolean)),
  );
  const years = Array.from(
    new Set(projects.map((p) => p.formData?.year).filter(Boolean)),
  );
  const quarters = Array.from(
    new Set(projects.map((p) => p.formData?.quarter).filter(Boolean)),
  );

  const currentFolder = folders.find((f) => f.id === currentFolderId);

  const toolbar = (
    <div className="flex items-center gap-1 md:gap-2 w-full min-w-0">
      <div className="flex shrink-0 bg-slate-100/50 p-1 rounded-full items-center gap-0.5 md:gap-1 border border-slate-200/20">
        <button
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer ${view === "projects" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:text-slate-600"}`}
          onClick={() => setView("projects")}
        >
          <span className="hidden sm:inline">Planejamentos</span>
          <span className="sm:hidden">Meus</span>
          {projects.length > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-[8px] font-black ${view === "projects" ? "bg-white/20 text-white" : "bg-indigo-600 text-white"}`}
            >
              {projects.length}
            </span>
          )}
        </button>
        <button
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer ${view === "trash" ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20" : "text-slate-400 hover:text-slate-600"}`}
          onClick={() => setView("trash")}
        >
          <span className="hidden sm:inline">Excluídos</span>
          <span className="sm:hidden">Lixo</span>
          {trash.length > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-[8px] font-black ${view === "trash" ? "bg-white/20 text-white" : "bg-rose-600 text-white"}`}
            >
              {trash.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 max-w-sm relative group min-w-[100px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Pesquisar..."
          className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border border-slate-200/20 rounded-full text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500/30 transition-all placeholder:text-slate-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {(search ||
        typeFilter !== "all" ||
        gradeFilter !== "all" ||
        subjectFilter !== "all" ||
        yearFilter !== "all" ||
        quarterFilter !== "all") && (
          <button
            onClick={clearFilters}
            className="flex shrink-0 items-center justify-center gap-2 p-2 px-4 bg-white text-slate-400 border border-slate-200 rounded-full text-[10px] font-black tracking-widest uppercase hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <SearchX className="w-3.5 h-3.5" />
            <span className="hidden lg:block">Limpar</span>
          </button>
        )}

      {view === "projects" && (
        <button
          onClick={() => setShowNewFolderModal(true)}
          className="flex shrink-0 items-center justify-center w-9 h-9 md:w-auto md:px-4 md:py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-black tracking-widest uppercase hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm cursor-pointer active:scale-95"
        >
          <FolderPlus className="w-4 h-4" />
          <span className="hidden lg:block ml-2">Nova Pasta</span>
        </button>
      )}

      <button
        onClick={() => navigate("/generator")}
        className="flex shrink-0 items-center justify-center w-9 h-9 md:w-auto md:px-4 md:py-2.5 bg-slate-900 text-white rounded-full text-[10px] font-black tracking-widest uppercase transition-all shadow-xl shadow-slate-900/10 hover:shadow-indigo-600/20 hover:bg-indigo-600 cursor-pointer group active:scale-95"
      >
        <Plus className="w-4 h-4 md:w-3.5 md:h-3.5 transition-transform group-hover:rotate-90" />
        <span className="hidden lg:block ml-1.5">Novo Projeto</span>
      </button>
    </div>
  );

  return (
    <Layout toolbar={toolbar}>
      <div className="max-w-[1400px] mx-auto h-full flex flex-col">

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Carregando...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20">
            {/* Filter and View Controls */}
            <div className="flex flex-col gap-4 mb-8 bg-white/50 backdrop-blur-sm p-5 rounded-[2.5rem] border border-white/50 shadow-sm transition-all hover:bg-white/80">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Filtros Avançados
                </h4>
                <div className="flex items-center gap-2 h-9 p-1 bg-slate-100/50 rounded-xl border border-slate-200/20">
                  <button
                    onClick={() => handleDisplayMode("grid")}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${displayMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span className="hidden sm:inline">Grade</span>
                  </button>
                  <button
                    onClick={() => handleDisplayMode("compact")}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${displayMode === "compact" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <List className="w-3 h-3" />
                    <span className="hidden sm:inline">Compacto</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  {
                    label: "Tipo de Jogo",
                    value: typeFilter,
                    set: setTypeFilter,
                    options: gameTypes,
                    placeholder: "TODOS",
                  },
                  {
                    label: "Nível",
                    value: gradeFilter,
                    set: setGradeFilter,
                    options: gradeLevels,
                    placeholder: "TODOS",
                  },
                  {
                    label: "Matéria",
                    value: subjectFilter,
                    set: setSubjectFilter,
                    options: subjects,
                    placeholder: "TODAS",
                  },
                  {
                    label: "Ano/Série",
                    value: yearFilter,
                    set: setYearFilter,
                    options: years,
                    placeholder: "TODOS",
                  },
                  {
                    label: "Bimestre",
                    value: quarterFilter,
                    set: setQuarterFilter,
                    options: quarters,
                    placeholder: "TODOS",
                  },
                ].map(({ label, value, set, options, placeholder }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">
                      {label}
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm focus-within:border-indigo-200 transition-all">
                      <select
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-[10px] font-bold uppercase tracking-widest text-slate-600 cursor-pointer"
                      >
                        <option value="all">{placeholder}</option>
                        {options.sort().map((o) => (
                          <option key={String(o)} value={String(o)}>
                            {String(o).toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── FOLDERS + CONTENT ── */}
            {view === "projects" && (
              <>
                {/* Breadcrumb */}
                {currentFolderId && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mb-6 px-2"
                  >
                    <button
                      onClick={() => setCurrentFolderId(null)}
                      className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-indigo-500 uppercase tracking-widest transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Início
                    </button>
                    <ChevronRight className="w-3 h-3 text-slate-300" />
                    <div
                      className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${getColorConfig(currentFolder?.color || "indigo").text}`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {currentFolder?.name}
                    </div>
                    <span className="text-[9px] text-slate-300 font-bold ml-1">
                      ({filteredProjects.length} projeto
                      {filteredProjects.length !== 1 ? "s" : ""})
                    </span>
                  </motion.div>
                )}

                {/* Folders Grid */}
                {folders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId).length > 0 && (
                  <div className="mb-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5" />
                      Pastas ({folders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId).length})
                    </p>
                    <div className={displayMode === "compact" ? "flex flex-col gap-2" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"}>
                      <AnimatePresence>
                        {folders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId).map((folder, idx) => {
                          const count = projects.filter(
                            (p) => (p as any).folderId === folder.id,
                          ).length + folders.filter(f => f.parentId === folder.id).length;
                          return (
                            <motion.div
                              key={folder.id}
                              initial={{ opacity: 0, scale: 0.9, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ delay: idx * 0.04 }}
                            >
                                <FolderCard
                                  folder={folder}
                                  count={count}
                                  onOpen={(id) => setCurrentFolderId(id)}
                                  onRename={handleRenameFolderInline}
                                  onDelete={handleDeleteFolderClick}
                                  onMoveFolder={(f) => setMovingFolder(f)}
                                  displayMode={displayMode}
                                  onDropItem={(itemId, itemType) => {
                                    if (itemType === "project") {
                                      const p = projects.find(proj => proj.id === itemId);
                                      if (p) handleMoveToFolder(p, folder.id);
                                    } else if (itemType === "folder") {
                                      const f = folders.find(fd => fd.id === itemId);
                                      if (f) handleMoveFolderToFolder(f, folder.id);
                                    }
                                  }}
                                />
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                    <div className="mt-6 border-t border-slate-100" />
                  </div>
                )}
              </>
            )}

            {/* Projects / Empty States */}
            {filteredProjects.length === 0 && view === "projects" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-[400px] flex flex-col items-center justify-center text-center glass-light rounded-[3rem] border border-white/50 shadow-2xl shadow-indigo-500/5 max-w-4xl mx-auto px-10"
              >
                <div className="relative w-24 h-24 glass-light rounded-[2rem] flex items-center justify-center shadow-2xl border border-white overflow-hidden mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent" />
                  {currentFolderId ? (
                    <FolderOpen className="relative z-10 w-10 h-10 text-indigo-400" />
                  ) : (
                    <FileText className="relative z-10 w-10 h-10 text-indigo-500" />
                  )}
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">
                  {currentFolderId
                    ? "Pasta vazia"
                    : "Nenhum planejamento encontrado"}
                </h3>
                <p className="text-slate-500 max-w-sm mb-8 font-medium leading-relaxed text-sm">
                  {currentFolderId
                    ? 'Mova projetos para esta pasta clicando em "Mover para pasta" em qualquer projeto.'
                    : "Comece criando seu primeiro planejamento educacional gamificado com nossa IA."}
                </p>
                {!currentFolderId && (
                  <button
                    onClick={() => navigate("/generator")}
                    className="px-10 py-4 bg-indigo-500 text-white rounded-3xl font-black text-xs uppercase tracking-[0.25em] shadow-2xl shadow-indigo-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-3"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Primeiro Projeto
                  </button>
                )}
              </motion.div>
            ) : filteredTrash.length === 0 && view === "trash" ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center opacity-40">
                <Trash2 className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                  A lixeira está vazia
                </p>
              </div>
            ) : (
              <div className={displayMode === "compact" ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"}>
                {(view === "projects"
                  ? filteredProjects
                  : filteredTrash
                ).map((p, idx) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    transition={{
                      duration: 0.4,
                      delay: idx * 0.05,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                  >
                    <ProjectCard
                      project={p as any}
                      displayMode={displayMode}
                      folders={folders}
                      onDelete={(id, e) => moveToTrash(id, e)}
                      onRestore={(id, e) => restoreFromTrash(id, e)}
                      onDeletePermanent={(id, _e) =>
                        setConfirmDeleteId(id)
                      }
                      onClick={(id) => navigate(`/generator?id=${id}`)}
                      isTrash={view === "trash"}
                        onMoveToFolder={(project) =>
                        setMovingProject(project as any)
                      }
                      onDropOnProject={handleReorderProject}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: Nova Pasta / Editar Pasta ── */}
      <AnimatePresence>
        {(showNewFolderModal || editingFolder) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-white text-center"
            >
              <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30">
                <FolderPlus className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-1 tracking-tight">
                {editingFolder ? "Editar Pasta" : "Nova Pasta"}
              </h2>
              <p className="text-slate-400 text-xs font-bold mb-8">
                {editingFolder
                  ? "Renomeie e escolha uma cor."
                  : "Organize seus projetos em pastas."}
              </p>

              <div className="space-y-5">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome da pasta..."
                  value={editingFolder ? editingFolder.name : newFolderName}
                  onChange={(e) =>
                    editingFolder
                      ? setEditingFolder({
                        ...editingFolder,
                        name: e.target.value,
                      })
                      : setNewFolderName(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      editingFolder
                        ? handleRenameFolder()
                        : handleCreateFolder();
                  }}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 text-slate-800 font-bold text-sm text-center"
                />

                {/* Color Picker */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Cor da Pasta
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {FOLDER_COLORS.map((c) => {
                      const isSelected = editingFolder
                        ? editingFolder.color === c.value
                        : newFolderColor === c.value;
                      return (
                        <button
                          key={c.value}
                          onClick={() =>
                            editingFolder
                              ? setEditingFolder({
                                ...editingFolder,
                                color: c.value,
                              })
                              : setNewFolderColor(c.value)
                          }
                          className={`w-8 h-8 ${c.bg} rounded-full transition-all cursor-pointer ${isSelected ? "ring-4 ring-offset-2 ring-slate-300 scale-110" : "hover:scale-110"}`}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white mx-auto" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowNewFolderModal(false);
                      setEditingFolder(null);
                      setNewFolderName("");
                    }}
                    className="flex-1 py-3.5 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={
                      editingFolder ? handleRenameFolder : handleCreateFolder
                    }
                    className="flex-1 py-3.5 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                  >
                    {editingFolder ? "Salvar" : "Criar Pasta"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Mover para Pasta ── */}
      <AnimatePresence>
        {(movingProject || movingFolder) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-white"
            >
              <h2 className="text-lg font-black text-slate-800 mb-1 tracking-tight text-center">
                Mover para Pasta
              </h2>
              <p className="text-slate-400 text-xs font-bold text-center mb-6">
                Selecione onde deseja colocar {movingProject ? "este projeto" : "esta pasta"}
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    if (movingProject) handleMoveToFolder(movingProject, null);
                    if (movingFolder) handleMoveFolderToFolder(movingFolder, null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left ${((movingProject && !(movingProject as any).folderId) || (movingFolder && !movingFolder.parentId)) ? "border-indigo-300 bg-indigo-50" : "border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50"}`}
                >
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Folder className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700">
                      Sem pasta (Início)
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold">
                      {projects.filter((p) => !(p as any).folderId).length} projetos
                    </p>
                  </div>
                  {((movingProject && !(movingProject as any).folderId) || (movingFolder && !movingFolder.parentId)) && (
                    <Check className="w-4 h-4 text-indigo-500 ml-auto" />
                  )}
                </button>

                {folders.filter(f => !movingFolder || f.id !== movingFolder.id).map((folder) => {
                  const cc = getColorConfig(folder.color);
                  const count = projects.filter(
                    (p) => (p as any).folderId === folder.id,
                  ).length + folders.filter(f => f.parentId === folder.id).length;
                  const isCurrentFolder =
                    movingProject ? (movingProject as any).folderId === folder.id : movingFolder?.parentId === folder.id;
                  return (
                    <button
                      key={folder.id}
                      onClick={() => {
                        if (movingProject) handleMoveToFolder(movingProject, folder.id);
                        if (movingFolder) handleMoveFolderToFolder(movingFolder, folder.id);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left ${isCurrentFolder ? `${cc.border} ${cc.light}` : `border-slate-100 hover:${cc.border} hover:${cc.light}`}`}
                    >
                      <div
                        className={`w-9 h-9 ${cc.bg} rounded-xl flex items-center justify-center`}
                      >
                        <FolderOpen className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className={`text-xs font-black ${cc.text}`}>
                          {folder.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold">
                          {count} item{count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {isCurrentFolder && (
                        <Check className={`w-4 h-4 ${cc.text} ml-auto`} />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => { setMovingProject(null); setMovingFolder(null); }}
                className="w-full mt-4 py-3.5 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Confirmar Exclusão de Pasta ── */}
      <AnimatePresence>
        {confirmDeleteFolderId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-white text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">
                Excluir Pasta e Projetos?
              </h2>
              <p className="text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                Você está prestes a excluir esta pasta{" "}
                <strong className="text-rose-500">
                  e todos os{" "}
                  {
                    projects.filter(
                      (p) => (p as any).folderId === confirmDeleteFolderId,
                    ).length
                  }{" "}
                  projetos
                </strong>{" "}
                que estão dentro dela. Eles serão excluídos permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteFolderId(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteFolder(confirmDeleteFolderId)}
                  className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
                >
                  Excluir Tudo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Confirmar Exclusão Permanente ── */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[2.5rem] w-full max-w-sm shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] text-center border border-white"
            >
              <div
                className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl ${confirmDeleteId === "ALL_PROJECTS" ? "bg-amber-50 shadow-amber-500/10" : "bg-rose-50 shadow-rose-500/10"}`}
              >
                <Trash2
                  className={`w-8 h-8 ${confirmDeleteId === "ALL_PROJECTS" ? "text-amber-500" : "text-rose-500"}`}
                />
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-3 tracking-tight uppercase px-4">
                {confirmDeleteId === "ALL"
                  ? "Esvaziar lixeira?"
                  : confirmDeleteId === "ALL_PROJECTS"
                    ? "Limpar tudo?"
                    : "Excluir para sempre?"}
              </h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed mb-10 px-4 opacity-80">
                {confirmDeleteId === "ALL"
                  ? "Isso apagará todos os arquivos da lixeira."
                  : confirmDeleteId === "ALL_PROJECTS"
                    ? "Seus roteiros serão movidos para a lixeira."
                    : "Este projeto será removido permanentemente."}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={(e) => {
                    if (confirmDeleteId === "ALL") confirmEmptyTrash();
                    else if (confirmDeleteId === "ALL_PROJECTS")
                      moveAllToTrash();
                    else deletePermanently(confirmDeleteId!, e);
                  }}
                  className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg cursor-pointer ${confirmDeleteId === "ALL_PROJECTS" ? "bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600" : "bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-600"}`}
                >
                  Confirmar Ação
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Click outside to close folder menu */}
      {folderMenuId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setFolderMenuId(null)}
        />
      )}
    </Layout>
  );
}
