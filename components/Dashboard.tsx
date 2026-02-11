
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  BookOpen, 
  ChevronDown,
  Undo2,
  Trash,
  AlertTriangle,
  FileText,
  X
} from 'lucide-react';
import { EducationLevel, Bimester, ScriptItem } from '../types';
import { auth, db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';

interface DashboardProps {
  onCreateClick: () => void;
  onViewScript: (script: ScriptItem) => void;
}

// Helper para formatar data relativa de forma segura
const formatRelativeTime = (timestamp: any) => {
  if (!timestamp) return '...';
  
  // Trata Timestamp do Firestore ou Date objeto ou string ISO
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Agora';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} d`;
  
  return date.toLocaleDateString('pt-BR');
};

export const Dashboard: React.FC<DashboardProps> = ({ onCreateClick, onViewScript }) => {
  const [activeTab, setActiveTab] = useState<'scripts' | 'trash'>('scripts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel | ''>('');
  const [selectedBimester, setSelectedBimester] = useState<Bimester | ''>('');
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para controlar qual item está pedindo confirmação de exclusão
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

    // Consulta estrita: Apenas documentos onde userId == usuário atual
    const q = query(
      collection(db, "canvas"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const fetchedScripts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScriptItem[];
      
      // Ordenação no cliente por data de modificação (mais recente primeiro)
      fetchedScripts.sort((a, b) => {
        // Safe access to date properties
        const dateA = a.lastModified?.toDate ? a.lastModified.toDate() : new Date(a.lastModified || 0);
        const dateB = b.lastModified?.toDate ? b.lastModified.toDate() : new Date(b.lastModified || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setScripts(fetchedScripts);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching scripts:", err);
      if (err.code === 'permission-denied') {
        setError("Acesso negado. Suas regras de segurança do Firestore podem estar bloqueando o acesso.");
      } else {
        setError("Não foi possível carregar os roteiros. Verifique sua conexão.");
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
      // Exclui permanentemente do banco de dados
      await deleteDoc(doc(db, "canvas", id));
      setDeleteConfirmId(null); // Limpa o estado de confirmação
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Action Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-sm border border-gray-200/60 dark:border-gray-700 flex flex-col md:flex-row gap-2 transition-colors duration-300">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 border-none rounded-xl leading-5 bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-0"
            placeholder="Buscar roteiros..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 p-1 overflow-x-auto">
          <div className="relative min-w-[160px]">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as EducationLevel)}
              className="appearance-none w-full bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200/70 dark:hover:bg-gray-700 border-none rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer transition-colors"
            >
              <option value="">Todos os Níveis</option>
              <option value="Ensino Fundamental 1">Fund. 1</option>
              <option value="Ensino Fundamental 2">Fund. 2</option>
              <option value="Ensino Médio">Ensino Médio</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          <div className="relative min-w-[140px]">
            <select
              value={selectedBimester}
              onChange={(e) => setSelectedBimester(e.target.value as Bimester)}
              className="appearance-none w-full bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200/70 dark:hover:bg-gray-700 border-none rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer transition-colors"
            >
              <option value="">Todos</option>
              <option value="1º Bimestre">1º Bimestre</option>
              <option value="2º Bimestre">2º Bimestre</option>
              <option value="3º Bimestre">3º Bimestre</option>
              <option value="4º Bimestre">4º Bimestre</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1"></div>

          <button 
            onClick={onCreateClick}
            className="flex items-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] dark:bg-[#6366f1] dark:hover:bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Novo Roteiro</span>
          </button>

          <button 
            onClick={() => setActiveTab(activeTab === 'scripts' ? 'trash' : 'scripts')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
              activeTab === 'trash' 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30' 
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
          >
            <Trash2 size={16} />
            <span>{activeTab === 'scripts' ? 'Lixeira' : 'Voltar'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400">
           <AlertTriangle size={20} />
           <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        // Loading Skeleton
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {[1, 2, 3, 4].map((i) => (
             <div key={i} className="bg-white dark:bg-gray-800 rounded-[20px] p-5 border border-gray-100 dark:border-gray-700 h-[220px] animate-pulse">
               <div className="flex justify-between mb-4">
                 <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
               </div>
               <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-md mb-2"></div>
               <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
               <div className="mt-auto pt-8 flex items-center justify-between">
                 <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
               </div>
             </div>
           ))}
         </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredScripts.map((script) => (
            <div 
              key={script.id} 
              onClick={() => activeTab === 'scripts' && onViewScript(script)}
              className={`group bg-white dark:bg-gray-800 rounded-[20px] p-5 border border-gray-100 dark:border-gray-700 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:border-indigo-100 dark:hover:border-indigo-900/50 hover:-translate-y-1 transition-all duration-300 relative flex flex-col h-[220px] ${activeTab === 'scripts' ? 'cursor-pointer' : ''}`}
            >
              <div className="flex justify-between items-start mb-3 h-7">
                <span className={`
                  inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border h-fit
                  ${script.level === 'Ensino Médio' 
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-900/30' 
                    : script.level === 'Ensino Fundamental 2' 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-900/30' 
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30'
                  }
                `}>
                  {script.level === 'Ensino Fundamental 1' ? 'Fund. 1' : script.level === 'Ensino Fundamental 2' ? 'Fund. 2' : 'Médio'}
                </span>
                
                <div className={`flex gap-1 transition-opacity ${activeTab === 'trash' || deleteConfirmId === script.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                   {activeTab === 'trash' ? (
                     <>
                        <button 
                          onClick={(e) => handleRestore(e, script.id)}
                          title="Restaurar"
                          className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Undo2 size={16} />
                        </button>
                        
                        {deleteConfirmId === script.id ? (
                           <div className="flex items-center ml-1 animate-fade-in">
                               <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteForever(script.id);
                                  }}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded shadow-sm mr-1 whitespace-nowrap"
                               >
                                  Confirmar?
                               </button>
                               <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(null);
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                               >
                                  <X size={14} />
                               </button>
                           </div>
                        ) : (
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(script.id);
                            }}
                            title="Excluir Permanentemente"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash size={16} />
                          </button>
                        )}
                     </>
                   ) : (
                      <button 
                        onClick={(e) => handleMoveToTrash(e, script.id)}
                        title="Mover para lixeira"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                   )}
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2 group-hover:text-[#4f46e5] dark:group-hover:text-[#818cf8] transition-colors">
                {script.title}
              </h3>

              <div className="flex-grow"></div>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center border border-gray-100 dark:border-gray-600 text-gray-400 dark:text-gray-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:border-indigo-100 dark:group-hover:border-indigo-800 transition-colors">
                  <BookOpen size={14} />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">{script.subject}</span>
              </div>

              <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                 <span className="font-medium bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">{script.bimester}</span>
                 <span>{formatRelativeTime(script.lastModified)}</span>
              </div>
            </div>
          ))}

          {!loading && filteredScripts.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-800 rounded-[32px] border border-dashed border-gray-200 dark:border-gray-700 transition-colors duration-300">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                {activeTab === 'trash' ? <Trash2 className="w-8 h-8 text-gray-300" /> : <FileText className="w-8 h-8 text-gray-300 dark:text-gray-500" />}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {activeTab === 'trash' ? 'Lixeira vazia' : 'Nenhum roteiro encontrado'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 mb-4">
                {activeTab === 'trash' ? 'Itens excluídos aparecerão aqui.' : 'Crie um novo canvas para começar a gamificar.'}
              </p>
              {activeTab === 'scripts' && (
                 <button 
                  onClick={onCreateClick}
                  className="text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
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
