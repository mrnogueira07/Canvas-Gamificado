// Componente da Barra Lateral do Gerador
import React, { useMemo, useRef, useState } from 'react';
import type { GeneratorFormData } from '../../types';
import { Upload, Wand2, FileText, X, Lightbulb, RefreshCw, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GeneratorSidebarProps {
    formData: GeneratorFormData;
    setFormData: React.Dispatch<React.SetStateAction<GeneratorFormData>>;
    onGenerate: () => void;
    isGenerating: boolean;
    onPdfChange: (base64: string | null, fileName: string | null) => void;
    pdfFileName: string | null;
    hasPdf: boolean;
    viewOnly?: boolean;
    onRecreate?: () => void;
}

const GAME_TYPES = [
    'Jogo de Plataforma 2D', 'Jogo de Tiro ao Alvo', 'Roleta', 'Memória',
    'Quebra-Cabeça', 'Enigmas Movimento', 'Tabuleiro', 'Arrastar e Soltar',
    'Esmaga Palavras', 'Quiz', 'Jogo da Velha',
];

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
    'Matemática': [
        'Trabalhar frações com situações do dia a dia, como dividir pizzas e receitas.',
        'Explorar geometria através de formas presentes na natureza e arquitetura.',
        'Praticar operações matemáticas com situações de compra e venda.',
    ],
    'Português': [
        'Explorar gêneros textuais: crônicas, poemas e cartas, com foco na produção criativa.',
        'Trabalhar ortografia e gramática de forma lúdica com textos do cotidiano.',
        'Desenvolver interpretação de texto com contos e fábulas clássicas.',
    ],
};

