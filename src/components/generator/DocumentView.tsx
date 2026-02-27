import React, { useCallback, useEffect, useRef, useState, Component } from 'react';
import type { GeneratedContent } from '../../types';
import {
    BookOpen, Gamepad2, ScrollText, Library, PencilLine, Zap,
    Clock, Layers, BarChart2, CheckCircle2, XCircle, Trophy, Lightbulb, Move, AlertTriangle, RefreshCw,
} from 'lucide-react';

// ─── Error Boundary: Impede tela branca em caso de crash no DocumentView ───
class DocumentViewErrorBoundary extends Component<
    { children: React.ReactNode },
    { hasError: boolean; errorMessage: string }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, errorMessage: error?.message || 'Erro desconhecido' };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('DocumentView Error:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 p-12">
                    <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-rose-500" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-black text-slate-800 mb-2">Erro ao renderizar o canvas</h3>
                        <p className="text-sm text-slate-500 mb-1">Ocorreu um erro inesperado ao exibir o conteúdo gerado.</p>
                        <p className="text-xs font-mono text-rose-400 bg-rose-50 px-3 py-1.5 rounded-lg mt-2">{this.state.errorMessage}</p>
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 cursor-pointer"
                    >
                        <RefreshCw className="w-4 h-4" /> Tentar novamente
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export { DocumentViewErrorBoundary };
// ─── GameTypeIllustration ─────────────────────────────────────────────────
interface GameIllustrationConfig {
    gradient: string;
    label: string;
    svg: React.ReactNode;
}

const GAME_ILLUSTRATIONS: Record<string, GameIllustrationConfig> = {
    'Jogo de Plataforma 2D': {
        gradient: 'from-violet-100 to-indigo-200',
        label: 'Plataforma 2D',
        svg: (
            <svg viewBox="0 0 200 90" className="w-full h-full" fill="none">
                <rect x="10" y="70" width="50" height="8" rx="4" fill="rgba(79, 70, 229, 0.1)" />
                <rect x="80" y="52" width="50" height="8" rx="4" fill="rgba(79, 70, 229, 0.1)" />
                <rect x="150" y="35" width="40" height="8" rx="4" fill="rgba(79, 70, 229, 0.1)" />
                <rect x="28" y="56" width="14" height="14" rx="3" fill="#6366f1" opacity="0.4" />
                <circle cx="35" cy="50" r="7" fill="#6366f1" opacity="0.4" />
                <circle cx="98" cy="42" r="5" fill="#facc15" opacity="0.5" />
                <rect x="158" y="21" width="14" height="14" rx="2" fill="#f87171" opacity="0.4" />
            </svg>
        ),
    },
    'Jogo de Tiro ao Alvo': {
        gradient: 'from-rose-100 to-orange-100',
        label: 'Tiro ao Alvo',
        svg: (
            <svg viewBox="0 0 200 90" className="w-full h-full" fill="none">
                <circle cx="100" cy="45" r="38" fill="rgba(244, 63, 94, 0.05)" stroke="#f43f5e" strokeWidth="2" opacity="0.2" />
                <circle cx="100" cy="45" r="26" fill="rgba(244, 63, 94, 0.05)" stroke="#f43f5e" strokeWidth="2" opacity="0.3" />
                <circle cx="100" cy="45" r="5" fill="#f43f5e" opacity="0.3" />
            </svg>
        ),
    },
    'Roleta': {
        gradient: 'from-amber-100 to-yellow-100',
        label: 'Roleta',
        svg: (
            <svg viewBox="0 0 200 90" className="w-full h-full" fill="none">
                <circle cx="100" cy="45" r="38" fill="rgba(217, 119, 6, 0.05)" stroke="#d97706" strokeWidth="2" opacity="0.2" />
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                    const angle = (i * 45) * Math.PI / 180;
                    return <line key={i} x1="100" y1="45" x2={100 + 38 * Math.cos(angle)} y2={45 + 38 * Math.sin(angle)} stroke="#d97706" strokeWidth="1" opacity="0.1" />;
                })}
            </svg>
        ),
    },
    'Quiz': {
        gradient: 'from-sky-100 to-blue-200',
        label: 'Quiz',
        svg: (
            <svg viewBox="0 0 200 90" className="w-full h-full" fill="none">
                <rect x="15" y="10" width="170" height="28" rx="4" fill="rgba(30, 64, 175, 0.05)" stroke="#1e40af" strokeWidth="1" opacity="0.2" />
                <rect x="15" y="46" width="80" height="18" rx="4" fill="rgba(16, 185, 129, 0.1)" stroke="#10b981" strokeWidth="1" opacity="0.3" />
                <rect x="105" y="46" width="80" height="18" rx="4" fill="rgba(244, 63, 94, 0.1)" stroke="#f43f5e" strokeWidth="1" opacity="0.3" />
            </svg>
        ),
    },
    'Esmaga Palavras': {
        gradient: 'from-blue-100 to-indigo-100',
        label: 'Esmaga Palavras',
        svg: (
            <svg viewBox="0 0 200 90" className="w-full h-full" fill="none">
                <rect x="20" y="20" width="30" height="30" rx="4" fill="#6366f1" opacity="0.1" />
                <rect x="60" y="30" width="30" height="30" rx="4" fill="#6366f1" opacity="0.15" />
                <rect x="100" y="20" width="30" height="30" rx="4" fill="#6366f1" opacity="0.1" />
                <rect x="140" y="40" width="30" height="30" rx="4" fill="#6366f1" opacity="0.2" />
            </svg>
        ),
    },
};

