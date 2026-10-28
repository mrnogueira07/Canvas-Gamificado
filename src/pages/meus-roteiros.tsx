import React, { useEffect, useState } from "react";
import { Layout } from "../components/ui/Layout";
import { ProjectCard } from "../components/ui/Card";
import {
  Plus,
  Search,
  Trash2,
  FileText,
  LayoutGrid,
  List,
  SearchX,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  Check,
  
  SlidersHorizontal,
  X,
  Trophy,
  Book,
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
  onSnapshot,
} from "firebase/firestore";

const STORAGE_KEY = "gamecanvas_projects";
const TRASH_KEY = "gamecanvas_trash";

interface TrashedProject extends Omit<Project, "createdAt"> {
  createdAt: string;
  deletedAt: string;
}

import { CustomSelect } from "../components/ui/CustomSelect";
import { RankingPanel, RankingModal, type RankingEntry } from "../components/dashboard/Ranking";
import { FolderCard } from "../components/dashboard/FolderCard";
import { FOLDER_COLORS, getColorConfig, type Folder as FolderType } from "../components/dashboard/folderConfig";

// ============================================================================
// PERSISTÊNCIA (LOCALSTORAGE BACKUP)
// ============================================================================

/**
 * Carrega projetos do cache local (usado como fallback ou quando offline)
 */
