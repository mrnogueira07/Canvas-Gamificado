
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  BookOpen, 
  ChevronDown,
  Undo2,
  Trash,
  Loader2,
  AlertTriangle,
  FileText,
  X,
  Sparkles,
  LayoutGrid,
  Clock,
  Calendar,
  Filter,
  MoreVertical,
  GraduationCap,
  Calculator,
  Beaker,
  Languages,
  Palette,
  Globe,
  Music,
  Dna
} from 'lucide-react';
import { EducationLevel, Bimester, ScriptItem } from '../types';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

interface DashboardProps {
  onCreateClick: () => void;
  onViewScript: (script: ScriptItem) => void;
}

// Helper para formatar data relativa
const formatRelativeTime = (timestamp: any) => {
  if (!timestamp) return '...';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Agora';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min atrás`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h atrás`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} d atrás`;
  
  return date.toLocaleDateString('pt-BR');
};

// Helper para cores e ícones baseados na matéria
const getSubjectTheme = (subject: string) => {
  const s = subject.toLowerCase();
  if (s.includes('matemática') || s.includes('física')) return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800', icon: <Calculator size={18} /> };
  if (s.includes('história') || s.includes('filosofia')) return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800', icon: <BookOpen size={18} /> };
  if (s.includes('geografia')) return { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800', icon: <Globe size={18} /> };
  if (s.includes('ciências') || s.includes('biologia') || s.includes('química')) return { color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-100 dark:border-teal-800', icon: <Dna size={18} /> };
  if (s.includes('artes')) return { color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-100 dark:border-pink-800', icon: <Palette size={18} /> };
  if (s.includes('portuguesa') || s.includes('inglesa')) return { color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800', icon: <Languages size={18} /> };
  
  return { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', icon: <Sparkles size={18} /> };
};

export const Dashboard: React.FC<DashboardProps> = ({ onCreateClick, onViewScript }) => {
  const [activeTab, setActiveTab] = useState<'scripts' | 'trash'>('scripts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel | ''>('');
  const [selectedBimester, setSelectedBimester] = useState<Bimester | ''>('');
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Firestore Listener
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "canvas"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedScripts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScriptItem[];
      
      fetchedScripts.sort((a, b) => {
        const dateA = a.lastModified?.toDate ? a.lastModified.toDate() : new Date(a.lastModified || 0);
        const dateB = b.lastModified?.toDate ? b.lastModified.toDate() : new Date(b.lastModified || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setScripts(fetchedScripts);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching scripts:", err);
      if (err.code === 'permission-denied') {
        setError("Acesso negado. Verifique suas permissões.");
      } else {
        setError("Não foi possível carregar os roteiros.");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMoveToTrash = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "canvas", id), {
        status: 'deleted',
        lastModified: new Date()
      });
    } catch (error) {
      console.error("Error moving to trash:", error);
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "canvas", id), {
        status: 'active',
        lastModified: new Date()
      });
    } catch (error) {
      console.error("Error restoring script:", error);
    }
  };

  const handleDeleteForever = async (id: string) => {
    try {
      await deleteDoc(doc(db, "canvas", id));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error deleting script:", error);
      setError("Erro ao excluir o documento permanentemente.");
    }
  };

  const filteredScripts = useMemo(() => {
    return scripts.filter(script => {
      const isDeleted = script.status === 'deleted';
      if (activeTab === 'trash' && !isDeleted) return false;
      if (activeTab === 'scripts' && isDeleted) return false;

      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = script.title.toLowerCase().includes(searchLower) ||
                          script.subject.toLowerCase().includes(searchLower);

      const matchesLevel = selectedLevel ? script.level === selectedLevel : true;
      const matchesBimester = selectedBimester ? script.bimester === selectedBimester : true;

      return matchesSearch && matchesLevel && matchesBimester;
    });
  }, [activeTab, searchQuery, selectedLevel, selectedBimester, scripts]);

  const stats = useMemo(() => {
     const total = scripts.filter(s => s.status !== 'deleted').length;
     const trash = scripts.filter(s => s.status === 'deleted').length;
     // Scripts modificados nos últimos 7 dias
     const recent = scripts.filter(s => {
         if (s.status === 'deleted') return false;
         const date = s.lastModified?.toDate ? s.lastModified.toDate() : new Date(s.lastModified || 0);
         const diffTime = Math.abs(new Date().getTime() - date.getTime());
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
         return diffDays <= 7;
     }).length;
     return { total, trash, recent };
  }, [scripts]);

  const userName = auth.currentUser?.displayName?.split(' ')[0] || 'Professor(a)';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Hero / Welcome Section - Compact Version */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm p-6 transition-colors duration-300">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-2xl opacity-60 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
             {/* Text Content */}
             <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Olá, <span className="text-indigo-600 dark:text-indigo-400">{userName}</span>! <span className="text-xl">👋</span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Gerencie seus roteiros gamificados e crie novas experiências.
                </p>
             </div>
             
             {/* Stats - Compact */}
             <div className="flex items-center gap-3 md:gap-6 self-start md:self-auto">
                 <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                       <LayoutGrid size={16} />
                    </div>
                    <div>
                       <span className="block text-lg font-bold text-gray-900 dark:text-white leading-none">{stats.total}</span>
                       <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Projetos</span>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                       <Clock size={16} />
                    </div>
                    <div>
                       <span className="block text-lg font-bold text-gray-900 dark:text-white leading-none">{stats.recent}</span>
                       <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recentes</span>
                    </div>
                 </div>
             </div>
          </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-2 pl-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm sticky top-4 z-20 backdrop-blur-xl bg-opacity-90 dark:bg-opacity-90 transition-all">
        
        {/* Search Input */}
        <div className="relative flex-grow w-full md:w-auto">
          <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full bg-transparent border-none pl-8 pr-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:ring-0"
            placeholder="Buscar por título ou matéria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
          
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block"></div>

          {/* Filter Levels */}
          <div className="relative group">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as EducationLevel)}
              className="appearance-none bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 focus:outline-none transition-all cursor-pointer min-w-[130px]"
            >
              <option value="">Nível: Todos</option>
              <option value="Ensino Fundamental 1">Fundamental 1</option>
              <option value="Ensino Fundamental 2">Fundamental 2</option>
              <option value="Ensino Médio">Ensino Médio</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-600" />
          </div>

          {/* Filter Bimester */}
          <div className="relative group">
             <select
              value={selectedBimester}
              onChange={(e) => setSelectedBimester(e.target.value as Bimester)}
              className="appearance-none bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 focus:outline-none transition-all cursor-pointer min-w-[120px]"
            >
              <option value="">Bimestre: Todos</option>
              <option value="1º Bimestre">1º Bimestre</option>
              <option value="2º Bimestre">2º Bimestre</option>
              <option value="3º Bimestre">3º Bimestre</option>
              <option value="4º Bimestre">4º Bimestre</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-600" />
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

          {/* Toggle Trash/Active */}
          <button 
            onClick={() => setActiveTab(activeTab === 'scripts' ? 'trash' : 'scripts')}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
              activeTab === 'trash' 
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:border-red-900/50' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={activeTab === 'scripts' ? 'Ver Lixeira' : 'Voltar aos Projetos'}
          >
            {activeTab === 'scripts' ? <Trash2 size={18} /> : <LayoutGrid size={18} />}
          </button>

          {/* Create Button */}
          <button 
            onClick={onCreateClick}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap ml-1"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span className="hidden sm:inline">Novo Canvas</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 animate-fade-in">
           <AlertTriangle size={20} />
           <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {[1, 2, 3, 4].map((i) => (
             <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 h-[280px] animate-pulse">
               <div className="flex justify-between mb-6">
                 <div className="h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
                 <div className="h-6 w-16 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
               </div>
               <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-700 rounded-md mb-3"></div>
               <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-600 rounded-md mb-2"></div>
               <div className="h-6 w-1/2 bg-gray-200 dark:bg-gray-600 rounded-md"></div>
               <div className="mt-auto pt-8 flex items-center justify-between">
                 <div className="h-4 w-24 bg-gray-100 dark:bg-gray-700 rounded-md"></div>
               </div>
             </div>
           ))}
         </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredScripts.map((script) => {
            const theme = getSubjectTheme(script.subject);
            
            return (
              <div 
                key={script.id} 
                onClick={() => activeTab === 'scripts' && onViewScript(script)}
                className={`
                  group relative bg-white dark:bg-gray-800 rounded-[24px] p-6 
                  border border-gray-100 dark:border-gray-700/50 
                  hover:border-indigo-200 dark:hover:border-indigo-500/30
                  shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] dark:shadow-none dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]
                  transition-all duration-300 hover:-translate-y-1.5
                  flex flex-col h-[280px]
                  ${activeTab === 'scripts' ? 'cursor-pointer' : ''}
                `}
              >
                {/* Decoration Gradient */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                {/* Header: Icon & Level */}
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme.bg} ${theme.color} border ${theme.border} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    {theme.icon}
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                     <span className={`
                      inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
                      ${script.level === 'Ensino Médio' 
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-900/30' 
                        : script.level === 'Ensino Fundamental 2' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-900/30' 
                          : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30'
                      }
                    `}>
                      {script.level === 'Ensino Fundamental 1' ? 'Fund. 1' : script.level === 'Ensino Fundamental 2' ? 'Fund. 2' : 'Médio'}
                    </span>
                  </div>
                </div>

                {/* Content: Title & Subject */}
                <div className="mb-2">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 block">
                        {script.subject}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {script.title}
                    </h3>
                </div>
                
                <div className="flex-grow">
                   <p className="text-xs text-gray-400 line-clamp-2 mt-2">{script.ideaText || "Sem descrição adicional."}</p>
                </div>

                {/* Footer: Date & Actions */}
                <div className="pt-4 mt-2 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
                   <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/30 px-2 py-1 rounded-md">
                      <Clock size={12} />
                      <span>{formatRelativeTime(script.lastModified)}</span>
                   </div>

                   {/* Action Buttons */}
                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {activeTab === 'trash' ? (
                        <>
                           <button 
                             onClick={(e) => handleRestore(e, script.id)}
                             title="Restaurar"
                             className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                           >
                             <Undo2 size={16} />
                           </button>
                           {deleteConfirmId === script.id ? (
                               <div className="flex items-center animate-fade-in bg-red-50 p-1 rounded-lg">
                                   <button 
                                      onClick={(e) => handleDeleteForever(script.id)}
                                      className="text-[10px] font-bold text-red-600 hover:underline px-2"
                                   >
                                      Confirmar?
                                   </button>
                                   <button onClick={() => setDeleteConfirmId(null)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                               </div>
                           ) : (
                             <button 
                               onClick={() => setDeleteConfirmId(script.id)}
                               title="Excluir Permanentemente"
                               className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                             >
                               <Trash size={16} />
                             </button>
                           )}
                        </>
                      ) : (
                         <button 
                           onClick={(e) => handleMoveToTrash(e, script.id)}
                           className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                           title="Mover para Lixeira"
                         >
                           <Trash2 size={16} />
                         </button>
                      )}
                   </div>
                </div>
              </div>
            );
          })}

          {!loading && filteredScripts.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 border border-dashed border-gray-200 dark:border-gray-700">
                {activeTab === 'trash' ? <Trash2 className="w-8 h-8 text-gray-300" /> : <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600" />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {activeTab === 'trash' ? 'A lixeira está vazia' : 'Nenhum roteiro encontrado'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                {activeTab === 'trash' 
                  ? 'Itens excluídos aparecerão aqui para restauração ou exclusão permanente.' 
                  : 'Parece que você ainda não tem projetos com esses filtros. Que tal começar um agora?'}
              </p>
              {activeTab === 'scripts' && (
                 <button 
                  onClick={onCreateClick}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-1"
                >
                  Criar Primeiro Canvas
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