/**
 * Utilitário de segurança para garantir que NUNCA passamos um objeto (como o SyntheticEvent) como filho do React.
 * Se o valor for um objeto, ele será convertido em string vazia para evitar o erro #31.
 */
const toStr = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(toStr).join(', ');
    try { return JSON.stringify(v); } catch { return ''; }
};
const toStrArr = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(toStr);
    if (typeof v === 'string') return v.split('\n').filter(Boolean);
    return [];
};
const safeString = toStr; // Alias para manter compatibilidade

/**
 * Componente que exibe a ilustração do topo do card de lógica baseada no tipo de jogo.
 */
const GameTypeIllustration: React.FC<{ gameType: string }> = ({ gameType }) => {
    // Sanitizamos o gameType para garantir que é uma string
    const safeType = safeString(gameType);
    const config = GAME_ILLUSTRATIONS[safeType];
    const gradient = config?.gradient || 'from-sky-50 to-indigo-50';
    const label = config?.label || safeType;
    const svgContent = config?.svg;

    return (
        <div className={`relative overflow-hidden rounded-t-xl bg-gradient-to-r ${gradient} mb-0`} style={{ height: 70 }}>
            <div className="absolute inset-0 opacity-40">{svgContent}</div>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 flex items-center gap-2">
                {/* Blindagem de segurança: usamos safeString para renderizar o label */}
                <span className="text-slate-700 font-black text-lg drop-shadow-sm">{safeString(label)}</span>
                <span className="text-[9px] bg-white/40 border border-white/60 text-slate-600 rounded-lg px-2 py-0.5 font-black uppercase tracking-widest backdrop-blur-md">Mecânica do Jogo</span>
            </div>
        </div>
    );
};

interface DocumentViewProps {
    content: GeneratedContent;
    title: string;
    gameType?: string;
    onEdit: (section: keyof GeneratedContent, field: string, value: any) => void;
    onAdd: (section: keyof GeneratedContent, path: string, item: any) => void;
    onRemove: (section: keyof GeneratedContent, path: string, index: number) => void;
}