function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return (JSON.parse(stored) as Project[]).map((p) => ({
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

// ============================================================================
// COMPONENTE PRINCIPAL: DASHBOARD
// ============================================================================

export default function Dashboard() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [trash, setTrash] = useState<TrashedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"projects" | "trash">("projects");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showRankingModal, setShowRankingModal] = useState(false);

  // Estado de gerenciamento de pastas
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("violet");
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [movingProject, setMovingProject] = useState<Project | null>(null);
  const [movingFolder, setMovingFolder] = useState<FolderType | null>(null);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<
    string | null
  >(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"grid" | "compact" | "list">(
    () => (localStorage.getItem("gamecanvas_displayMode") as "grid" | "compact" | "list") || "grid"
  );

  const handleDisplayMode = (mode: "grid" | "compact" | "list") => {
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

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeFiltersCount = [typeFilter, gradeFilter, subjectFilter, yearFilter, quarterFilter].filter(v => v !== "all").length;

  // Estados & Listeners do Ranking
  const [usersMap, setUsersMap] = useState<Record<string, { name: string; email: string; photoURL?: string | null }>>({});
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [rankingLoading, setRankingLoading] = useState(true);

  // Sincroniza informações de perfil do usuário atual na coleção "users"
  useEffect(() => {
    const syncUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(
          userRef,
          {
            uid: user.uid,
            name: user.displayName || user.email?.split("@")[0] || "Usuário",
            email: user.email || "",
            photoURL: user.photoURL || null,
          },
          { merge: true }
        );
      } catch (err) {
        console.error("Erro ao sincronizar perfil do usuário:", err);
      }
    };
    syncUserProfile();
  }, []);

  // Listeners em tempo real para ranking global
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const usersData: Record<string, { name: string; email: string; photoURL?: string | null }> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          usersData[doc.id] = {
            name: data.name || data.displayName || "Usuário",
            email: data.email || "",
            photoURL: data.photoURL || null,
          };
        });
        setUsersMap(usersData);
      },
      (error) => {
        console.error("Erro ao escutar usuários para o ranking:", error);
      }
    );

    const unsubscribeProjects = onSnapshot(
      collection(db, "projects"),
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.userId) {
            counts[data.userId] = (counts[data.userId] || 0) + 1;
          }
        });
        setProjectCounts(counts);
        setRankingLoading(false);
      },
      (error) => {
        console.error("Erro ao escutar projetos para o ranking:", error);
        setRankingLoading(false);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeProjects();
    };
  }, []);

  const ranking = React.useMemo(() => {
    const allUserIds = new Set([...Object.keys(usersMap), ...Object.keys(projectCounts)]);
    const entries: RankingEntry[] = Array.from(allUserIds)
      .map((uid) => {
        const u = usersMap[uid];
        const count = projectCounts[uid] || 0;
        return {
          userId: uid,
          displayName: u?.name || "Usuário",
          photoURL: u?.photoURL || null,
          email: u?.email || "",
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
    return entries;
  }, [usersMap, projectCounts]);

  const top3 = React.useMemo(() => ranking.slice(0, 3), [ranking]);

  const currentUserPos = React.useMemo(() => {
    const user = auth.currentUser;
    if (!user) return null;
    const index = ranking.findIndex((entry) => entry.userId === user.uid);
    if (index === -1) {
      const dummyEntry: RankingEntry = {
        userId: user.uid,
        displayName: user.displayName || "Você",
        photoURL: user.photoURL || null,
        email: user.email || "",
        count: 0,
      };
      return {
        position: ranking.length + 1,
        entry: dummyEntry,
      };
    }
    return {
      position: index + 1,
      entry: ranking[index],
    };
  }, [ranking]);

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
            const parseDate = (val: unknown) => {
              if (!val) return new Date();
              if (typeof val === "object" && val !== null && "seconds" in val) {
                return new Date((val as { seconds: number }).seconds * 1000);
              }
              if (val instanceof Date) return val;
              const d = new Date(val as string | number);
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
            (d) => ({ id: d.id, ...d.data() }) as FolderType,
          );
          setFolders(foldersData);

          // 3. Atualiza cache local para trabalho offline posterior
          saveProjects(projectsData);
        } else {
          // Se nao tiver logado (offline ou desenvolvendo), pega do local
          projectsData = loadProjects();
        }

        // Ordena primeiro por quem foi mexido por ultimo (ou ordem manual) e depois por data
        projectsData.sort((a, b) => {
          const orderA = (typeof a.order === 'number') ? a.order : 0;
          const orderB = (typeof b.order === 'number') ? b.order : 0;

          if (orderB !== orderA) {
            return orderB - orderA;
          }

          const timeA = (a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0)).getTime();
          const timeB = (b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0)).getTime();
          return timeB - timeA;
        });

        setProjects(projectsData);
        setTrash(loadTrash());
      } catch (error) {
        console.error("Erro ao sincronizar dados com Firestore:", error);
        setProjects(loadProjects()); // Se der ruim, pega do cache local
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ============================================================================
  // OPERAÇÕES DE PASTA
  // ============================================================================
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const user = auth.currentUser;
    if (!user) return;

    const baseName = newFolderName.trim();
    let finalName = baseName;

    const sameLevelFolders = folders.filter(f => f.parentId === (currentFolderId || null));
    const exactMatches = sameLevelFolders.filter(f => f.name === baseName || f.name.startsWith(`${baseName} (`));
    
    if (exactMatches.length > 0) {
      let maxNum = 0;
      exactMatches.forEach(f => {
        if (f.name === baseName) {
          if (maxNum === 0) maxNum = 1;
        } else {
          const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const match = f.name.match(new RegExp(`^${escapeRegExp(baseName)} \\((\\d+)\\)$`));
          if (match) {
            const num = parseInt(match[1]);
            if (num >= maxNum) maxNum = num + 1;
          }
        }
      });
      if (maxNum > 0) {
        finalName = `${baseName} (${maxNum})`;
      }
    }

    const folderData: Omit<FolderType, "id"> = {
      name: finalName,
      color: newFolderColor,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      parentId: currentFolderId || null,
    };

    try {
      const ref = await addDoc(collection(db, "folders"), folderData);
      setFolders((prev) => [...prev, { id: ref.id, ...folderData }]);
      setNewFolderName("");
      setNewFolderColor("violet");
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
      (p) => p.folderId === folderId,
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
        (p) => p.folderId === folderId,
      );

      projectsToDelete.forEach((p) => {
        if (p.id) batch.delete(doc(db, "projects", p.id));
      });
      batch.delete(doc(db, "folders", folderId));

      await batch.commit();

      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setProjects((prev) =>
        prev.filter((p) => p.folderId !== folderId),
      );
      setConfirmDeleteFolderId(null);
      if (currentFolderId === folderId) setCurrentFolderId(null);
    } catch (err) {
      console.error("Erro ao excluir pasta e conteudos:", err);
    }
  };

  const handleMoveToFolder = async (
    project: Project,
    folderId: string | null,
  ) => {
    try {
      const updatedAt = new Date().toISOString();
      const order = Date.now();
      if (project.id) {
        await updateDoc(doc(db, "projects", project.id), { folderId, updatedAt, order });
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, folderId, updatedAt: new Date(updatedAt), order } : p)),
      );
      setMovingProject(null);
    } catch (err) {
      console.error("Erro ao mover projeto:", err);
    }
  };

  const handleMoveFolderToFolder = async (
    targetFolder: FolderType,
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

    // Pega apenas os projetos que estão sendo exibidos agora (na mesma pasta)
    const currentList = currentFolderId
      ? projects.filter((p) => p.folderId === currentFolderId)
      : projects.filter((p) => !p.folderId);

    // Mantém a ordem igual à da tela: ordem manual primeiro, depois data de atualização
    const sorted = [...currentList].sort((a, b) => {
      const orderA = (typeof a.order === 'number') ? a.order : 0;
      const orderB = (typeof b.order === 'number') ? b.order : 0;

      if (orderB !== orderA) {
        return orderB - orderA;
      }

      const timeA = (a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || 0)).getTime();
      const timeB = (b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || 0)).getTime();
      return timeB - timeA;
    });

    const dragIndex = sorted.findIndex(p => p.id === dragId);
    const dropIndex = sorted.findIndex(p => p.id === targetId);

    if (dragIndex === -1 || dropIndex === -1) return;

    // Remove do lugar antigo e insere no novo
    const [draggedItem] = sorted.splice(dragIndex, 1);
    sorted.splice(dropIndex, 0, draggedItem);

    // Atualiza a ordem baseada no tamanho da lista (maior fica no topo)
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

      // Atualização em Lote no Firebase
      if (auth.currentUser) {
        try {
          const batch = writeBatch(db);
          let count = 0;
          updates.forEach(u => {
            if (count < 500) { // Mantém dentro do limite de 500 operações do Firebase
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

  // ============================================================================
  // OPERAÇÕES DE PROJETO
  // ============================================================================
  const moveToTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    try {
      if (auth.currentUser) await deleteDoc(doc(db, "projects", id));
      const dateToIso = (d: Date | string | undefined | null) =>
        d instanceof Date ? d.toISOString() : String(d || "");
      const trashed: TrashedProject = {
        ...project,
        createdAt: dateToIso(project.createdAt),
        updatedAt: dateToIso(project.updatedAt),
        deletedAt: new Date().toISOString(),
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
        order: Date.now(),
      };
      if (auth.currentUser) {
        await setDoc(doc(db, "projects", id), {
          ...restored,
          order: restored.order,
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
      const dateToIso = (d: Date | string | undefined | null) =>
        d instanceof Date ? d.toISOString() : String(d || "");
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

  const filterProjects = <T extends Project | TrashedProject>(list: T[]): T[] => {
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

  // Projetos que tao nessa pasta
  const projectsInView = currentFolderId
    ? projects.filter((p) => p.folderId === currentFolderId)
    : projects.filter((p) => !p.folderId);

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

  const toolbar = (collapsed: boolean, closeMobileMenu?: () => void) => (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Desktop: busca */}
      <div className="hidden md:flex flex-col gap-1 w-full">
        <div className="w-full relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 group-focus-within:text-white/80 transition-colors" />
          <input
            type="text"
            placeholder={collapsed ? "" : "Buscar roteiros..."}
            className={`w-full pl-9 ${collapsed ? "pr-2" : "pr-4"} py-2 bg-white/10 border border-white/15 focus:border-white/40 rounded-xl text-xs font-semibold text-white outline-none transition-all placeholder:text-white/35 focus:bg-white/15`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            title="Buscar"
          />
        </div>
      </div>

      {/* Desktop: abas de visualização */}
      <div className="hidden md:flex flex-col gap-1.5 w-full">
        <button
          className={`relative flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all duration-200 cursor-pointer ${view === "projects" ? "bg-white text-violet-700 shadow-sm" : "bg-white/10 text-white/60 hover:text-white/90 hover:bg-white/20 border border-white/5"}`}
          onClick={() => {
            setView("projects");
            setCurrentFolderId(null);
          }}
          title="Meus Roteiros"
        >
          <div className="flex items-center gap-1.5">
            <Book className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Meus Roteiros</span>}
          </div>
          {!collapsed && projects.length > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1.5 rounded-full text-[9.9px] font-black ${view === "projects" ? "bg-violet-600 text-white" : "bg-white/20 text-white"}`}>
              {projects.length}
            </span>
          )}
        </button>
      </div>

      {/* Desktop: ações de criação */}
      <div className="hidden md:flex flex-col gap-2 w-full my-auto">
        <button
          onClick={() => {
            if (closeMobileMenu) closeMobileMenu();
            const userSlug = auth.currentUser?.email?.split('@')[0].replace(/\./g, '-') || 'usuario';
            navigate(`/canvas-generator/${userSlug}`);
          }}
          className={`flex w-full items-center justify-center px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold cursor-pointer transition-colors shadow-sm ${collapsed ? "justify-center" : ""}`}
          title="Criar Canvas"
        >
          <div className="flex items-center justify-center gap-2">
            <img src="/logo-innyx-icon.png" alt="INNYX" className="w-5 h-5 object-contain brightness-0 invert" />
            {!collapsed && <span className="text-[13.2px] font-bold tracking-wider uppercase whitespace-nowrap">Criar Canvas</span>}
          </div>
        </button>
      </div>

      {/* Desktop: limpar filtros */}
      {(search || typeFilter !== "all" || gradeFilter !== "all" || subjectFilter !== "all" || yearFilter !== "all" || quarterFilter !== "all") && (
        <button
          onClick={clearFilters}
          className={`hidden md:flex w-full items-center ${collapsed ? "justify-center px-0" : "justify-center"} gap-1.5 px-3 py-2.5 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 text-rose-200 hover:text-white rounded-xl text-[11px] font-black tracking-widest uppercase transition-all cursor-pointer`}
          title="Limpar Filtros"
        >
          <SearchX className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && "Limpar Filtros"}
        </button>
      )}

      <button
        onClick={() => {
          if (closeMobileMenu) closeMobileMenu();
          setShowRankingModal(true);
        }}
        className={`flex lg:hidden w-full items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-95 shadow-md shadow-amber-500/20 ${collapsed ? "px-0" : ""}`}
        title="Ranking"
      >
        <Trophy className="w-4 h-4 shrink-0 text-slate-950" />
        {!collapsed && <span>Ranking</span>}
      </button>
    </div>
  );

  const bottomToolbar = (collapsed: boolean, closeMobileMenu?: () => void) => (
    <button
      className={`relative flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer ${view === "trash" ? "bg-rose-500 text-white shadow-md border border-rose-400 scale-[1.02]" : "bg-white/10 text-white/80 hover:bg-rose-500 hover:text-white hover:shadow-lg hover:scale-[1.02] border border-white/5 hover:border-rose-400"}`}
      onClick={() => {
        if (closeMobileMenu) closeMobileMenu();
        setView("trash");
      }}
      title="Lixeira"
    >
      <div className="flex items-center gap-1.5">
        <Trash2 className="w-4 h-4 shrink-0" />
        {!collapsed && <span>Lixeira</span>}
      </div>
      {!collapsed && trash.length > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1.5 rounded-full text-[9.9px] font-black transition-colors ${view === "trash" ? "bg-white/20 text-white" : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white"}`}>
          {trash.length}
        </span>
      )}
    </button>
  );

  return (
    <Layout
      search={search}
      onSearchChange={setSearch}
      view={view}
      onSelectView={setView}
      projectCount={projects.length}
      trashCount={trash.length}
      hasActiveFilters={!!(search || typeFilter !== "all" || gradeFilter !== "all" || subjectFilter !== "all" || yearFilter !== "all" || quarterFilter !== "all")}
      onClearFilters={clearFilters}
      toolbar={toolbar}
      bottomToolbar={bottomToolbar}
      onNewFolderClick={() => setShowNewFolderModal(true)}
      sidebar={
        <RankingPanel
          top3={top3}
          currentUserPos={currentUserPos}
          loading={rankingLoading}
          currentUserId={auth.currentUser?.uid || null}
          isSidebar={true}
        />
      }
    >
      <div className="w-full h-full flex flex-col">

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Carregando...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Abas Mobile (Planejamentos / Lixeira / Ranking) */}
            <div className="flex md:hidden w-full px-4 pt-4 pb-2 bg-white gap-2 border-b border-slate-100 shrink-0">
              <div className="flex w-full bg-slate-100/70 p-1 rounded-2xl items-center gap-1">
                <button
                  className={`flex-1 relative flex justify-center items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer ${view === "projects" ? "bg-violet-600 text-white shadow-md shadow-violet-600/20" : "text-slate-400 hover:text-slate-600 hover:bg-white/50"}`}
                  onClick={() => setView("projects")}
                >
                  <span>Projetos</span>
                  {projects.length > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[7.7px] font-black ${view === "projects" ? "bg-white/20 text-white" : "bg-violet-600 text-white"}`}>
                      {projects.length}
                    </span>
                  )}
                </button>
                <button
                  className={`flex-1 relative flex justify-center items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer ${view === "trash" ? "bg-rose-600 text-white shadow-md shadow-rose-600/20" : "text-slate-400 hover:text-slate-600 hover:bg-white/50"}`}
                  onClick={() => setView("trash")}
                >
                  <span>Lixeira</span>
                  {trash.length > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[7.7px] font-black ${view === "trash" ? "bg-white/20 text-white" : "bg-rose-600 text-white"}`}>
                      {trash.length}
                    </span>
                  )}
                </button>
                <button
                  className="flex-1 relative flex justify-center items-center gap-1 px-2 py-2 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer text-slate-500 hover:text-amber-600 hover:bg-amber-50/50"
                  onClick={() => setShowRankingModal(true)}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Ranking</span>
                </button>
              </div>
            </div>

            {/* ── BARRA DE FILTROS FIXA ── */}
            <div className="sticky top-0 z-[60] bg-white/95 backdrop-blur-2xl border-b border-slate-200/70 shadow-sm">

              {/* Barra compacta Mobile */}
              <div className="flex md:hidden items-center gap-2 px-4 py-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar projetos..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all placeholder:text-slate-400 font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setMobileFiltersOpen(true)}
                  className={`relative shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all ${activeFiltersCount > 0
                      ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/25"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300"
                    }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {activeFiltersCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-white text-violet-600 rounded-full text-[11px] font-black">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-2xl">
                  <button onClick={() => handleDisplayMode("grid")} className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${displayMode === "grid" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400"}`}>
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDisplayMode("list")} className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${displayMode === "list" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400"}`}>
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Barra de filtros Desktop */}
              <div className="hidden md:flex flex-wrap items-end justify-between gap-3 lg:gap-4 px-6 lg:px-10 py-3.5">
                <div className="flex flex-wrap items-end gap-3 lg:gap-4 flex-1 min-w-0">
                  {/* Modo de Exibição */}
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 px-1">
                      Visualização
                    </span>
                    <div className="flex items-center gap-1 shrink-0 p-1 bg-slate-50 border border-slate-200/80 rounded-xl shadow-sm">
                      <button onClick={() => handleDisplayMode("grid")} title="Grade" className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${displayMode === "grid" ? "bg-white text-violet-600 shadow-sm border border-slate-200/60" : "text-slate-400 hover:text-violet-500 hover:bg-white/50"}`}>
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDisplayMode("compact")} title="Compacto" className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${displayMode === "compact" ? "bg-white text-violet-600 shadow-sm border border-slate-200/60" : "text-slate-400 hover:text-violet-500 hover:bg-white/50"}`}>
                        <LayoutGrid className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDisplayMode("list")} title="Lista" className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${displayMode === "list" ? "bg-white text-violet-600 shadow-sm border border-slate-200/60" : "text-slate-400 hover:text-violet-500 hover:bg-white/50"}`}>
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="hidden xl:block w-px h-8 bg-slate-200/80 self-end mb-1 shrink-0" />

                  {/* Dropdowns de Filtro */}
                  {[
                    { label: "Tipo", value: typeFilter, set: setTypeFilter, options: gameTypes, placeholder: "Tipo de Jogo" },
                    { label: "Nível", value: gradeFilter, set: setGradeFilter, options: gradeLevels, placeholder: "Nível" },
                    { label: "Matéria", value: subjectFilter, set: setSubjectFilter, options: subjects, placeholder: "Matéria" },
                    { label: "Ano/Série", value: yearFilter, set: setYearFilter, options: years, placeholder: "Ano/Série" },
                    { label: "Bimestre", value: quarterFilter, set: setQuarterFilter, options: quarters, placeholder: "Bimestre" },
                  ].map(({ label, value, set, options, placeholder }) => (
                    <CustomSelect key={label} label={label} value={value} onChange={set} options={options} placeholder={placeholder} />
                  ))}

                  {activeFiltersCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="self-end mb-0.5 flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-600 border border-rose-200/70 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <SearchX className="w-3.5 h-3.5" />
                      Limpar
                    </button>
                  )}
                </div>

                {view === "projects" && (
                  <button
                    onClick={() => setShowNewFolderModal(true)}
                    className="self-end mb-0.5 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-[12.1px] font-black uppercase tracking-wider hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-md shadow-violet-500/20 active:scale-95 cursor-pointer shrink-0"
                    title="Nova Pasta"
                  >
                    <FolderPlus className="w-4 h-4 shrink-0" />
                    <span>Nova Pasta</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── MENU INFERIOR DE FILTROS MOBILE ── */}
            <AnimatePresence>
              {mobileFiltersOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150] md:hidden"
                    onClick={() => setMobileFiltersOpen(false)}
                  />
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 220 }}
                    className="fixed bottom-0 left-0 right-0 z-[160] bg-white rounded-t-[2.25rem] shadow-2xl md:hidden max-h-[85vh] flex flex-col overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="w-4 h-4 text-violet-600" />
                          <h3 className="text-base font-black text-slate-800 tracking-tight">Filtros de Busca</h3>
                        </div>
                        {activeFiltersCount > 0 ? (
                          <p className="text-[12.1px] text-violet-600 font-bold mt-0.5">{activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} aplicado{activeFiltersCount > 1 ? 's' : ''}</p>
                        ) : (
                          <p className="text-[12.1px] text-slate-400 font-medium mt-0.5">Refine sua listagem de roteiros</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {activeFiltersCount > 0 && (
                          <button onClick={clearFilters} className="px-3 py-1.5 text-xs font-black text-rose-600 bg-rose-50 border border-rose-200/60 rounded-xl active:scale-95 transition-all">
                            Limpar
                          </button>
                        )}
                        <button onClick={() => setMobileFiltersOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Filters Body */}
                    <div className="px-6 py-5 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                      {[
                        { label: "Tipo de Jogo", value: typeFilter, set: setTypeFilter, options: Array.from(new Set(gameTypes)) },
                        { label: "Nível de Ensino", value: gradeFilter, set: setGradeFilter, options: Array.from(new Set(gradeLevels)) },
                        { label: "Matéria / Componente", value: subjectFilter, set: setSubjectFilter, options: Array.from(new Set(subjects)) },
                        { label: "Ano / Série", value: yearFilter, set: setYearFilter, options: Array.from(new Set(years)) },
                        { label: "Bimestre", value: quarterFilter, set: setQuarterFilter, options: Array.from(new Set(quarters)) },
                      ].map(({ label, value, set, options }) => (
                        <div key={label} className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                            {value !== "all" && (
                              <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                                {value}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => set("all")}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                value === "all"
                                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 scale-[1.02]"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60"
                              }`}
                            >
                              Todos
                            </button>
                            {options.map((o) => (
                              <button
                                key={String(o)}
                                onClick={() => set(value === String(o) ? "all" : String(o))}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  value === String(o)
                                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 scale-[1.02]"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60"
                                }`}
                              >
                                {String(o)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer with action button and safe-area */}
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                      <button
                        onClick={() => setMobileFiltersOpen(false)}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-500/25 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        Ver Resultados ({view === "projects" ? filteredProjects.length : filteredTrash.length})
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="px-4 sm:px-6 md:px-10 pt-6 md:pt-8 pb-20">
              {/* ── PASTAS E CONTEÚDO ── */}
              {view === "projects" && (
                <>
                  {/* Botão Mobile para Criar Canvas */}
                  <div className="md:hidden flex justify-end mb-4">
                    <button
                      onClick={() => {
                        const userSlug = auth.currentUser?.email?.split('@')[0].replace(/\./g, '-') || 'usuario';
                        navigate(`/canvas-generator/${userSlug}`);
                      }}
                      className="flex flex-1 items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-extrabold shadow-lg shadow-violet-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <img src="/logo-innyx-icon.png" alt="INNYX" className="w-5 h-5 object-contain brightness-0 invert" />
                      <span className="text-sm tracking-wide uppercase">
                        Criar Canvas
                      </span>
                    </button>
                  </div>

                  {/* Navegação Estrutural (Breadcrumb) */}
                  {currentFolderId && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 mb-6 px-2"
                    >
                      <button
                        onClick={() => setCurrentFolderId(currentFolder?.parentId || null)}
                        className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-violet-500 uppercase tracking-widest transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {currentFolder?.parentId ? "Voltar" : "Início"}
                      </button>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                      <div
                        className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${getColorConfig(currentFolder?.color || "violet").text}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        {currentFolder?.name}
                      </div>
                      <span className="text-[9.9px] text-slate-400 font-bold ml-1">
                        ({filteredProjects.length} projeto
                        {filteredProjects.length !== 1 ? "s" : ""})
                      </span>
                    </motion.div>
                  )}

                  {/* Grade de Pastas */}
                  {folders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId).length > 0 && (
                    <div className="mb-8">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5" />
                        Pastas ({folders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId).length})
                      </p>
                      <div className={displayMode === "list" ? "flex flex-col gap-2" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4"}>
                        <AnimatePresence>
                          {folders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId).map((folder, idx) => {
                            const count = projects.filter(
                              (p) => p.folderId === folder.id,
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

              {/* Projetos / Estados Vazios */}
              {filteredProjects.length === 0 && view === "projects" ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-[400px] flex flex-col items-center justify-center text-center glass-light rounded-[3rem] border border-white/50 shadow-2xl shadow-violet-500/5 max-w-4xl mx-auto px-10"
                >
                  <div className="relative w-24 h-24 glass-light rounded-[2rem] flex items-center justify-center shadow-2xl border border-white overflow-hidden mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent" />
                    {currentFolderId ? (
                      <FolderOpen className="relative z-10 w-10 h-10 text-violet-400" />
                    ) : (
                      <FileText className="relative z-10 w-10 h-10 text-violet-500" />
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
                      onClick={() => {
                        const userSlug = auth.currentUser?.email?.split('@')[0].replace(/\./g, '-') || 'usuario';
                        navigate(`/canvas-generator/${userSlug}`);
                      }}
                      className="px-10 py-4 bg-violet-500 text-white rounded-3xl font-black text-xs uppercase tracking-[0.25em] shadow-2xl shadow-violet-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-3 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Criar Primeiro Projeto
                    </button>
                  )}
                </motion.div>
              ) : filteredTrash.length === 0 && view === "trash" ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-center opacity-60">
                  <Trash2 className="w-16 h-16 text-slate-300 mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                    A lixeira esta vazia
                  </p>
                </div>
              ) : (
                <motion.div
                  key={displayMode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={displayMode === "list" ? "flex flex-col gap-2" : displayMode === "compact" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-8"}
                >
                  {(view === "projects"
                    ? filteredProjects
                    : filteredTrash
                  ).map((p) => (
                    <div key={p.id} className="w-full">
                      <ProjectCard
                        project={p as Project}
                        displayMode={displayMode}
                        folders={folders}
                        onDelete={(id, e) => moveToTrash(id, e)}
                        onRestore={(id, e) => restoreFromTrash(id, e)}
                        onDeletePermanent={(id) =>
                          setConfirmDeleteId(id)
                        }
                        onClick={(id) => {
                          const userSlug = auth.currentUser?.email?.split('@')[0].replace(/\./g, '-') || 'usuario';
                          navigate(`/canvas-generator/${userSlug}?id=${id}`);
                        }}
                        isTrash={view === "trash"}
                        onMoveToFolder={(project) =>
                          setMovingProject(project)
                        }
                        onDropOnProject={handleReorderProject}
                      />
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ MODAL: Nova Pasta / Editar Pasta â”€â”€ */}
      <AnimatePresence>
        {(showNewFolderModal || editingFolder) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-white text-center"
            >
              <div className="w-16 h-16 bg-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/30">
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
                    if (e.key === "Enter") {
                      if (editingFolder) {
                        handleRenameFolder();
                      } else {
                        handleCreateFolder();
                      }
                    }
                  }}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-300 text-slate-800 font-bold text-sm text-center"
                />

                {/* Seletor de Cores */}
                <div>
                  <p className="text-[9.9px] font-black text-slate-400 uppercase tracking-widest mb-3">
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
                          type="button"
                          onClick={() =>
                            editingFolder
                              ? setEditingFolder({
                                ...editingFolder,
                                color: c.value,
                              })
                              : setNewFolderColor(c.value)
                          }
                          className={`w-7 h-7 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${isSelected
                            ? "ring-4 ring-violet-500/20 scale-110 shadow-md"
                            : "hover:scale-105 opacity-80"
                            }`}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white" />
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
                    }}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={
                      editingFolder ? handleRenameFolder : handleCreateFolder
                    }
                    className="flex-1 py-4 bg-violet-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 active:scale-95 cursor-pointer"
                  >
                    {editingFolder ? "Salvar" : "Criar Pasta"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Mover Projeto / Pasta para Outra Pasta ── */}
      <AnimatePresence>
        {(movingProject || movingFolder) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-white flex flex-col gap-6"
            >
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Mover para Pasta
                </h2>
                <p className="text-slate-400 text-xs font-bold mt-1.5">
                  Selecione onde deseja colocar {movingProject ? "este projeto" : "esta pasta"}
                </p>
              </div>

              <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 -mr-2">
                <button
                  onClick={() => {
                    if (movingProject) handleMoveToFolder(movingProject, null);
                    if (movingFolder) handleMoveFolderToFolder(movingFolder, null);
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer text-left border ${((movingProject && !movingProject.folderId) || (movingFolder && !movingFolder.parentId)) ? "border-violet-300 bg-violet-50/50 shadow-sm" : "border-slate-100 bg-white hover:border-violet-200 hover:bg-violet-50/30 hover:shadow-sm"}`}
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    <Folder className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-700 truncate">
                      Sem pasta (Início)
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                      {projects.filter((p) => !p.folderId).length} projetos
                    </p>
                  </div>
                  {((movingProject && !movingProject.folderId) || (movingFolder && !movingFolder.parentId)) && (
                    <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>

                {folders.filter(f => !movingFolder || f.id !== movingFolder.id).map((folder) => {
                  const cc = getColorConfig(folder.color);
                  const count = projects.filter(
                    (p) => p.folderId === folder.id,
                  ).length + folders.filter(f => f.parentId === folder.id).length;
                  const isCurrentFolder =
                    movingProject ? movingProject.folderId === folder.id : movingFolder?.parentId === folder.id;
                  return (
                    <button
                      key={folder.id}
                      onClick={() => {
                        if (movingProject) handleMoveToFolder(movingProject, folder.id);
                        if (movingFolder) handleMoveFolderToFolder(movingFolder, folder.id);
                      }}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer text-left border ${isCurrentFolder ? `${cc.border} ${cc.light} shadow-sm` : `border-slate-100 bg-white hover:${cc.border} hover:${cc.light} hover:shadow-sm`}`}
                    >
                      <div
                        className={`w-10 h-10 ${cc.bg} rounded-xl flex items-center justify-center shrink-0 shadow-sm`}
                      >
                        <FolderOpen className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black truncate ${isCurrentFolder ? cc.text : "text-slate-700"}`}>
                          {folder.name}
                        </p>
                        <p className={`text-[11px] font-bold mt-0.5 ${isCurrentFolder ? cc.text : "text-slate-400"}`}>
                          {count} item{count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {isCurrentFolder && (
                        <div className={`w-6 h-6 rounded-full ${cc.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => { setMovingProject(null); setMovingFolder(null); }}
                  className="w-full py-4 bg-slate-50 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Confirmar Exclusao de Pasta ── */}
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
                      (p) => p.folderId === confirmDeleteFolderId,
                    ).length
                  }{" "}
                  projetos
                </strong>{" "}
                que estão dentro dela. Eles serão excluídos permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteFolderId(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteFolder(confirmDeleteFolderId)}
                  className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
                >
                  Excluir Tudo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Confirmar Exclusao Permanente ── */}
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
                  className={`w-full py-4 rounded-2xl font-black text-[12.1px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg cursor-pointer ${confirmDeleteId === "ALL_PROJECTS" ? "bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600" : "bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-600"}`}
                >
                  Confirmar Ação
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[12.1px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clique fora para fechar o menu da pasta */}
      {folderMenuId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setFolderMenuId(null)}
        />
      )}

      {/* Modal de Ranking */}
      <AnimatePresence>
        {showRankingModal && (
          <RankingModal
            onClose={() => setShowRankingModal(false)}
            top3={top3}
            currentUserPos={currentUserPos}
            loading={rankingLoading}
            currentUserId={auth.currentUser?.uid || null}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