export const GeneratorSidebar: React.FC<GeneratorSidebarProps> = ({
    formData,
    setFormData,
    onGenerate,
    isGenerating,
    onPdfChange,
    pdfFileName,
    hasPdf,
    viewOnly = false,
    onRecreate,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    const subjectsByLevel: Record<string, string[]> = {
        "Ensino Fundamental 1": ["Matemática", "Português", "História", "Geografia", "Ciências", "Artes", "Ensino Religioso"],
        "Ensino Fundamental 2": ["Matemática", "Língua Portuguesa", "História", "Geografia", "Ciências", "Artes", "Ensino Religioso", "Língua inglesa"],
        "Ensino Médio": ["Matemática", "Língua Portuguesa", "História", "Geografia", "Química", "Física", "Biologia", "Artes", "Filosofia", "Sociologia", "Língua inglesa", "Língua Espanhola"]
    };

    const yearsByLevel: Record<string, string[]> = {
        "Ensino Fundamental 1": ["1º Ano", "2º Ano", "3º Ano", "4º Ano", "5º Ano"],
        "Ensino Fundamental 2": ["6º Ano", "7º Ano", "8º Ano", "9º Ano"],
        "Ensino Médio": ["1ª Série", "2ª Série", "3ª Série"]
    };

    const handleChange = (field: keyof GeneratorFormData, value: any) => {
        setFormData((prev) => {
            const updates: Partial<GeneratorFormData> = { [field]: value };
            if (field === 'gradeLevel') { updates.subject = ''; updates.year = ''; }
            if (field === 'gameType' && value === 'Quiz') updates.withQuiz = true;
            return { ...prev, ...updates };
        });
    };

    const currentSubjects = useMemo(() => subjectsByLevel[formData.gradeLevel] || [], [formData.gradeLevel]);
    const currentYears = useMemo(() => yearsByLevel[formData.gradeLevel] || [], [formData.gradeLevel]);

    const handleSuggestContext = () => {
        const suggestions = CONTEXT_SUGGESTIONS[formData.subject] || [
            'Explorar os principais conceitos da matéria de forma lúdica e interativa.',
            'Trabalhar os conteúdos do bimestre com situações do cotidiano dos alunos.',
        ];
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        handleChange('additionalContext', randomSuggestion);
    };

    const processFile = (file: File) => {
        setPdfError(null);
        if (file.type !== 'application/pdf') { setPdfError('Apenas arquivos PDF são aceitos.'); return; }
        if (file.size > 15 * 1024 * 1024) { setPdfError('O PDF deve ter no máximo 15 MB.'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            onPdfChange(base64, file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = '';
    };

    const removePdf = () => { onPdfChange(null, null); setPdfError(null); };

    // VALIDAÇÃO VISUAL: botão só ativa quando todos os campos obrigatórios estão preenchidos
    const hasContext = (formData.additionalContext || '').trim().length > 0;
    const missingFields: string[] = [];
    if (!formData.gradeLevel) missingFields.push('Nível de Ensino');
    if (!formData.subject) missingFields.push('Matéria');
    if (!formData.year) missingFields.push('Ano/Série');
    if (!formData.quarter) missingFields.push('Bimestre');
    if (!formData.gameType) missingFields.push('Tipo de Jogo');
    if (!hasPdf && !hasContext) missingFields.push('Objetivo ou PDF');

    const isFormReady = missingFields.length === 0;

    const inputWrapperClasses = `relative group gradient-border`;
    const innerInputClasses = `w-full p-4 bg-transparent text-slate-800 text-sm font-bold outline-none transition-all disabled:opacity-50 appearance-none`;

    return (
        <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            className="w-[340px] glass-light border-r border-slate-200/50 h-full flex flex-col transition-colors z-[60]"
        >
            <div className="p-8 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                        <Wand2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 tracking-tight">Criação</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Parâmetros do Canvas</p>
                    </div>
                </div>
                {viewOnly && (
                    <div className="mt-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-[10px] text-amber-600 font-black uppercase tracking-wider text-center">Modo Visualização</p>
                    </div>
                )}
            </div>

            <div className="p-8 space-y-8 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {/* Nível de Ensino */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nível de Ensino</label>
                    <div className={inputWrapperClasses}>
                        <select
                            className={innerInputClasses}
                            value={formData.gradeLevel}
                            onChange={(e) => handleChange('gradeLevel', e.target.value)}
                            disabled={isGenerating}
                        >
                            <option value="" disabled className="bg-slate-100">Escolha o nível...</option>
                            <option className="bg-slate-100">Ensino Fundamental 1</option>
                            <option className="bg-slate-100">Ensino Fundamental 2</option>
                            <option className="bg-slate-100">Ensino Médio</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                    </div>
                </div>

                {/* Matéria + Ano + Bimestre */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Matéria / Componente</label>
                        <div className={inputWrapperClasses}>
                            <select
                                className={innerInputClasses}
                                value={formData.subject}
                                onChange={(e) => handleChange('subject', e.target.value)}
                                disabled={!formData.gradeLevel || isGenerating}
                            >
                                <option value="" disabled className="bg-slate-100">{formData.gradeLevel ? "Selecione..." : "Escolha o nível primeiro"}</option>
                                {currentSubjects.map(s => <option key={s} className="bg-slate-100">{s}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ano / Série</label>
                        <div className={inputWrapperClasses}>
                            <select
                                className={innerInputClasses}
                                value={formData.year}
                                onChange={(e) => handleChange('year', e.target.value)}
                                disabled={!formData.gradeLevel || isGenerating}
                            >
                                <option value="" disabled className="bg-slate-100">{formData.gradeLevel ? "Selecione..." : "Escolha o nível primeiro"}</option>
                                {currentYears.map(y => <option key={y} className="bg-slate-100">{y}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Bimestre</label>
                        <div className={inputWrapperClasses}>
                            <select
                                className={innerInputClasses}
                                value={formData.quarter}
                                onChange={(e) => handleChange('quarter', e.target.value)}
                                disabled={isGenerating}
                            >
                                <option value="" disabled className="bg-slate-100">Selecione o bimestre...</option>
                                <option className="bg-slate-100">1º Bimestre</option>
                                <option className="bg-slate-100">2º Bimestre</option>
                                <option className="bg-slate-100">3º Bimestre</option>
                                <option className="bg-slate-100">4º Bimestre</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>
                </div>

                {/* Tipo de Jogo */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">TIPO DE JOGO</label>
                    <div className={inputWrapperClasses}>
                        <select
                            className={innerInputClasses}
                            value={formData.gameType}
                            onChange={(e) => handleChange('gameType', e.target.value)}
                            disabled={isGenerating}
                        >
                            <option value="" disabled className="bg-slate-100">Selecione o tipo de jogo...</option>
                            {GAME_TYPES.map(g => <option key={g} className="bg-slate-100">{g}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                    </div>
                </div>

                {/* Material de Apoio (PDF) */}
                {!viewOnly && (
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center justify-between">
                            Material de Referência
                            {!hasPdf && <span className="text-[9px] font-black text-indigo-500">OPCIONAL (PDF)</span>}
                        </label>

                        <AnimatePresence mode="wait">
                            {pdfFileName ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem]"
                                >
                                    <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-indigo-700 truncate tracking-tight">{pdfFileName}</p>
                                        <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">Análise Ativa</p>
                                    </div>
                                    <button
                                        onClick={() => !isGenerating && removePdf()}
                                        className="p-2 hover:bg-white rounded-full transition-all text-indigo-500 shadow-sm"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); }}
                                    onClick={() => !isGenerating && fileInputRef.current?.click()}
                                    className={`relative group border-2 border-dashed rounded-[2.5rem] p-8 text-center cursor-pointer transition-all duration-300 ${isDragging
                                        ? 'border-indigo-500 bg-indigo-500/10'
                                        : 'border-slate-200 hover:bg-slate-50 hover:border-indigo-500'
                                        }`}
                                >
                                    <Upload className={`w-8 h-8 mx-auto mb-4 transition-all duration-300 ${isDragging ? 'text-indigo-500 scale-110' : 'text-slate-300 group-hover:text-indigo-400 group-hover:scale-110'}`} />
                                    <p className="text-[11px] text-slate-600 font-bold leading-tight">Arraste um PDF aqui ou clique para buscar</p>
                                    <p className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest">PDF • 15MB MAX</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {pdfError && <p className="text-[10px] text-rose-500 font-black text-center mt-2 px-4 leading-tight">{pdfError}</p>}
                        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileInput} />
                    </div>
                )}

                {/* Ideia / Contexto */}
                {!viewOnly && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Objetivo / Contexto</label>
                            <button
                                type="button"
                                onClick={() => !isGenerating && handleSuggestContext()}
                                className="flex items-center gap-1.5 text-[9px] font-black text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                            >
                                <Lightbulb className="w-3 h-3" /> Sugerir
                            </button>
                        </div>
                        <div className={inputWrapperClasses}>
                            <textarea
                                className={`${innerInputClasses} h-36 resize-none p-5 leading-relaxed font-medium bg-transparent`}
                                placeholder={pdfFileName ? "Deseja adicionar instruções extras?" : "Ex: Ensinar frações usando música..."}
                                value={formData.additionalContext}
                                disabled={viewOnly || isGenerating}
                                onChange={(e) => handleChange('additionalContext', e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-8 pb-10 border-t border-indigo-100/50 bg-white/80 backdrop-blur-xl shadow-[0_-20px_50px_rgba(79,70,229,0.05)] rounded-t-[2.5rem]">
                {/* Informação sobre campos faltando */}
                {!viewOnly && !isFormReady && (
                    <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200/60 rounded-2xl">
                        <p className="text-[9px] text-amber-600 font-black uppercase tracking-wider text-center leading-relaxed">
                            Preencha: {missingFields.join(' • ')}
                        </p>
                    </div>
                )}
                <button
                    onClick={viewOnly ? onRecreate : onGenerate}
                    disabled={isGenerating || (!viewOnly && !isFormReady)}
                    title={!viewOnly && !isFormReady ? `Faltam: ${missingFields.join(', ')}` : ''}
                    className={`group relative w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all duration-500 shadow-2xl active:scale-95 ${isGenerating
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                            : (!viewOnly && !isFormReady)
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                : viewOnly
                                    ? 'bg-slate-900 text-white shadow-slate-900/10 hover:shadow-slate-900/20 cursor-pointer'
                                    : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-indigo-600/30 hover:scale-[1.02] cursor-pointer'
                        }`}
                >
                    {isGenerating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        viewOnly ? <RefreshCw className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />
                    )}
                    {isGenerating ? 'Processando IA...' : viewOnly ? 'Recriar Planejamento' : 'Gerar Planejamento'}
                </button>
            </div>
        </motion.div>
    );
};