export const DocumentView: React.FC<DocumentViewProps> = ({ content, title: projectTitle, gameType: propGameType, onEdit, onAdd, onRemove }) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');

    const startEditTitle = () => {
        setTitleDraft(projectTitle);
        setIsEditingTitle(true);
    };

    const confirmEditTitle = () => {
        onEdit('curriculumRelation' as any, '_projectTitle', titleDraft);
        setIsEditingTitle(false);
    };

    const cancelEditTitle = () => setIsEditingTitle(false);

    return (
        <div className="w-full mx-auto max-w-4xl space-y-8 p-6 md:p-12 text-slate-800" id="document-view">
            {/* Header / Banner Principal */}
            {/* Header / Banner Principal (Caixa de Teto) - Compacto */}
            <div className="relative group mb-8 overflow-hidden rounded-[2rem] bg-[#0f172a] p-10 text-center shadow-[0_15px_40px_rgba(0,0,0,0.2)] border border-slate-700/50">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/hexellence.png')] opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-blue-900/10 opacity-60" />
                <div className="relative z-10">
                    <div className="flex justify-center mb-6">
                        <span className="px-4 py-1.5 bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 rounded-full text-indigo-400 font-black text-[9px] uppercase tracking-[0.4em] shadow-inner">Plano de Aula Gamificado</span>
                    </div>

                    {isEditingTitle ? (
                        <div className="flex flex-col items-center gap-6">
                            <textarea
                                autoFocus
                                className="w-full bg-slate-800/50 text-white text-2xl md:text-4xl font-black uppercase text-center outline-none border-2 border-indigo-500 rounded-3xl resize-none py-4 leading-tight tracking-tight px-8 shadow-2xl"
                                value={titleDraft}
                                onChange={e => setTitleDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEditTitle(); } }}
                                rows={2}
                            />
                            <div className="flex gap-3">
                                <button onClick={confirmEditTitle} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer">SALVAR</button>
                                <button onClick={cancelEditTitle} className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 cursor-pointer">DESCARTAR</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={startEditTitle} className="w-full group/btn relative flex flex-col items-center">
                            <h1 className="text-3xl md:text-5xl font-black text-white uppercase leading-tight tracking-tight transition-all group-hover/btn:scale-[1.01] drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)] max-w-2xl">
                                {projectTitle || "DEFINIR TÍTULO"}
                            </h1>
                            <div className="mt-4 flex items-center justify-center gap-3 text-indigo-400 opacity-0 group-hover/btn:opacity-100 transition-all transform translate-y-2 group-hover/btn:translate-y-0">
                                <PencilLine className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">Editar Título</span>
                            </div>
                        </button>
                    )}

                    <div className="mt-10 flex flex-col items-center gap-1.5">
                        <p className="text-slate-200 font-black text-xs uppercase tracking-[0.4em] drop-shadow-md">
                            {content.curriculumRelation.subject}
                        </p>
                        <div className="flex items-center gap-3 text-indigo-300/60 font-bold text-[9px] uppercase tracking-[0.3em]">
                            {/* Dividimos o ano/bimestre em duas partes com proteção extra */}
                            <span>{toStr(content.curriculumRelation.yearAndQuarter).split(' - ')[0] || ''}</span>
                            <div className="w-1 h-1 rounded-full bg-indigo-500/30" />
                            <span>{toStr(content.curriculumRelation.yearAndQuarter).split(' - ')[1] || ''}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seções do Canvas */}
            <div className="grid grid-cols-1 gap-8">
                {/* 1. Currículo */}
                <SectionCard number="1" title="Relação com o Currículo" icon={<BookOpen className="w-5 h-5 text-indigo-400" />} headerColor="bg-indigo-50/50 border-indigo-100/50">
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Field label="ÁREA DO CONHECIMENTO" value={content.curriculumRelation.area} onChange={(val: string) => onEdit('curriculumRelation', 'area', val)} />
                            <Field label="ANO / BIMESTRE" value={content.curriculumRelation.yearAndQuarter} onChange={(val: string) => onEdit('curriculumRelation', 'yearAndQuarter', val)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Field label="TEMA" value={content.curriculumRelation.theme} onChange={(val: string) => onEdit('curriculumRelation', 'theme', val)} />
                            <Field label="HABILIDADE BNCC" value={content.curriculumRelation.bnccSkills} onChange={(val: string) => onEdit('curriculumRelation', 'bnccSkills', val)} />
                        </div>
                        <Field label="DESCRIÇÃO DA HABILIDADE" value={content.curriculumRelation.skillsDescription} onChange={(val: string) => onEdit('curriculumRelation', 'skillsDescription', val)} />
                    </div>
                </SectionCard>

                {/* 2 & 3. Estilo e Narrativa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SectionCard number="2" title="Estilo do Jogo" icon={<Gamepad2 className="w-5 h-5 text-purple-400" />} headerColor="bg-purple-50/50 border-purple-100/50">
                        <div className="space-y-6">
                            <Field label="TIPO DE JOGO" value={propGameType || content.gameStyle.genre} onChange={() => { }} readonly />
                            <Field label="PÚBLICO" value={content.gameStyle.targetAudience} onChange={() => { }} readonly />
                            <Field label="NARRATIVA CURTA" value={content.gameStyle.narrative} onChange={(val) => onEdit('gameStyle', 'narrative', val)} />
                        </div>
                    </SectionCard>

                    <SectionCard number="3" title="Fluxo do Jogo" icon={<ScrollText className="w-5 h-5 text-blue-600" />} headerColor="bg-blue-50 border-blue-100">
                        <div className="space-y-6">
                            <Field label="FLUXO DO JOGO" value={content.gamePlot?.synopsis} onChange={(val) => onEdit('gamePlot', 'synopsis', val)} />
                            <Field label="CHEFES E INIMIGOS / OBSTÁCULOS" value={content.gamePlot?.characters} onChange={(val) => onEdit('gamePlot', 'characters', val)} />
                        </div>
                    </SectionCard>
                </div>

                {/* 4. Conteúdo */}
                <SectionCard number="4" title="Conteúdo Programático" icon={<Library className="w-5 h-5 text-emerald-400" />} headerColor="bg-emerald-50/50 border-emerald-100/50">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50 mb-6">
                        <Field
                            label="INTRODUÇÃO"
                            value={toStr(content.programmaticContent?.intro).replace(/^\s*GUIA DE IMPLEMENTAÇÃO PARA O DESENVOLVEDOR:?\s*/i, '').trim()}
                            onChange={(val) => onEdit('programmaticContent', 'intro', val)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Field label="CONDIÇÃO DE VITÓRIA" value={content.programmaticContent?.winCondition} onChange={(val) => onEdit('programmaticContent', 'winCondition', val)} />
                        <Field label="CONDIÇÃO DE DERROTA" value={content.programmaticContent?.loseCondition} onChange={(val) => onEdit('programmaticContent', 'loseCondition', val)} />
                    </div>
                </SectionCard>

                {/* 5. Lógica */}
                {content.gameLogic && (
                    <GameLogicSection
                        gameLogic={content.gameLogic}
                        gameType={content.gameStyle.genre}
                        onEdit={(f: string, v: any) => onEdit('gameLogic', f, v)}
                        onAdd={(path: string, item: any) => onAdd('gameLogic', path, item)}
                        onRemove={(path: string, index: number) => onRemove('gameLogic', path, index)}
                    />
                )}

                {/* Extra: Quiz */}
                {content.quiz && (
                    <QuizSection
                        quiz={content.quiz}
                        onEdit={(f: string, v: any) => onEdit('quiz', f, v)}
                        onAdd={(path: string, item: any) => onAdd('quiz', path, item)}
                        onRemove={(path: string, index: number) => onRemove('quiz', path, index)}
                    />
                )}

                {/* Extra: Drag & Drop Canvas */}
                {(() => {
                    const gt = String(propGameType || content.gameStyle?.genre || '');
                    return gt.toLowerCase().includes('arrastar') ? <DragAndDropCanvas /> : null;
                })()}
            </div>

            {/* Referências */}
            <div className="pt-12 border-t border-slate-200 mt-12 pb-12">
                <Field label="REFERÊNCIA BIBLIOGRÁFICA" value={content.curriculumRelation.bibliography} onChange={(val) => onEdit('curriculumRelation', 'bibliography', val)} />
            </div>
        </div>
    );
};

