import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { ProjectCard } from '../components/ui/Card';
import { Plus, Search, Trash2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const STORAGE_KEY = 'gamecanvas_projects';
const TRASH_KEY = 'gamecanvas_trash';

// Projeto na lixeira tem data de exclusão
interface TrashedProject extends Omit<Project, 'createdAt'> {
    createdAt: string;
    deletedAt: string;
}

/** Carrega do localStorage e converte datas */
function loadProjects(): Project[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored).map((p: Project & { createdAt: string }) => ({
            ...p,
            createdAt: new Date(p.createdAt),
        }));
    } catch { return []; }
}

function loadTrash(): TrashedProject[] {
    try {
        const stored = localStorage.getItem(TRASH_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch { return []; }
}

function saveProjects(projects: Project[]) {
    const serializable = projects.map(p => ({
        ...p,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

function saveTrash(trash: TrashedProject[]) {
    localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

export default function Dashboard() {
    const navigate = useNavigate();

    const [projects, setProjects] = useState<Project[]>([]);
    const [trash, setTrash] = useState<TrashedProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'projects' | 'trash'>('projects');

    // Confirmação de exclusão permanente
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const user = auth.currentUser;

                // Load projects
                let projectsData: Project[] = [];
                if (user) {
                    const q = query(collection(db, 'projects'), where('userId', '==', user.uid));
                    const querySnapshot = await getDocs(q);
                    projectsData = querySnapshot.docs.map(doc => {
                        const data = doc.data();

                        // Resilient date parsing
                        let createdAt: Date;
                        if (data.createdAt?.seconds) {
                            createdAt = new Date(data.createdAt.seconds * 1000);
                        } else if (data.createdAt instanceof Date) {
                            createdAt = data.createdAt;
                        } else {
                            createdAt = new Date(data.createdAt);
                        }

                        return {
                            ...data,
                            id: doc.id, // THE FIX: doc.id is the real document ID
                            createdAt: !isNaN(createdAt.getTime()) ? createdAt : new Date()
                        } as Project;
                    });
                } else {
                    projectsData = loadProjects();
                }
                setProjects(projectsData);

                // Load trash (keeping trash local for now as it's less critical)
                setTrash(loadTrash());
            } catch (error) {
                console.error('Erro ao buscar projetos:', error);
                setProjects(loadProjects());
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    /** Move projeto para a lixeira */
    const moveToTrash = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const project = projects.find(p => p.id === id);
        if (!project) return;

        try {
            // Delete from Firestore if it exists there
            if (auth.currentUser) {
                await deleteDoc(doc(db, 'projects', id));
            }

            const trashed: TrashedProject = {
                ...project,
                createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : String(project.createdAt),
                deletedAt: new Date().toLocaleDateString('pt-BR'),
            };

            const updatedProjects = projects.filter(p => p.id !== id);
            const updatedTrash = [...trash, trashed];

            setProjects(updatedProjects);
            setTrash(updatedTrash);
            saveProjects(updatedProjects);
            saveTrash(updatedTrash);
        } catch (error) {
            console.error('Erro ao mover para lixeira:', error);
        }
    };

    /** Restaura da lixeira */
    const restoreFromTrash = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const trashed = trash.find(p => p.id === id);
        if (!trashed) return;

        try {
            const restored: Project = {
                ...trashed,
                createdAt: new Date(trashed.createdAt),
            };

            // Restore to Firestore if logged in
            if (auth.currentUser) {
                await setDoc(doc(db, 'projects', id), {
                    ...restored,
                    createdAt: restored.createdAt.toISOString()
                });
            }

            const updatedTrash = trash.filter(p => p.id !== id);
            const updatedProjects = [...projects, restored];

            setTrash(updatedTrash);
            setProjects(updatedProjects);
            saveTrash(updatedTrash);
            saveProjects(updatedProjects);
        } catch (error) {
            console.error('Erro ao restaurar:', error);
        }
    };

    /** Exclui permanentemente */
    const deletePermanently = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedTrash = trash.filter(p => p.id !== id);
        setTrash(updatedTrash);
        saveTrash(updatedTrash);
        setConfirmDeleteId(null);
    };


    const confirmEmptyTrash = () => {
        setTrash([]);
        saveTrash([]);
        setConfirmDeleteId(null);
    };

    /** Move todos os projetos atuais para a lixeira */
    const moveAllToTrash = async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;

            // If logged in, delete from Firestore using a batch
            if (user && projects.length > 0) {
                const batch = writeBatch(db);
                projects.forEach(p => {
                    if (p.id) {
                        batch.delete(doc(db, 'projects', p.id));
                    }
                });
                await batch.commit();
            }

            const now = new Date().toLocaleDateString('pt-BR');
            const newTrashed: TrashedProject[] = projects.map(p => ({
                ...p,
                createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
                deletedAt: now,
            }));

            const updatedTrash = [...trash, ...newTrashed];

            setProjects([]);
            setTrash(updatedTrash);
            saveProjects([]);
            saveTrash(updatedTrash);
            setConfirmDeleteId(null);
        } catch (error) {
            console.error('Erro ao mover tudo para lixeira:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.formData?.subject?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredTrash = trash.filter(p =>
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.formData?.subject?.toLowerCase().includes(search.toLowerCase())
    );

    const toolbar = (
        <div className="flex items-center gap-3 w-full">
            {/* View Toggle */}
            <div className="flex items-center gap-6 pr-6 border-r border-slate-200/60">
                <button
                    className={`relative flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-300 cursor-pointer ${view === 'projects'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                    onClick={() => setView('projects')}
                >
                    Meus Planejamentos
                    {projects.length > 0 && (
                        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[9px] font-black ${view === 'projects' ? 'bg-white/20 text-white' : 'bg-indigo-600 text-white'}`}>
                            {projects.length}
                        </span>
                    )}
                </button>
                <button
                    className={`text-xs font-black tracking-widest uppercase transition-all duration-300 cursor-pointer ${view === 'trash'
                        ? 'text-indigo-600'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                    onClick={() => setView('trash')}
                >
                    Excluídos
                </button>
            </div>

            {/* Search Icon Button */}
            <div className="flex-1 flex items-center gap-2">
                <button
                    onClick={() => { }} // Could trigger a modal or expand search
                    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all cursor-pointer"
                >
                    <Search className="w-4 h-4" />
                </button>

                {/* Optional: Small search input that appears if expanded, but image shows icon only/compact */}
                <input
                    type="text"
                    placeholder="Pesquisar..."
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 w-24 focus:w-48 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                {projects.length > 0 && (
                    <button
                        onClick={() => setConfirmDeleteId(view === 'projects' ? 'ALL_PROJECTS' : 'ALL')}
                        className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Limpar Tudo
                    </button>
                )}

                <button
                    onClick={() => navigate('/generator')}
                    className="flex items-center gap-3 px-8 py-2.5 bg-[#0f172a] text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10 cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    Novo Projeto
                </button>
            </div>
        </div>
    );

    return (
        <Layout toolbar={toolbar}>
            <div className="max-w-[1400px] mx-auto h-full flex flex-col">

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20">
                        {filteredProjects.length === 0 && view === 'projects' ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="h-[500px] flex flex-col items-center justify-center text-center glass-light rounded-[3rem] border border-white/50 shadow-2xl shadow-indigo-500/5 max-w-4xl mx-auto px-10"
                            >
                                <div className="relative w-32 h-32 glass-light rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-white overflow-hidden mb-8">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent" />
                                    <FileText className="relative z-10 w-14 h-14 text-indigo-500" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Nenhum planejamento encontrado</h3>
                                <p className="text-slate-500 max-w-sm mb-10 font-medium leading-relaxed">
                                    Sua biblioteca está vazia. Comece criando seu primeiro planejamento educacional gamificado com nossa IA.
                                </p>
                                <button
                                    onClick={() => navigate('/generator')}
                                    className="px-10 py-5 bg-indigo-500 text-white rounded-3xl font-black text-xs uppercase tracking-[0.25em] shadow-2xl shadow-indigo-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-3"
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar Primeiro Projeto
                                </button>
                            </motion.div>
                        ) : filteredTrash.length === 0 && view === 'trash' ? (
                            <div className="h-[400px] flex flex-col items-center justify-center text-center opacity-40">
                                <Trash2 className="w-16 h-16 text-slate-300 mb-4" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">A lixeira está vazia</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                <AnimatePresence mode="popLayout">
                                    {(view === 'projects' ? filteredProjects : filteredTrash).map((p, idx) => (
                                        <motion.div
                                            key={p.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, x: -20 }}
                                            transition={{ duration: 0.4, delay: idx * 0.05, ease: [0.23, 1, 0.32, 1] }}
                                        >
                                            <ProjectCard
                                                project={p as any}
                                                onDelete={(id, e) => moveToTrash(id, e)}
                                                onRestore={(id, e) => restoreFromTrash(id, e)}
                                                onDeletePermanent={(id, _e) => setConfirmDeleteId(id)}
                                                onClick={(id) => navigate(`/generator?id=${id}`)}
                                                isTrash={view === 'trash'}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Confirmação de Exclusão Permanente */}
            <AnimatePresence>
                {confirmDeleteId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white p-10 rounded-[2.5rem] w-full max-w-sm shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] text-center border border-white"
                        >
                            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl ${confirmDeleteId === 'ALL_PROJECTS' ? 'bg-amber-50 shadow-amber-500/10' : 'bg-rose-50 shadow-rose-500/10'
                                }`}>
                                <Trash2 className={`w-8 h-8 ${confirmDeleteId === 'ALL_PROJECTS' ? 'text-amber-500' : 'text-rose-500'}`} />
                            </div>

                            <h2 className="text-xl font-black text-slate-900 mb-3 tracking-tight uppercase px-4">
                                {confirmDeleteId === 'ALL' ? 'Esvaziar lixeira?'
                                    : confirmDeleteId === 'ALL_PROJECTS' ? 'Limpar tudo?'
                                        : 'Excluir para sempre?'}
                            </h2>

                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed mb-10 px-4 opacity-80">
                                {confirmDeleteId === 'ALL'
                                    ? 'Isso apagará todos os arquivos da lixeira.'
                                    : confirmDeleteId === 'ALL_PROJECTS'
                                        ? 'Seus roteiros serão movidos para a lixeira.'
                                        : 'Este projeto será removido permanentemente.'}
                            </p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={(e) => {
                                        if (confirmDeleteId === 'ALL') confirmEmptyTrash();
                                        else if (confirmDeleteId === 'ALL_PROJECTS') moveAllToTrash();
                                        else deletePermanently(confirmDeleteId!, e);
                                    }}
                                    className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg cursor-pointer ${confirmDeleteId === 'ALL_PROJECTS'
                                            ? 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600'
                                            : 'bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-600'
                                        }`}
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
        </Layout>
    );
}
