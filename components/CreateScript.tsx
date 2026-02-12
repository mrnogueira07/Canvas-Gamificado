import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  Upload, 
  Sparkles, 
  Wand2, 
  Gamepad2, 
  Palette, 
  Lightbulb, 
  ChevronDown, 
  Info,
  Loader2,
  BookOpen,
  Clapperboard, 
  Library,
  RefreshCw,
  Download,
  Save,
  Pencil,
  ListChecks,
  Check,
  Search,
  Puzzle,
  Dices,
  Target,
  AlertTriangle,
  Gift,
  Clock,
  BarChart,
  Layers,
  Crosshair,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertOctagon,
  Flag,
  Play,
  RotateCcw,
  Footprints,
  MousePointerClick,
  MoveRight,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from './Button';
import { EducationLevel, Bimester, GamifiedCanvas, ScriptItem, QuizQuestion, TargetItem, BoardHouse, DragDropPair, DragDropLevel } from '../types';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { generateCanvasContent } from '../services/ai';

interface CreateScriptProps {
  onBack: () => void;
  initialData?: ScriptItem | null;
}

export const CreateScript: React.FC<CreateScriptProps> = ({ onBack, initialData }) => {
  // Inicializa o estado com initialData se existir, ou valores padrão
  const [level, setLevel] = useState<EducationLevel | ''>(initialData?.level || '');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [year, setYear] = useState(initialData?.year || ''); 
  const [bimester, setBimester] = useState<Bimester | ''>(initialData?.bimester || '1º Bimestre');
  const [gameType, setGameType] = useState(initialData?.gameType || '');
  
  // Nível / Quantidade de fases (Novo estado)
  const [amountLevels, setAmountLevels] = useState<number>(3); // Default 3

  // Quiz configs (Initial Form)
  const [includeQuiz, setIncludeQuiz] = useState(initialData?.includeQuiz ?? false);
  const [quizCount, setQuizCount] = useState(initialData?.questionsCount || 5);
  
  const [ideaText, setIdeaText] = useState(initialData?.ideaText || '');
  
  // Estado para controlar o ID do documento atual
  const [currentDocId, setCurrentDocId] = useState<string | null>(initialData?.id || null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  
  // DATA STATES
  const [generatedData, setGeneratedData] = useState<GamifiedCanvas | null>(initialData?.generatedContent || null);
  // Last Saved Data state to compare and enable/disable Save button
  const [lastSavedData, setLastSavedData] = useState<GamifiedCanvas | null>(initialData?.generatedContent || null);

  // --- CONFIGURAÇÃO DAS LISTAS ---
  
  const levels = [
    { value: 'Ensino Fundamental 1', label: 'Ensino Fundamental 1 (1º ao 5º ano)' },
    { value: 'Ensino Fundamental 2', label: 'Ensino Fundamental 2 (6º ao 9º ano)' },
    { value: 'Ensino Médio', label: 'Ensino Médio' },
    { value: 'Ensino Superior', label: 'Ensino Superior' }
  ];

  const gameTypes = [
    "Tiro ao Alvo",
    "Jogo de Tabuleiro",
    "Jogo de Arrastar e Soltar",
    "Roleta",
    "Jogo da Memória",
    "Caça ao Tesouro",
    "Escape Room (Digital)",
    "Quiz Gamificado",
    "Jogo de Plataforma 2D",
    "Quebra-Cabeça"
  ];

  const subjectsByLevel: Record<string, string[]> = {
    'Ensino Fundamental 1': [
      'História', 'Geografia', 'Ciências', 'Língua Portuguesa', 'Matemática', 'Artes', 'Educação Física'
    ],
    'Ensino Fundamental 2': [
      'História', 'Geografia', 'Ciências', 'Língua Portuguesa', 'Matemática', 'Artes', 'Educação Física', 
      'Ensino Religioso', 'Língua Inglesa', 'Língua Espanhola'
    ],
    'Ensino Médio': [
      'Língua Portuguesa', 'Língua Inglesa', 'Matemática', 'Física', 'Química', 'Biologia', 
      'História', 'Geografia', 'Artes', 'Sociologia', 'Filosofia', 'Educação Física'
    ],
    'Ensino Superior': [
      'Administração', 'Direito', 'Pedagogia', 'Engenharia', 'Saúde', 'Tecnologia', 'Geral'
    ]
  };

  const yearsByLevel: Record<string, string[]> = {
    'Ensino Fundamental 1': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
    'Ensino Fundamental 2': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
    'Ensino Médio': ['1º Ano', '2º Ano', '3º Ano'],
    'Ensino Superior': ['1º Semestre', '2º Semestre', '3º Semestre', '4º Semestre', '5º Semestre', '6º Semestre', '7º Semestre', '8º Semestre', 'Geral']
  };

  // Efeito para atualizar campos caso initialData mude
  useEffect(() => {
    if (initialData) {
      setLevel(initialData.level);
      setSubject(initialData.subject); 
      setYear(initialData.year); 
      setBimester(initialData.bimester);
      setGameType(initialData.gameType);
      setIdeaText(initialData.ideaText);
      setIncludeQuiz(initialData.includeQuiz);
      setQuizCount(initialData.questionsCount || 5);
      
      // Tenta recuperar quantidade de fases se o jogo suportar (lógica simplificada: usa array length se existir)
      if (initialData.generatedContent?.dragDrop?.levels) {
         setAmountLevels(initialData.generatedContent.dragDrop.levels.length);
      } else if (initialData.generatedContent?.targetShooting?.targets) {
         setAmountLevels(initialData.generatedContent.targetShooting.targets.length);
      } else if (initialData.generatedContent?.boardGame?.totalHouses) {
         setAmountLevels(initialData.generatedContent.boardGame.totalHouses);
      }

      setGeneratedData(initialData.generatedContent || null);
      setLastSavedData(initialData.generatedContent || null);
      setCurrentDocId(initialData.id);
    }
  }, [initialData]);

  // Check for changes to enable Save Button
  const hasUnsavedChanges = useMemo(() => {
    if (!generatedData) return false;
    if (!lastSavedData) return true;
    return JSON.stringify(generatedData) !== JSON.stringify(lastSavedData);
  }, [generatedData, lastSavedData]);

  const handleLevelChange = (newLevel: EducationLevel) => {
    setLevel(newLevel);
    setSubject('');
    setYear('');
  };

  const isFormValid = level && subject && year && bimester && gameType;
  const isEditing = !!initialData;

  const handleUpdateField = (path: string[], value: string) => {
    setGeneratedData(prev => {
        if (!prev) return null;
        const newData = { ...prev };
        let current: any = newData;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
        return newData;
    });
  };

  const handleUpdateTarget = (index: number, field: keyof TargetItem, value: any) => {
    if (!generatedData?.targetShooting) return;
    const newTargets = [...generatedData.targetShooting.targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    
    setGeneratedData({
        ...generatedData,
        targetShooting: {
            ...generatedData.targetShooting,
            targets: newTargets
        }
    });
  };

  const handleUpdateBoardHouse = (index: number, field: keyof BoardHouse, value: any) => {
    if (!generatedData?.boardGame) return;
    const newHouses = [...generatedData.boardGame.houses];
    newHouses[index] = { ...newHouses[index], [field]: value };
    
    setGeneratedData({
        ...generatedData,
        boardGame: {
            ...generatedData.boardGame,
            houses: newHouses
        }
    });
  };

  const handleUpdateDragDrop = (levelIndex: number, pairIndex: number, field: keyof DragDropPair, value: string) => {
    if (!generatedData?.dragDrop) return;
    
    const newLevels = [...generatedData.dragDrop.levels];
    const newPairs = [...newLevels[levelIndex].pairs];
    newPairs[pairIndex] = { ...newPairs[pairIndex], [field]: value };
    newLevels[levelIndex] = { ...newLevels[levelIndex], pairs: newPairs };

    setGeneratedData({
        ...generatedData,
        dragDrop: {
            ...generatedData.dragDrop,
            levels: newLevels
        }
    });
  };

  const handleUpdateDragDropLevelInfo = (levelIndex: number, field: 'title' | 'description', value: string) => {
    if (!generatedData?.dragDrop) return;
    
    const newLevels = [...generatedData.dragDrop.levels];
    newLevels[levelIndex] = { ...newLevels[levelIndex], [field]: value };

    setGeneratedData({
        ...generatedData,
        dragDrop: {
            ...generatedData.dragDrop,
            levels: newLevels
        }
    });
  };

  const handleManualSave = async () => {
    if (!generatedData || !auth.currentUser || !currentDocId) return;
    
    setIsSaving(true);
    try {
        const docRef = doc(db, "canvas", currentDocId);
        await updateDoc(docRef, {
            title: generatedData.title_suggestion,
            generatedContent: generatedData,
            lastModified: serverTimestamp()
        });
        setLastSavedData(JSON.parse(JSON.stringify(generatedData))); // Deep copy
    } catch (error) {
        console.error("Erro ao salvar edições manuais:", error);
        alert("Erro ao salvar alterações.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleGenerateAndSave = async () => {
    if (!isFormValid || !auth.currentUser) {
      alert("Por favor, preencha todos os campos obrigatórios e verifique se está logado.");
      return;
    }
    
    setIsGenerating(true);
    setGeneratedData(null); 
    
    try {
      const displaySubject = subject;
      const displayYear = year;
      const user = auth.currentUser;
      
      setLoadingStep('Consultando especialistas...');
      await new Promise(r => setTimeout(r, 500)); 
      
      setLoadingStep('Criando lógica do jogo...');
      
      // Geração Única (Canvas + Quiz Opcional + Quantidade de Fases)
      const generatedContent = await generateCanvasContent({
        level,
        subject: displaySubject,
        year: displayYear,
        bimester,
        gameType,
        context: ideaText,
        includeQuiz,
        quizCount,
        amountLevels // Passa a quantidade de fases
      });

      setLoadingStep('Salvando roteiro...');
      const finalTitle = generatedContent.title_suggestion || `Roteiro de ${displaySubject} - ${displayYear}`;

      const commonData = {
        userId: user.uid,
        authorName: user.displayName || 'Professor(a)',
        authorEmail: user.email,
        title: finalTitle,
        subject: displaySubject,
        level,
        year: displayYear,
        bimester,
        gameType,
        includeQuiz,
        questionsCount: quizCount,
        ideaText,
        generatedContent: generatedContent,
        status: 'active',
        lastModified: serverTimestamp()
      };

      if (currentDocId) {
        const docRef = doc(db, "canvas", currentDocId);
        // @ts-ignore
        await updateDoc(docRef, commonData);
      } else {
        // @ts-ignore
        const docRef = await addDoc(collection(db, "canvas"), {
            ...commonData,
            createdAt: serverTimestamp()
        });
        setCurrentDocId(docRef.id);
      }

      setGeneratedData(generatedContent);
      setLastSavedData(generatedContent); // Sync saved state

    } catch (error) {
      console.error("Erro ao gerar/salvar roteiro:", error);
      alert("Houve um erro ao gerar o canvas com IA. Verifique sua conexão e tente novamente.");
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const currentSubjects = level ? subjectsByLevel[level] || [] : [];
  const currentYears = level ? yearsByLevel[level] || [] : [];

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans transition-colors duration-300 overflow-hidden print:h-auto print:overflow-visible">
      {/* Header - Hidden on Print */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex-none flex items-center justify-between px-6 sticky top-0 z-40 transition-colors duration-300 print:hidden">
        <button 
          onClick={onBack}
          disabled={isGenerating}
          className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <ChevronLeft size={20} className="mr-1" />
          Voltar para Dashboard
        </button>
        
        <h1 className="text-sm font-bold tracking-widest text-gray-800 dark:text-white uppercase">
          {isEditing ? 'Editar Canvas' : 'Novo Canvas'}
        </h1>
        
        <div className="w-20"></div>
      </header>

      <div className="flex-1 flex overflow-hidden relative print:overflow-visible print:h-auto">
        
        {/* Left Sidebar - Settings - Hidden on Print */}
        <div className="w-full md:w-[400px] lg:w-[450px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto h-full p-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 transition-colors duration-300 print:hidden">
          
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
               <Wand2 size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Definições do Roteiro</h2>
          </div>

          <div className="space-y-6">
            
            {/* Nível de Ensino */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Nível de Ensino <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select 
                  value={level}
                  onChange={(e) => handleLevelChange(e.target.value as EducationLevel)}
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-600 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Selecione o nível...</option>
                  {levels.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>

            {/* Row: Matéria & Ano */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Matéria <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <select 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={!level}
                      className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-600 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>{level ? "Selecione..." : "Selecione o nível"}</option>
                      {currentSubjects.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Ano <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <select 
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      disabled={!level}
                      className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-600 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>{level ? "Selecione..." : "Selecione o nível"}</option>
                      {currentYears.map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            {/* Bimestre */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Bimestre <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select 
                  value={bimester}
                  onChange={(e) => setBimester(e.target.value as Bimester)}
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-600 transition-all appearance-none cursor-pointer"
                >
                  <option value="1º Bimestre">1º Bimestre</option>
                  <option value="2º Bimestre">2º Bimestre</option>
                  <option value="3º Bimestre">3º Bimestre</option>
                  <option value="4º Bimestre">4º Bimestre</option>
                </select>
                <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>

            {/* Tipo de Jogo */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Tipo de Jogo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select 
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-600 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Selecione o tipo de jogo...</option>
                  {gameTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>

            {/* SELETOR DE QUANTIDADE DE FASES (NOVO) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <SlidersHorizontal size={14} />
                        Quantidade de Fases
                    </label>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                        {amountLevels}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-medium">1</span>
                    <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={amountLevels} 
                        onChange={(e) => setAmountLevels(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-xs text-gray-400 font-medium">10</span>
                </div>
            </div>

            {/* Configuração do Quiz */}
            <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                        <ListChecks size={14} />
                        Gerar Quiz?
                    </label>
                    <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name="toggle" 
                            id="toggle" 
                            checked={includeQuiz}
                            onChange={(e) => setIncludeQuiz(e.target.checked)}
                            className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 left-0 checked:right-0 checked:left-auto"
                            style={{ left: includeQuiz ? '50%' : '0' }}
                        />
                        <label 
                            htmlFor="toggle" 
                            className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors duration-300 ${includeQuiz ? 'bg-indigo-600' : 'bg-gray-300'}`}
                        ></label>
                    </div>
                </div>
                
                {includeQuiz && (
                    <div className="flex items-center justify-between mt-2 animate-fade-in">
                        <span className="text-xs text-indigo-600/80 dark:text-indigo-400/80 font-medium">Qtd. Perguntas:</span>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 border border-indigo-100 dark:border-indigo-900/50">
                            <input 
                                type="range" 
                                min="3" 
                                max="20" 
                                value={quizCount} 
                                onChange={(e) => setQuizCount(parseInt(e.target.value))}
                                className="w-24 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 w-5 text-center">{quizCount}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Context Text Area */}
            <div>
               <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contexto Extra / Ideia do Professor
                  </label>
               </div>
               <textarea 
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl p-4 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-600 transition-all resize-none h-28"
                  placeholder="Ex: Gostaria de usar o tema de super-heróis ou exploração espacial..."
               />
            </div>

            {/* Action Button */}
            <div className="pt-2 pb-12">
              <Button 
                onClick={handleGenerateAndSave}
                disabled={!isFormValid || isGenerating}
                isLoading={isGenerating}
                className={`w-full py-4 font-bold text-sm tracking-wide shadow-none transition-all
                  ${!isFormValid 
                    ? 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30'
                  }`}
              >
                {!isGenerating && (
                  isEditing ? <RefreshCw size={18} className="mr-2" /> : <Sparkles size={18} className="mr-2" />
                )}
                {isGenerating 
                  ? 'CRIANDO CANVAS...' 
                  : (isEditing ? 'RECRIAR CANVAS' : 'GERAR CANVAS')
                }
              </Button>
              
              {isGenerating && (
                 <p className="text-center text-xs text-indigo-600 dark:text-indigo-400 mt-3 animate-pulse">
                   {loadingStep}
                 </p>
              )}
            </div>

          </div>
        </div>

        {/* Right Content - Empty State / Preview */}
        <div 
          className={`
            hidden md:flex flex-1 bg-gray-50/50 dark:bg-gray-900 relative transition-colors duration-300 h-full
            ${generatedData ? 'overflow-y-auto items-start p-8' : 'items-center justify-center p-8 overflow-hidden'}
            print:block print:w-full print:bg-white print:p-0 print:h-auto print:overflow-visible print:absolute print:top-0 print:left-0 print:z-50
          `}
        >
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-100/50 dark:bg-indigo-900/20 rounded-full blur-3xl pointer-events-none opacity-50 fixed print:hidden"></div>
          
          {generatedData ? (
            <div className="relative z-10 w-full max-w-4xl mx-auto animate-fade-in-up pb-12 print:max-w-none print:w-full print:pb-0">
               
               {/* --- NAV BAR SUPERIOR --- */}
               <div className="flex justify-between items-center mb-6 px-1 print:hidden">
                  <button
                    onClick={onBack}
                    className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-sm font-medium"
                  >
                    <ChevronLeft size={16} className="mr-1" />
                    Voltar
                  </button>

                  <div className="flex gap-3">
                      <Button
                        onClick={handleManualSave}
                        disabled={!hasUnsavedChanges || isSaving}
                        variant="secondary"
                        className={`h-9 px-4 text-xs shadow-sm bg-white border text-indigo-700 transition-all ${hasUnsavedChanges ? 'border-indigo-300 hover:bg-indigo-50 opacity-100' : 'border-gray-200 opacity-50 cursor-not-allowed'}`}
                        icon={isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />}
                      >
                         {isSaving ? 'Salvando...' : (hasUnsavedChanges ? 'Salvar Alterações' : 'Salvo')}
                      </Button>

                      <button
                        onClick={handleExportPDF}
                        className="flex items-center text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors text-sm font-medium px-2"
                      >
                         <Download size={16} className="mr-2" />
                         Exportar para PDF
                      </button>
                  </div>
               </div>
               {/* ----------------------------------------------------- */}

               {/* Document Display */}
               <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 md:p-12 mb-8 print:border-none print:shadow-none print:p-0 print:mb-0">
                  
                  {/* Header do Documento */}
                  <div className="text-center mb-12 border-b border-gray-100 dark:border-gray-700 pb-8 print:border-gray-300">
                    <div className="mb-3 print:hidden w-full flex justify-center">
                        <textarea 
                            value={generatedData.title_suggestion}
                            onChange={(e) => {
                                handleUpdateField(['title_suggestion'], e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            ref={(el) => {
                                if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = el.scrollHeight + 'px';
                                }
                            }}
                            className="w-full text-center text-3xl font-bold text-gray-900 dark:text-white uppercase tracking-tight bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition-all placeholder-gray-300 resize-none overflow-hidden"
                            placeholder="TÍTULO DO JOGO"
                            rows={1}
                        />
                    </div>
                    {/* Título Estático para Impressão */}
                    <h1 className="hidden print:block text-3xl font-bold text-black uppercase tracking-tight mb-3">
                      {generatedData.title_suggestion}
                    </h1>

                    <div className="flex items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400 print:text-gray-600">
                      <span>{generatedData.curriculum.year_bimester}</span>
                      <span>•</span>
                      <span>{generatedData.curriculum.subject}</span>
                      <span>•</span>
                      <span>{generatedData.curriculum.area}</span>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* CARD 1 */}
                    <SectionCard number={1} icon={<BookOpen size={18} />} title="DIRETRIZES CURRICULARES">
                      <div className="grid grid-cols-1 gap-6">
                        <Field label="ÁREA:" value={generatedData.curriculum.area} />
                        <Field label="ANO E BIMESTRE:" value={generatedData.curriculum.year_bimester} />
                        <Field label="DISCIPLINA:" value={generatedData.curriculum.subject} />
                        
                        {/* Tema Editável */}
                        <EditableField 
                            label="TEMA:" 
                            value={generatedData.curriculum.theme}
                            onChange={(val) => handleUpdateField(['curriculum', 'theme'], val)}
                        />

                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700 print:bg-gray-50 print:border-gray-200">
                           <Field label="HABILIDADES DA BNCC:" value={generatedData.curriculum.bncc_codes} className="font-bold text-indigo-700 dark:text-indigo-400 print:text-black" />
                           <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed print:text-gray-800">
                             <span className="font-bold text-xs text-gray-500 uppercase block mb-1">DESCRIÇÃO:</span>
                             {generatedData.curriculum.bncc_description}
                           </div>
                        </div>
                        <Field label="REFERÊNCIA BIBLIOGRÁFICA:" value={generatedData.curriculum.bibliography} />
                      </div>
                    </SectionCard>

                    {/* CARD 2 */}
                    <SectionCard number={2} icon={<Gamepad2 size={18} />} title="DESIGN & PÚBLICO">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Field label="GÊNERO DO JOGO:" value={generatedData.style.genre} />
                          <Field label="PÚBLICO ALVO:" value={generatedData.style.target_audience} />
                        </div>
                        
                        {/* Narrativa Intro Editável */}
                        <EditableField 
                            label="NARRATIVA DO JOGO (RESUMO):" 
                            value={generatedData.style.narrative_intro}
                            onChange={(val) => handleUpdateField(['style', 'narrative_intro'], val)}
                            isTextArea
                        />
                      </div>
                    </SectionCard>

                    {/* CARD 3 (AGORA NARRATIVA DETALHADA) */}
                    <SectionCard number={3} icon={<Clapperboard size={18} />} title="NARRATIVA & ENREDO">
                      <div className="space-y-6">
                        <EditableField 
                            label="SINOPSE E ENREDO:" 
                            value={generatedData.narrative.synopsis}
                            onChange={(val) => handleUpdateField(['narrative', 'synopsis'], val)}
                            isTextArea
                        />
                        <EditableField 
                            label="PERSONAGENS:" 
                            value={generatedData.narrative.characters}
                            onChange={(val) => handleUpdateField(['narrative', 'characters'], val)}
                            isTextArea
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                          <div className="space-y-1">
                            <EditableField 
                                label="FLUXO DE JOGO:" 
                                value={generatedData.narrative.flow}
                                onChange={(val) => handleUpdateField(['narrative', 'flow'], val)}
                                isTextArea
                                height="h-40"
                            />
                          </div>
                          <div className="space-y-1">
                            <EditableField 
                                label="INIMIGOS/OBSTÁCULOS:" 
                                value={generatedData.narrative.enemies}
                                onChange={(val) => handleUpdateField(['narrative', 'enemies'], val)}
                                isTextArea
                                height="h-40"
                            />
                          </div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30 print:bg-gray-50 print:border-gray-200">
                          <EditableField 
                              label="MECÂNICAS E TAREFAS:" 
                              value={generatedData.narrative.mechanics}
                              onChange={(val) => handleUpdateField(['narrative', 'mechanics'], val)}
                              isTextArea
                              transparentBg
                          />
                        </div>
                      </div>
                    </SectionCard>

                    {/* CARD 4 (AGORA CONTEÚDO PROGRAMÁTICO) */}
                    <SectionCard number={4} icon={<Library size={18} />} title="OBJETIVOS & CONDIÇÕES">
                      <div className="space-y-6">
                         <EditableField 
                            label="INTRODUÇÃO (BOAS VINDAS):" 
                            value={generatedData.content.intro}
                            onChange={(val) => handleUpdateField(['content', 'intro'], val)}
                            isTextArea
                         />
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 dark:border-gray-700 pt-6 print:border-gray-300">
                            <div>
                               <EditableField 
                                    label="VITÓRIA:" 
                                    value={generatedData.content.victory_condition}
                                    onChange={(val) => handleUpdateField(['content', 'victory_condition'], val)}
                                    isTextArea
                                    labelColor="text-green-600 dark:text-green-400"
                                />
                            </div>
                            <div>
                               <EditableField 
                                    label="DERROTA:" 
                                    value={generatedData.content.defeat_condition}
                                    onChange={(val) => handleUpdateField(['content', 'defeat_condition'], val)}
                                    isTextArea
                                    labelColor="text-red-500 dark:text-red-400"
                                />
                            </div>
                         </div>
                      </div>
                    </SectionCard>

                    {/* CARD 5: LOGICA DO JOGO (TABULEIRO OU TIRO AO ALVO OU GENERICO) */}
                    
                    {/* VERIFICAÇÃO SE É JOGO DE TABULEIRO */}
                    {generatedData.boardGame ? (
                      <SectionCard number={5} icon={<Footprints size={18} />} title="MECÂNICA: JOGO DE TABULEIRO (TRILHA)">
                         <div className="space-y-6">
                            {/* Stats */}
                            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700 mb-4 text-center">
                                 <div className="flex items-center gap-2">
                                   <Flag size={14} className="text-indigo-500"/>
                                   <span>{generatedData.boardGame.totalHouses} Casas Fixas</span>
                                 </div>
                                 <span>•</span>
                                 <div className="flex items-center gap-2">
                                   <Dices size={14} className="text-orange-500"/>
                                   <span>{generatedData.boardGame.diceConfig}</span>
                                 </div>
                                 <span>•</span>
                                 <span>{generatedData.boardGame.playersConfig}</span>
                            </div>

                            {/* Board Path UI */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                {generatedData.boardGame.houses.map((house, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`relative p-5 rounded-xl border-2 transition-all flex flex-col gap-3
                                      ${house.type === 'start' ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-700/50' : 
                                        house.type === 'finish' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700/50' :
                                        house.type === 'setback' ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/30' :
                                        house.type === 'bonus' ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/30' :
                                        house.type === 'quiz' ? 'border-purple-200 bg-purple-50 dark:bg-purple-900/10 dark:border-purple-800/30' :
                                        'border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800/30'
                                      }
                                    `}
                                  >
                                      {/* Header with Icon and Number */}
                                      <div className="flex justify-between items-center border-b border-black/5 pb-2 mb-1">
                                          <div className="flex items-center gap-2">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-black/20 text-xs font-bold shadow-sm">
                                              {house.number}
                                            </span>
                                            {house.type === 'start' && <Play size={14} className="text-green-600"/>}
                                            {house.type === 'finish' && <Flag size={14} className="text-indigo-600"/>}
                                            {house.type === 'info' && <Info size={14} className="text-blue-500"/>}
                                            {house.type === 'quiz' && <HelpCircle size={14} className="text-purple-500"/>}
                                            {house.type === 'setback' && <AlertOctagon size={14} className="text-red-500"/>}
                                            {house.type === 'bonus' && <Sparkles size={14} className="text-amber-500"/>}
                                          </div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                                            {house.type === 'start' ? 'Início' : 
                                             house.type === 'finish' ? 'Chegada' : 
                                             house.type === 'setback' ? 'Punição' :
                                             house.type === 'bonus' ? 'Bônus' : 
                                             house.type === 'quiz' ? 'Desafio' : 'Info'}
                                          </span>
                                      </div>

                                      {/* Editable Content */}
                                      <div className="space-y-2">
                                        <textarea
                                            className="font-bold text-gray-800 dark:text-gray-200 bg-transparent border-none focus:outline-none focus:underline w-full resize-none overflow-hidden leading-tight h-auto"
                                            value={house.title}
                                            onChange={(e) => {
                                                handleUpdateBoardHouse(idx, 'title', e.target.value);
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            ref={(el) => {
                                              if(el) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                              }
                                            }}
                                            rows={1}
                                            placeholder="Título da Casa"
                                        />
                                        
                                        <textarea 
                                             className="text-sm text-gray-600 dark:text-gray-400 bg-transparent border-none w-full resize-none focus:outline-none focus:bg-white/50 dark:focus:bg-black/20 rounded p-1"
                                             value={house.description}
                                             onChange={(e) => handleUpdateBoardHouse(idx, 'description', e.target.value)}
                                             rows={2}
                                             placeholder="Descrição ou Pergunta"
                                        />

                                        {/* Action Field if exists */}
                                        {(house.type !== 'start' && house.type !== 'finish' && house.type !== 'info') && (
                                           <div className="flex items-center gap-1 mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                                              <RotateCcw size={10} />
                                              <input 
                                                value={house.action || ''}
                                                onChange={(e) => handleUpdateBoardHouse(idx, 'action', e.target.value)}
                                                className="bg-transparent border-b border-dashed border-gray-300 focus:border-indigo-500 focus:outline-none w-full"
                                                placeholder="Ação (ex: Volte 1 casa)"
                                              />
                                           </div>
                                        )}
                                      </div>
                                  </div>
                                ))}
                            </div>
                         </div>
                      </SectionCard>
                    ) 
                    /* VERIFICAÇÃO SE É ARRASTAR E SOLTAR */
                    : generatedData.dragDrop ? (
                        <SectionCard number={5} icon={<MousePointerClick size={18} />} title="MECÂNICA: ARRASTAR E SOLTAR">
                            <div className="space-y-8">
                                {generatedData.dragDrop.levels.map((level, lvlIdx) => (
                                    <div key={lvlIdx} className="bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl p-6 border border-amber-100 dark:border-amber-800/30">
                                        <div className="mb-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-200 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                                    Nível {lvlIdx + 1}
                                                </div>
                                                <input 
                                                    className="font-bold text-lg text-gray-800 dark:text-white bg-transparent border-none focus:outline-none focus:underline w-full"
                                                    value={level.title}
                                                    onChange={(e) => handleUpdateDragDropLevelInfo(lvlIdx, 'title', e.target.value)}
                                                    placeholder="Título da Fase"
                                                />
                                            </div>
                                            <textarea 
                                                className="w-full text-sm text-gray-600 dark:text-gray-300 bg-transparent border-none resize-none focus:outline-none focus:bg-white/50 dark:focus:bg-black/20 rounded p-1"
                                                value={level.description}
                                                onChange={(e) => handleUpdateDragDropLevelInfo(lvlIdx, 'description', e.target.value)}
                                                rows={2}
                                                placeholder="Descrição do desafio..."
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {level.pairs.map((pair, pairIdx) => (
                                                <div key={pairIdx} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                                                    <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 border border-dashed border-gray-300 dark:border-gray-600">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Item (Arrastar)</label>
                                                        <textarea 
                                                            className="w-full bg-transparent border-none text-sm font-semibold text-gray-800 dark:text-white focus:outline-none resize-none overflow-hidden"
                                                            value={pair.item}
                                                            onChange={(e) => {
                                                                handleUpdateDragDrop(lvlIdx, pairIdx, 'item', e.target.value);
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }}
                                                            ref={(el) => {
                                                                if(el) {
                                                                    el.style.height = 'auto';
                                                                    el.style.height = el.scrollHeight + 'px';
                                                                }
                                                            }}
                                                            rows={1}
                                                            placeholder="Item"
                                                        />
                                                    </div>
                                                    
                                                    <MoveRight size={16} className="text-gray-400 flex-shrink-0" />
                                                    
                                                    <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-100 dark:border-amber-800/40">
                                                        <label className="text-[10px] uppercase font-bold text-amber-500 block mb-1">Zona (Soltar)</label>
                                                        <textarea 
                                                            className="w-full bg-transparent border-none text-sm font-semibold text-gray-800 dark:text-white focus:outline-none resize-none overflow-hidden"
                                                            value={pair.zone}
                                                            onChange={(e) => {
                                                                handleUpdateDragDrop(lvlIdx, pairIdx, 'zone', e.target.value);
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }}
                                                            ref={(el) => {
                                                                if(el) {
                                                                    el.style.height = 'auto';
                                                                    el.style.height = el.scrollHeight + 'px';
                                                                }
                                                            }}
                                                            rows={1}
                                                            placeholder="Zona"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )
                    /* VERIFICAÇÃO SE É TIRO AO ALVO */
                    : generatedData.targetShooting ? (
                       <SectionCard number={5} icon={<BookOpen size={18} />} title="MECÂNICA: TIRO AO ALVO">
                          <div className="space-y-6">
                              {/* Header Infos */}
                              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700 mb-4 text-center">
                                 <span>{generatedData.targetShooting.targets.length} alvos</span>
                                 <span>•</span>
                                 <span>Tempo: {generatedData.targetShooting.timeLimit}</span>
                                 <span>•</span>
                                 <span>{generatedData.targetShooting.levelsCount}</span>
                              </div>

                              {/* Target Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {generatedData.targetShooting.targets.map((target, idx) => (
                                      <div 
                                        key={idx} 
                                        className={`relative p-5 rounded-2xl border transition-all hover:shadow-md ${
                                            target.type === 'correct' || target.type === 'info' 
                                            ? 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-900/10 dark:border-emerald-900/30' 
                                            : 'bg-red-50 border-red-200/60 dark:bg-red-900/10 dark:border-red-900/30'
                                        }`}
                                      >
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="flex items-center gap-2 w-full mr-2">
                                                 <div className={`p-1.5 rounded-full flex-shrink-0 ${target.type === 'correct' || target.type === 'info' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-300' : 'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-300'}`}>
                                                    <Crosshair size={16} />
                                                 </div>
                                                 <textarea
                                                    className="font-bold text-gray-800 dark:text-gray-200 bg-transparent border-none focus:outline-none focus:underline w-full resize-none overflow-hidden leading-tight"
                                                    value={target.title}
                                                    onChange={(e) => {
                                                        handleUpdateTarget(idx, 'title', e.target.value);
                                                        e.target.style.height = 'auto';
                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                    }}
                                                    ref={(el) => {
                                                        if (el) {
                                                            el.style.height = 'auto';
                                                            el.style.height = el.scrollHeight + 'px';
                                                        }
                                                    }}
                                                    rows={1}
                                                 />
                                              </div>
                                              <span className={`text-sm font-bold whitespace-nowrap ${target.type === 'correct' || target.type === 'info' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                 {target.points > 0 ? `+${target.points} pts` : `${target.points} pts`}
                                              </span>
                                          </div>
                                          
                                          <textarea 
                                             className="text-sm text-gray-600 dark:text-gray-400 bg-transparent border-none w-full resize-none focus:outline-none focus:bg-white/50 dark:focus:bg-black/20 rounded p-1"
                                             value={target.description}
                                             onChange={(e) => handleUpdateTarget(idx, 'description', e.target.value)}
                                             rows={3}
                                          />

                                          <div className="mt-3 flex items-center">
                                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 ${
                                                  target.type === 'correct' || target.type === 'info'
                                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                              }`}>
                                                  {target.type === 'correct' || target.type === 'info' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                                  {target.type === 'correct' ? 'Correto' : target.type === 'info' ? 'Info' : 'Incorreto'}
                                              </span>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                              
                              {/* Footer Stats */}
                              <div className="grid grid-cols-3 gap-4 pt-6 mt-2 border-t border-gray-100 dark:border-gray-700">
                                 <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tempo Limite</label>
                                    <p className="text-sm font-bold text-gray-800 dark:text-white">{generatedData.targetShooting.timeLimit}</p>
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Níveis</label>
                                    <p className="text-sm font-bold text-gray-800 dark:text-white">{generatedData.targetShooting.levelsCount}</p>
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Dificuldade</label>
                                    <p className="text-sm font-bold text-gray-800 dark:text-white">{generatedData.targetShooting.difficulty}</p>
                                 </div>
                              </div>
                          </div>
                       </SectionCard>
                    ) 
                    /* MECÂNICA GENÉRICA (ROLETA, ETC) */
                    : generatedData.gameRules && (
                      <SectionCard number={5} icon={<Dices size={18} />} title="SISTEMA DE REGRAS">
                        <div className="space-y-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3">
                                 <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg text-indigo-600 dark:text-indigo-300">
                                    <Target size={20} />
                                 </div>
                                 <EditableField 
                                    label="TOTAL DE ELEMENTOS:" 
                                    value={generatedData.gameRules.total_elements}
                                    onChange={(val) => handleUpdateField(['gameRules', 'total_elements'], val)}
                                    transparentBg
                                 />
                              </div>

                              <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                                 <div className="p-2 bg-red-100 dark:bg-red-800 rounded-lg text-red-600 dark:text-red-300">
                                    <AlertTriangle size={20} />
                                 </div>
                                 <EditableField 
                                    label="ELEMENTOS DE PUNIÇÃO/ERRO:" 
                                    value={generatedData.gameRules.penalty_elements}
                                    onChange={(val) => handleUpdateField(['gameRules', 'penalty_elements'], val)}
                                    transparentBg
                                 />
                              </div>

                              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                                 <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-300">
                                    <Puzzle size={20} />
                                 </div>
                                 <EditableField 
                                    label="ELEMENTOS DE DESAFIO/PERGUNTA:" 
                                    value={generatedData.gameRules.challenge_elements}
                                    onChange={(val) => handleUpdateField(['gameRules', 'challenge_elements'], val)}
                                    transparentBg
                                 />
                              </div>

                              <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/30 flex items-start gap-3">
                                 <div className="p-2 bg-green-100 dark:bg-green-800 rounded-lg text-green-600 dark:text-green-300">
                                    <Gift size={20} />
                                 </div>
                                 <EditableField 
                                    label="ELEMENTOS DE BÔNUS/RECOMPENSA:" 
                                    value={generatedData.gameRules.reward_elements}
                                    onChange={(val) => handleUpdateField(['gameRules', 'reward_elements'], val)}
                                    transparentBg
                                 />
                              </div>
                           </div>
                           
                           <EditableField 
                              label="COMO O JOGO FUNCIONA (LOOP):" 
                              value={generatedData.gameRules.gameplay_loop}
                              onChange={(val) => handleUpdateField(['gameRules', 'gameplay_loop'], val)}
                              isTextArea
                           />
                        </div>
                      </SectionCard>
                    )}

                    {/* CARD 6: QUIZ AUTOMÁTICO */}
                    {generatedData.quiz && generatedData.quiz.length > 0 && (
                        <SectionCard number={6} icon={<ListChecks size={18} />} title="AVALIAÇÃO (QUIZ)">
                            <div className="space-y-6">
                                {generatedData.quiz.map((q, idx) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700 print:border-gray-200 break-inside-avoid">
                                        <p className="font-bold text-gray-800 dark:text-white text-base mb-3 print:text-black">
                                            {idx + 1}. {q.question}
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                            {q.options.map((opt, optIdx) => (
                                                <div key={optIdx} className={`text-sm p-3 rounded border flex items-center gap-2 ${optIdx === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 font-medium print:font-bold print:text-black' : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 print:text-gray-800'}`}>
                                                    <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs mr-2">{['A', 'B', 'C', 'D'][optIdx]}</span>
                                                    <span>{opt}</span>
                                                    {optIdx === q.correctAnswer && <Check size={16} className="text-green-600 ml-auto" />}
                                                </div>
                                            ))}
                                        </div>
                                        {q.explanation && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                                                💡 Feedback: {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                  </div>
               </div>

               {/* Footer text for print */}
               <div className="hidden print:block text-center mt-4 text-xs text-gray-500">
                 Gerado por EduCanvas Pro • Documento confidencial para uso pedagógico.
               </div>
            </div>
          ) : (
            <div className="relative z-10 text-center max-w-lg animate-fade-in-up print:hidden">
               {isGenerating ? (
                 <div className="flex flex-col items-center">
                   <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center mb-6 relative">
                      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                      <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30 border-t-transparent animate-spin"></div>
                   </div>
                   <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                     {isEditing ? 'Atualizando seu jogo...' : 'Construindo seu jogo...'}
                   </h2>
                   <p className="text-gray-500">Estamos alinhando o conteúdo à BNCC e criando a narrativa.</p>
                 </div>
               ) : (
                 <>
                  <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/40 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner shadow-indigo-200/50 dark:shadow-indigo-900/20">
                    <Sparkles className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  
                  <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
                    Pronto para criar?
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-8">
                    Preencha as definições à esquerda e clique em <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Gerar Canvas</span>.
                  </p>
                 </>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Subcomponents helper ---

const SectionCard = ({ number, icon, title, children }: { number: number, icon: React.ReactNode, title: string, children?: React.ReactNode }) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 print:shadow-none print:border print:border-gray-300 print:break-inside-avoid print:mb-4">
    <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 print:bg-gray-100 print:border-gray-300">
      <div className="w-8 h-8 rounded-lg bg-[#4f46e5] text-white flex items-center justify-center shadow-sm print:bg-black print:text-white">
        {icon}
      </div>
      <div className="flex items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold print:bg-gray-200 print:text-black">
          {number}
        </span>
        <h2 className="text-base font-bold text-gray-800 dark:text-white uppercase tracking-wide print:text-black">
          {title}
        </h2>
      </div>
    </div>
    <div className="p-6 md:p-8 bg-white dark:bg-gray-800 print:bg-white">
      {children}
    </div>
  </div>
);

// Campo estático para dados não editáveis (como área, ano, BNCC, etc)
const Field = ({ label, value, className = "" }: { label: string, value: string, className?: string }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide print:text-gray-600">
      {label}
    </label>
    <p className={`text-lg text-gray-800 dark:text-gray-200 leading-relaxed print:text-black ${className}`}>
      {value}
    </p>
  </div>
);

// Novo campo editável que alterna entre textarea (tela) e texto estático (print)
const EditableField = ({ 
    label, 
    value, 
    onChange, 
    isTextArea = false,
    height = "h-auto",
    labelColor = "text-gray-500 dark:text-gray-400",
    transparentBg = false
}: { 
    label: string, 
    value: string, 
    onChange: (val: string) => void,
    isTextArea?: boolean,
    height?: string,
    labelColor?: string,
    transparentBg?: boolean
}) => (
    <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1 print:hidden">
            <label className={`text-xs font-bold uppercase tracking-wide ${labelColor}`}>
                {label}
            </label>
            <Pencil size={12} className="text-gray-400" />
        </div>
        {/* Label only for print */}
        <label className={`hidden print:block text-xs font-bold uppercase tracking-wide print:text-gray-600 mb-1`}>
            {label}
        </label>
        
        {/* Modo Impressão: Texto Estático */}
        <p className={`hidden print:block text-base text-black leading-loose whitespace-pre-wrap`}>
            {value}
        </p>

        {/* Modo Tela: Editável */}
        <div className="print:hidden">
            {isTextArea ? (
                <textarea 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full text-lg text-gray-800 dark:text-gray-200 leading-relaxed p-2 rounded-lg border border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none ${height} ${transparentBg ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-gray-700/30'}`}
                    rows={4}
                />
            ) : (
                <input 
                    type="text" 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full text-lg text-gray-800 dark:text-gray-200 leading-relaxed p-2 rounded-lg border border-transparent hover:border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50 dark:bg-gray-700/30"
                />
            )}
        </div>
    </div>
);