const SectionCard: React.FC<{
    number: string; title: string; icon: React.ReactNode;
    headerColor: string; children: React.ReactNode;
}> = ({ number, title, icon, headerColor, children }) => (
    <div className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden transition-all hover:shadow-[0_10px_30px_rgb(0,0,0,0.04)]">
        <div className={`px-8 py-4 flex items-center gap-4 border-b border-slate-50 ${headerColor}`}>
            <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">{icon}</div>
            <div className="flex items-baseline gap-2">
                <span className="text-slate-200 font-black text-lg">{number}</span>
                <span className="text-slate-600 font-black uppercase tracking-widest text-[10px]">{title}</span>
            </div>
        </div>
        <div className="p-8 md:p-10">{children}</div>
    </div>
);

const GameLogicSection: React.FC<{
    gameLogic: GeneratedContent['gameLogic'];
    gameType: string;
    onEdit: (field: string, value: any) => void;
    onAdd: (path: string, item: any) => void;
    onRemove: (path: string, index: number) => void;
}> = ({ gameLogic, gameType, onEdit, onAdd, onRemove }) => {
    const { howToPlay, timeLimit, levels, difficulty, targets = [] } = gameLogic;

    const handleAddTarget = () => {
        const newTarget = {
            title: gameType === 'Roleta' ? 'PERGUNTA' : 'Novo Alvo',
            description: '',
            options: gameType === 'Roleta' ? ['Opção A', 'Opção B', 'Opção C', 'Opção D'] : undefined,
            answer: gameType === 'Roleta' ? 'Opção A' : undefined,
            isCorrect: true,
            points: 15,
            feedback: ''
        };
        onAdd('targets', newTarget);
    };

    const toggleTargetType = (index: number) => {
        const target = targets[index];
        const targetTitle = (target.title || '').toUpperCase();
        if (target.isCorrect && (targetTitle === 'DICA' || targetTitle === 'INFORMAÇÃO')) {
            onEdit(`targets[${index}].isCorrect`, false);
            onEdit(`targets[${index}].title`, 'PENALIDADE');
            onEdit(`targets[${index}].description`, 'O que o jogador perde');
            onEdit(`targets[${index}].points`, -20);
            onEdit(`targets[${index}].options`, []);
            onEdit(`targets[${index}].answer`, '');
        } else if (!target.isCorrect) {
            onEdit(`targets[${index}].isCorrect`, true);
            onEdit(`targets[${index}].title`, 'PERGUNTA');
            onEdit(`targets[${index}].description`, '');
            onEdit(`targets[${index}].options`, ['Opção A', 'Opção B', 'Opção C', 'Opção D']);
            onEdit(`targets[${index}].answer`, 'Opção A');
            onEdit(`targets[${index}].points`, 15);
        } else {
            onEdit(`targets[${index}].title`, 'DICA');
            onEdit(`targets[${index}].description`, 'Sua dica informativa aqui');
            onEdit(`targets[${index}].options`, []);
            onEdit(`targets[${index}].answer`, '');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden transition-all hover:shadow-[0_10px_30px_rgb(0,0,0,0.04)]">
            <GameTypeIllustration gameType={gameType} />
            <div className="px-8 py-5 flex items-center justify-between border-b bg-orange-50/50 border-orange-100/50">
                <div className="flex items-center gap-4">
                    <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50"><Zap className="w-5 h-5 text-orange-400" /></div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-orange-200 font-black text-lg">5</span>
                        <span className="text-slate-700 font-black uppercase tracking-widest text-[11px]">Lógica do Jogo</span>
                    </div>
                </div>
                {gameType === 'Roleta' && (
                    <button
                        onClick={handleAddTarget}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                        <span>+ Adicionar Casa</span>
                    </button>
                )}
            </div>
            <div className="p-8 md:p-10 space-y-10">
                <Field label="REGRAS E MECÂNICA" value={howToPlay} onChange={(val: string) => onEdit('howToPlay', val)} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {targets.map((target, i) => {
                        const targetTitleLabel = (target.title || '').toUpperCase();
                        const isRoletaTip = gameType === 'Roleta' && (targetTitleLabel === 'DICA' || targetTitleLabel === 'INFORMAÇÃO');
                        const isRoletaQuiz = gameType === 'Roleta' && target.isCorrect && !isRoletaTip;

                        return (
                            <div key={i} className={`group/card p-6 rounded-[2.5rem] border transition-all duration-300 ${target.isCorrect
                                ? isRoletaTip ? 'bg-amber-50/20 border-amber-100/50 shadow-sm shadow-amber-500/5' : 'bg-emerald-50/20 border-emerald-100/50'
                                : 'bg-rose-50 border-rose-100 shadow-sm shadow-rose-500/5'
                                } hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200/50`}>

                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => gameType === 'Roleta' && toggleTargetType(i)}
                                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all ${target.isCorrect
                                                ? isRoletaTip ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600 shadow-sm shadow-emerald-500/10'
                                                : 'bg-rose-100 text-rose-500'
                                                } ${gameType === 'Roleta' ? 'hover:scale-110 hover:shadow-md cursor-pointer active:scale-95' : ''}`}
                                            title="Trocar tipo (Quiz / Dica / Penalidade)"
                                        >
                                            {target.isCorrect ? (isRoletaTip ? <Lightbulb className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />) : <XCircle className="w-5 h-5" />}
                                        </button>
                                        <div className="bg-white/60 px-3 py-1 rounded-full border border-white/80 shadow-sm">
                                            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                                                {target.isCorrect ? (isRoletaTip ? "Informação" : "Quiz") : "Penalidade"}
                                            </span>
                                        </div>
                                    </div>
                                    {gameType === 'Roleta' && (
                                        <button
                                            onClick={() => onRemove('targets', i)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover/card:opacity-100"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white/40 p-4 rounded-3xl border border-white/60 focus-within:bg-white focus-within:shadow-xl transition-all">
                                        <Field
                                            label={target.isCorrect ? (isRoletaTip ? "CONTEÚDO DA DICA" : "ENUNCIADO DA PERGUNTA") : "DESCRITIVO DA PENALIDADE"}
                                            value={target.title}
                                            onChange={(val: string) => onEdit(`targets[${i}].title`, val)}
                                        />
                                    </div>

                                    {isRoletaQuiz ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <p className="text-[10px] font-black text-slate-400/80 uppercase tracking-widest leading-none">Alternativas</p>
                                                <span className="text-[9px] text-indigo-400 font-bold uppercase italic">Clique para marcar a correta</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2.5">
                                                {(() => {
                                                    const rawDesc = toStr(target.description || target.feedback || '');
                                                    const opts = (target.options && Array.isArray(target.options) && target.options.length > 0)
                                                        ? target.options
                                                        : rawDesc.split(/\n|\d\)|[a-d]\)/).filter(t => t.trim()).map(t => t.trim());

                                                    const finalOpts = (opts.length > 0 ? opts : ['Opção A', 'Opção B', 'Opção C', 'Opção D']).slice(0, 4);

                                                    return finalOpts.map((alt, altIdx) => {
                                                        const isCorrectAlt = alt === target.answer || (target.answer === undefined && altIdx === 0);
                                                        return (
                                                            <div
                                                                key={altIdx}
                                                                onClick={(e) => {
                                                                    if ((e.target as HTMLElement).isContentEditable) return;
                                                                    onEdit(`targets[${i}].answer`, alt);
                                                                }}
                                                                className={`group/alt relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${isCorrectAlt
                                                                    ? 'bg-emerald-500/[0.03] border-emerald-400 shadow-sm'
                                                                    : 'bg-white/40 border-slate-100/80 hover:border-indigo-200 hover:bg-white'
                                                                    }`}
                                                            >
                                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 transition-all ${isCorrectAlt ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-400'
                                                                    }`}>
                                                                    {altIdx + 1}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <Field
                                                                        label=""
                                                                        value={alt}
                                                                        onChange={(val: string) => {
                                                                            const currentOpts = (target.options && Array.isArray(target.options) && target.options.length > 0)
                                                                                ? [...target.options]
                                                                                : rawDesc.split(/\n|\d\)|[a-d]\)/).filter(t => t.trim()).map(t => t.trim());

                                                                            if (currentOpts.length === 0) currentOpts.push('Opção A', 'Opção B', 'Opção C', 'Opção D');
                                                                            if (currentOpts.length > 4) currentOpts.length = 4;

                                                                            const wasCorrect = alt === target.answer;
                                                                            currentOpts[altIdx] = val;

                                                                            onEdit(`targets[${i}].options`, currentOpts);
                                                                            if (wasCorrect) onEdit(`targets[${i}].answer`, val);
                                                                            if (!target.options) onEdit(`targets[${i}].description`, '');
                                                                        }}
                                                                    />
                                                                </div>
                                                                {isCorrectAlt ? (
                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                                ) : (
                                                                    <PencilLine className="w-4 h-4 text-slate-200 opacity-0 group-hover/alt:opacity-100 transition-opacity shrink-0" />
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white/20 p-4 rounded-3xl border border-white/40 focus-within:bg-white transition-all">
                                            <Field
                                                label={gameType === 'Esmaga Palavras' ? 'PALAVRA-CHAVE' : 'DESCRIÇÃO / FEEDBACK'}
                                                value={target.description || target.feedback || (gameType === 'Esmaga Palavras' ? target.title : '')}
                                                onChange={(val: string) => onEdit(`targets[${i}].description`, val)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-slate-100">
                    <SummaryItem icon={<Clock className="w-4 h-4 text-slate-400" />} label="Tempo Sugerido" value={timeLimit} onChange={(val: string) => onEdit('timeLimit', val)} />
                    <SummaryItem icon={<Layers className="w-4 h-4 text-slate-400" />} label="Total de Fases" value={levels} onChange={(val: string) => onEdit('levels', val)} />
                    <SummaryItem icon={<BarChart2 className="w-4 h-4 text-slate-400" />} label="Dificuldade" value={difficulty} onChange={(val: string) => onEdit('difficulty', val)} />
                </div>
            </div>
        </div>
    );
};

// ─── DragAndDropCanvas ────────────────────────────────────────────────────────
interface Shape {
    id: string;
    type: 'square' | 'circle' | 'triangle' | 'hexagon' | 'trapezoid';
    x: number;
    y: number;
    size: number;
    color: string;
    label: string;
}

const INITIAL_SHAPES: Shape[] = [
    { id: 'sq', type: 'square', x: 60, y: 60, size: 70, color: '#6366f1', label: 'Quadrado' },
    { id: 'ci', type: 'circle', x: 220, y: 70, size: 70, color: '#f43f5e', label: 'Círculo' },
    { id: 'tr', type: 'triangle', x: 370, y: 55, size: 80, color: '#10b981', label: 'Triângulo' },
    { id: 'hx', type: 'hexagon', x: 520, y: 60, size: 70, color: '#f59e0b', label: 'Hexágono' },
    { id: 'tp', type: 'trapezoid', x: 670, y: 70, size: 75, color: '#8b5cf6', label: 'Trapézio' },
];

// Polyfill para roundRect (não disponível em todos os browsers)
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, isActive: boolean) {
    const { type, x, y, size, color } = shape;
    ctx.save();
    ctx.shadowColor = isActive ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = isActive ? 24 : 10;
    ctx.shadowOffsetY = isActive ? 8 : 3;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;

    const halfSize = size / 2;

    ctx.beginPath();
    if (type === 'square') {
        drawRoundedRect(ctx, x - halfSize, y - halfSize, size, size, 14);
    } else if (type === 'circle') {
        ctx.arc(x, y, halfSize, 0, Math.PI * 2);
    } else if (type === 'triangle') {
        ctx.moveTo(x, y - halfSize);
        ctx.lineTo(x + halfSize, y + halfSize);
        ctx.lineTo(x - halfSize, y + halfSize);
        ctx.closePath();
    } else if (type === 'hexagon') {
        for (let k = 0; k < 6; k++) {
            const angle = (Math.PI / 3) * k - Math.PI / 6;
            const px = x + halfSize * Math.cos(angle);
            const py = y + halfSize * Math.sin(angle);
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
    } else if (type === 'trapezoid') {
        const top = size * 0.55;
        ctx.moveTo(x - top / 2, y - halfSize * 0.7);
        ctx.lineTo(x + top / 2, y - halfSize * 0.7);
        ctx.lineTo(x + halfSize, y + halfSize * 0.7);
        ctx.lineTo(x - halfSize, y + halfSize * 0.7);
        ctx.closePath();
    }

    ctx.fill();
    ctx.stroke();

    // Label
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `bold ${Math.round(size * 0.17)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shape.label, x, type === 'triangle' ? y + halfSize * 0.25 : y);

    ctx.restore();
}

function hitTest(shape: Shape, mx: number, my: number): boolean {
    const { type, x, y, size } = shape;
    const halfSize = size / 2;
    if (type === 'circle') {
        return Math.hypot(mx - x, my - y) <= halfSize;
    }
    // AABB for all others
    return mx >= x - halfSize && mx <= x + halfSize && my >= y - halfSize && my <= y + halfSize;
}

const DragAndDropCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [shapes, setShapes] = useState<Shape[]>(INITIAL_SHAPES);
    const shapesRef = useRef<Shape[]>(INITIAL_SHAPES);
    const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

    // Keep ref in sync
    useEffect(() => { shapesRef.current = shapes; }, [shapes]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 20);
        ctx.fill();

        // Grid
        ctx.strokeStyle = 'rgba(148,163,184,0.15)';
        ctx.lineWidth = 1;
        for (let gx = 40; gx < canvas.width; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
        }
        for (let gy = 40; gy < canvas.height; gy += 40) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
        }

        // Draw non-active shapes first, then active on top
        const activeId = dragRef.current?.id;
        shapesRef.current
            .filter(s => s.id !== activeId)
            .forEach(s => drawShape(ctx, s, false));
        if (activeId) {
            const active = shapesRef.current.find(s => s.id === activeId);
            if (active) drawShape(ctx, active, true);
        }
    }, []);

    useEffect(() => { draw(); }, [shapes, draw]);

    const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onDown = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            const { x, y } = getPos(e, canvas);
            // Hit test from top (last in array = topmost visually)
            const hit = [...shapesRef.current].reverse().find(s => hitTest(s, x, y));
            if (!hit) return;
            dragRef.current = { id: hit.id, offsetX: x - hit.x, offsetY: y - hit.y };
            // Bring to top
            setShapes(prev => {
                const rest = prev.filter(s => s.id !== hit.id);
                const found = prev.find(s => s.id === hit.id)!;
                return [...rest, found];
            });
        };

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!dragRef.current) return;
            e.preventDefault();
            const { x, y } = getPos(e, canvas);
            const { id, offsetX, offsetY } = dragRef.current;
            setShapes(prev => prev.map(s => s.id === id
                ? { ...s, x: x - offsetX, y: y - offsetY }
                : s
            ));
        };

        const onUp = () => { dragRef.current = null; draw(); };

        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);

        return () => {
            canvas.removeEventListener('mousedown', onDown);
            canvas.removeEventListener('touchstart', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchend', onUp);
        };
    }, [draw]);

    const handleReset = () => {
        setShapes(INITIAL_SHAPES);
        shapesRef.current = INITIAL_SHAPES;
    };

    // Export canvas as PNG dataURL for PDF printing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        (canvas as any).__getExportDataURL = () => canvas.toDataURL('image/png');
    });

    return (
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden" id="drag-drop-canvas-section">
            <div className="px-8 py-5 flex items-center justify-between border-b bg-violet-50/50 border-violet-100/50">
                <div className="flex items-center gap-4">
                    <div className="bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
                        <Move className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-violet-200 font-black text-lg">6</span>
                        <span className="text-slate-700 font-black uppercase tracking-widest text-[11px]">Canvas Drag &amp; Drop</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Arraste as formas livremente</span>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-violet-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-600 transition-all active:scale-95 cursor-pointer"
                    >
                        Resetar
                    </button>
                </div>
            </div>
            <div className="p-8">
                <div className="flex gap-3 mb-4">
                    {INITIAL_SHAPES.map(s => (
                        <div key={s.id} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full inline-block" style={{ background: s.color }} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                        </div>
                    ))}
                </div>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={320}
                    className="w-full rounded-2xl border border-slate-100 cursor-grab active:cursor-grabbing"
                    style={{ touchAction: 'none' }}
                />
                <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest text-center mt-4">
                    Clique e arraste qualquer forma para reposicioná-la
                </p>
            </div>
        </div>
    );
};

const QuizSection: React.FC<{
    quiz: any;
    onEdit: (field: string, value: any) => void;
    onAdd: (path: string, item: any) => void;
    onRemove: (path: string, index: number) => void;
}> = ({ quiz, onEdit, onAdd, onRemove }) => {
    const handleAddQuestion = () => {
        onAdd('questions', {
            question: 'Nova pergunta?',
            options: ['Opção A', 'Opção B', 'Opção C', 'Opção D'],
            answer: 'Opção A'
        });
    };

    return (
        <SectionCard
            number="+"
            title="Quiz Complementar"
            icon={<Trophy className="w-5 h-5 text-yellow-500" />}
            headerColor="bg-yellow-50 border-yellow-100"
        >
            <div className="space-y-8">
                <div className="flex justify-end pr-2">
                    <button
                        onClick={handleAddQuestion}
                        className="px-6 py-2.5 bg-yellow-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-600 transition-all shadow-lg shadow-yellow-500/20 active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                        <span>+ Adicionar Pergunta</span>
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-8">
                    {quiz.questions.map((q: any, i: number) => (
                        <div key={i} className="group/quiz p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100/80 space-y-6 relative hover:bg-white hover:shadow-xl hover:shadow-indigo-500/[0.03] transition-all">
                            <button
                                onClick={() => onRemove('questions', i)}
                                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover/quiz:opacity-100"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-5">
                                <div className="w-10 h-10 flex items-center justify-center bg-yellow-500 text-white rounded-2xl text-[13px] font-black shadow-lg shadow-yellow-500/20 shrink-0">{i + 1}</div>
                                <div className="flex-1">
                                    <Field label="ENUNCIADO" value={q.question} onChange={(val) => onEdit(`questions[${i}].question`, val)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-14">
                                {(Array.isArray(q.options) ? q.options : []).map((opt: string, optIdx: number) => (
                                    <div
                                        key={optIdx}
                                        className={`p-1.5 rounded-2xl border transition-all cursor-pointer ${opt === q.answer ? 'bg-emerald-500/[0.03] border-emerald-400' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'}`}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).isContentEditable) return;
                                            onEdit(`questions[${i}].answer`, opt);
                                        }}
                                    >
                                        <Field
                                            label={`ALTERNATIVA ${String.fromCharCode(65 + optIdx)}`}
                                            value={opt}
                                            onChange={(val) => {
                                                const wasCorrect = opt === q.answer;
                                                onEdit(`questions[${i}].options[${optIdx}]`, val);
                                                if (wasCorrect) onEdit(`questions[${i}].answer`, val);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </SectionCard>
    );
};

/**
 * Componente para itens de resumo (Tempo, Fases, Dificuldade).
 * Usa safeString para garantir que os valores nunca quebrem o React.
 */
const SummaryItem: React.FC<{ icon: any; label: string; value: any; onChange: any }> = ({ icon, label, value, onChange }) => (
    <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100/50 hover:bg-white transition-all">
        <div className="flex items-center gap-2 mb-2 ml-1">
            {icon}
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{safeString(label)}</span>
        </div>
        <Field label="" value={safeString(value)} onChange={onChange} />
    </div>
);

const Field: React.FC<{ label: string; value?: string; onChange: (v: string) => void; readonly?: boolean }> = ({ label, value, onChange, readonly = false }) => {
    const divRef = useRef<HTMLDivElement | null>(null);
    const [focused, setFocused] = useState(false);

    // Converte SEMPRE para string segura — nunca renderiza objetos/eventos
    const safeValue = (v: unknown): string => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        // Objeto ou array: converte para JSON como fallback
        try { return typeof v === 'object' ? JSON.stringify(v) : String(v); } catch { return ''; }
    };

    const strValue = safeValue(value);

    useEffect(() => {
        if (!divRef.current || focused) return;
        divRef.current.innerText = strValue;
    }, [strValue, focused]);

    return (
        <div className="w-full group/field">
            {label && (
                <div className="flex items-center justify-between mb-1.5 ml-1">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</h4>
                    {!readonly && (
                        <PencilLine className="w-3 h-3 text-indigo-400 opacity-0 group-hover/field:opacity-100 transition-opacity" />
                    )}
                </div>
            )}
            <div
                ref={divRef}
                contentEditable={!readonly}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                    setFocused(false);
                    const newVal = divRef.current?.innerText || '';
                    if (newVal !== strValue) onChange(newVal);
                }}
                className={`text-[15px] font-medium leading-relaxed outline-none p-2 rounded-xl transition-all relative border border-transparent ${readonly
                    ? 'text-slate-500 italic bg-transparent'
                    : 'hover:bg-indigo-50/30 hover:border-indigo-100 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:shadow-md border-slate-200/10'
                    }`}
            />
        </div>
    );
};

export default DocumentView;

