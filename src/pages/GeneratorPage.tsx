// Componente da Página do Gerador
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { GeneratorSidebar } from '../components/generator/GeneratorSidebar';
import { DocumentView, DocumentViewErrorBoundary } from '../components/generator/DocumentView';
import type { GeneratorFormData, GeneratedContent } from '../types';
import { Wand2, Save, FolderDown, CheckCircle, Pencil, Check, X } from 'lucide-react';
import { model } from '../lib/gemini';
import type { Part } from '@google/generative-ai';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';

// ─── Sanitização de dados da IA ────────────────────────────────────────────
// Converte qualquer valor para string segura (nunca renderiza objetos como React child)
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

// Sanitiza o contenteúdo gerado pela IA (ou carregado do Firestore)
// Garante que todos os campos exibidos como texto são strings válidas
function sanitizeContent(input: any, gameType?: string): Record<string, unknown> {
    // PROTEÇÃO: Se a IA retornar um array (ex: [{...}]), pegamos o primeiro elemento
    let data: Record<string, unknown>;
    if (Array.isArray(input)) {
        data = (input[0] && typeof input[0] === 'object') ? input[0] : {};
    } else if (input && typeof input === 'object') {
        data = input;
    } else {
        data = {};
    }

    data.creativeTitle = toStr(data.creativeTitle);

    // Força a existência da relação curricular
    if (!data.curriculumRelation || typeof data.curriculumRelation !== 'object') {
        data.curriculumRelation = { area: '', yearAndQuarter: '', subject: '', theme: '', bnccSkills: '', skillsDescription: '', bibliography: '' };
    }
    const cr = data.curriculumRelation as Record<string, unknown>;
    cr.area = toStr(cr.area);
    cr.yearAndQuarter = toStr(cr.yearAndQuarter);
    cr.subject = toStr(cr.subject);
    cr.theme = toStr(cr.theme);
    cr.bnccSkills = toStr(cr.bnccSkills);
    cr.skillsDescription = toStr(cr.skillsDescription);
    cr.bibliography = toStr(cr.bibliography);

    // Força a existência e o tipo correto do gameStyle
    if (!data.gameStyle || typeof data.gameStyle !== 'object') {
        data.gameStyle = { genre: gameType || 'Não Definido', targetAudience: '', narrative: '' };
    }
    const gs = data.gameStyle as Record<string, unknown>;

    // BLINDAGEM MÁXIMA: Se temos um gameType fornecido, ele MANDATORIAMENTE sobrescreve o da IA
    const safeGameType = toStr(gameType);
    if (safeGameType.trim() !== '') {
        gs.genre = safeGameType;
    } else {
        gs.genre = toStr(gs.genre) || 'Não Definido';
    }
    gs.targetAudience = toStr(gs.targetAudience);
    gs.narrative = toStr(gs.narrative);

    // Força a existência do enredo
    if (!data.gamePlot || typeof data.gamePlot !== 'object') {
        data.gamePlot = { synopsis: '', characters: '', gameFlow: '', obstacles: '', mechanics: '' };
    }
    const gp = data.gamePlot as Record<string, unknown>;
    gp.synopsis = toStr(gp.synopsis);
    gp.characters = toStr(gp.characters);
    gp.gameFlow = toStr(gp.gameFlow);
    gp.obstacles = toStr(gp.obstacles);
    gp.mechanics = toStr(gp.mechanics);

    // Força a existência do conteúdo programático
    if (!data.programmaticContent || typeof data.programmaticContent !== 'object') {
        data.programmaticContent = { intro: '', winCondition: '', loseCondition: '' };
    }
    const pc = data.programmaticContent as Record<string, unknown>;
    pc.intro = toStr(pc.intro);
    pc.winCondition = toStr(pc.winCondition);
    pc.loseCondition = toStr(pc.loseCondition);

    // Força a existência da lógica do jogo
    if (!data.gameLogic || typeof data.gameLogic !== 'object') {
        data.gameLogic = { howToPlay: '', timeLimit: '', levels: '', difficulty: '', targets: [] };
    }
    const gl = data.gameLogic as Record<string, unknown>;
    gl.howToPlay = toStr(gl.howToPlay);
    gl.timeLimit = toStr(gl.timeLimit);
    gl.levels = toStr(gl.levels);
    gl.difficulty = toStr(gl.difficulty);
    if (Array.isArray(gl.targets)) {
        gl.targets = (gl.targets as Record<string, unknown>[]).map(t => ({
            ...t,
            title: toStr(t.title),
            description: toStr(t.description),
            feedback: toStr(t.feedback),
            answer: toStr(t.answer),
            options: toStrArr(t.options).length > 0 ? toStrArr(t.options) : [],
            points: typeof t.points === 'number' ? t.points : Number(t.points) || 0,
            isCorrect: Boolean(t.isCorrect),
        }));
    } else {
        gl.targets = [];
    }

    if (data.quiz && typeof data.quiz === 'object') {
        const quiz = data.quiz as Record<string, unknown>;
        if (Array.isArray(quiz.questions)) {
            quiz.questions = (quiz.questions as Record<string, unknown>[]).map(q => ({
                ...q,
                question: toStr(q.question),
                answer: toStr(q.answer),
                options: toStrArr(q.options).length > 0 ? toStrArr(q.options) : ['Opção A', 'Opção B', 'Opção C', 'Opção D'],
            }));
        } else {
            quiz.questions = [];
        }
    }

    return data;
}
// ───────────────────────────────────────────────────────────────────────────

const GeneratorPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Estado para armazenar os dados do formulário
    const [formData, setFormData] = useState<GeneratorFormData>({
        gradeLevel: '',
        subject: '',
        year: '',
        quarter: '',
        gameType: '',
        additionalContext: ''
    });

    // SOLUÇÃO: refs que sempre refletem os valores atuais sem stale closures
    const formDataRef = useRef<GeneratorFormData>(formData);
    const pendingGameTypeRef = useRef<string>(formData.gameType);

    // Impede que loadProject (async) sobrescreva formData após mudanças do usuário
    const projectHasLoadedRef = useRef(false);
    const userHasModifiedRef = useRef(false);

    // Estados para o conteúdo gerado e carregamento
    const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
    const [showSavedBanner, setShowSavedBanner] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);

    // Título do projeto (editável)
    const [projectTitle, setProjectTitle] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');

    const [pdfBase64, setPdfBase64] = useState<string | null>(null);
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);

    // Mantém os refs sempre sincronizados com o state real
    useEffect(() => {
        formDataRef.current = formData;
        pendingGameTypeRef.current = formData.gameType;
    }, [formData]);

    const handlePdfChange = (base64: string | null, name: string | null) => {
        setPdfBase64(base64);
        setPdfFileName(name);
        setIsDirty(true);
    };

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Carrega projeto de Firestore ou localStorage
    useEffect(() => {
        const projectId = searchParams.get('id');
        if (!projectId) return;

        let cancelled = false;  // Previne race condition: se o usuário mudou algo antes do getDoc terminar, ignora
        projectHasLoadedRef.current = false;
        userHasModifiedRef.current = false;

        const loadProject = async () => {
            try {
                // Tenta primeiro o Firestore se o usuário estiver logado
                if (auth.currentUser) {
                    const docRef = doc(db, 'projects', projectId);
                    const docSnap = await getDoc(docRef);

                    // PROTEÇÃO: abandona se o usuário já modificou o form enquanto esperava
                    if (cancelled || userHasModifiedRef.current) return;

                    if (docSnap.exists()) {
                        const project = docSnap.data();
                        projectHasLoadedRef.current = true;
                        pendingGameTypeRef.current = project.formData?.gameType || project.gameType || '';
                        setFormData(prev => ({
                            ...prev,
                            ...(project.formData || {}),
                            gameType: project.formData?.gameType || project.gameType || prev.gameType,
                            additionalContext: toStr(project.formData?.additionalContext || project.additionalContext || '')
                        }));
                        // Sanitiza ao carregar — projetos antigos podem ter dados malformados
                        const sanitized = sanitizeContent(project.content || {}, project.formData?.gameType || project.gameType || '') as any;
                        setGeneratedContent(sanitized);
                        setSavedProjectId(projectId);
                        setIsViewMode(true);
                        setProjectTitle(project.title);
                        return;
                    }
                }

                if (cancelled || userHasModifiedRef.current) return;

                // Fallback para localStorage
                const stored = localStorage.getItem('gamecanvas_projects');
                if (!stored) return;
                const projects = JSON.parse(stored);
                const project = projects.find((p: { id: string }) => p.id === projectId);
                if (project) {
                    projectHasLoadedRef.current = true;
                    pendingGameTypeRef.current = project.formData?.gameType || project.gameType || '';
                    setFormData(prev => ({
                        ...prev,
                        ...(project.formData || {}),
                        gameType: project.formData?.gameType || project.gameType || prev.gameType,
                        additionalContext: toStr(project.formData?.additionalContext || project.additionalContext || '')
                    }));
                    // Sanitiza ao carregar — projetos antigos podem ter dados malformados
                    setGeneratedContent(sanitizeContent(project.content || {}, project.formData?.gameType || '') as any);
                    setSavedProjectId(projectId);
                    setIsViewMode(true);
                    const title = toStr(project.title || project.formData?.additionalContext || project.formData?.subject || 'Planejamento').split('\n')[0];
                    setProjectTitle(title);
                }
            } catch (err) {
                console.warn('Erro ao carregar projeto:', err);
            }
        };

        loadProject();
        return () => { cancelled = true; };  // Cleanup: marca como cancelado se o effect re-executar
    }, [searchParams]);

    // Atualiza título quando formData muda (modo criação)
    useEffect(() => {
        if (!isViewMode && !projectTitle) {
            const derived = toStr(formData.additionalContext || formData.subject || '').split('\n')[0];
            setProjectTitle(derived);
        }
    }, [formData, isViewMode]);

    // Handlers de edição de título
    const startEditTitle = () => {
        setTitleDraft(projectTitle);
        setIsEditingTitle(true);
    };
    const confirmEditTitle = () => {
        const trimmed = toStr(titleDraft).trim();
        if (trimmed) {
            setProjectTitle(trimmed);
            setIsDirty(true);
        }
        setIsEditingTitle(false);
    };
    const cancelEditTitle = () => {
        setIsEditingTitle(false);
    };

    // Função para salvar o projeto no Firestore e localStorage
    const handleSave = async () => {
        if (!generatedContent) return;

        setIsSaving(true);
        try {
            const projectId = savedProjectId || Date.now().toString();
            const title = projectTitle || formData.subject || 'Novo Planejamento';
            const user = auth.currentUser;

            const projectData = {
                id: projectId,
                userId: user?.uid || 'local',
                title,
                subject: formData.subject,
                grade: formData.gradeLevel,
                updatedAt: new Date().toLocaleDateString('pt-BR'),
                createdAt: savedProjectId ? (new Date().toISOString()) : new Date().toISOString(), // Simplified for now
                formData,
                content: generatedContent,
                color: 'bg-indigo-500'
            };

            // Salva no Firestore se logado
            if (user) {
                await setDoc(doc(db, 'projects', projectId), projectData);
            }

            // Backup no localStorage
            const stored = localStorage.getItem('gamecanvas_projects');
            const existingProjects = stored ? JSON.parse(stored) : [];
            const idx = existingProjects.findIndex((p: { id: string }) => p.id === projectId);
            if (idx >= 0) {
                existingProjects[idx] = projectData;
            } else {
                existingProjects.push(projectData);
            }
            localStorage.setItem('gamecanvas_projects', JSON.stringify(existingProjects));

            setSavedProjectId(projectId);
            setIsViewMode(true);
            setIsDirty(false);
            setShowSavedBanner(true);
            setTimeout(() => setShowSavedBanner(false), 3000);
        } catch (error: unknown) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar projeto no servidor. Verifique sua conexão.');
        } finally {
            setIsSaving(false);
        }
    };

    // Instruções específicas de gameLogic por tipo de jogo
    const getGameLogicInstruction = (gameType: string): string => {
        const map: Record<string, string> = {
            'Jogo de Tiro ao Alvo': 'Crie 8 alvos (4 corretos com pontos positivos entre +10 e +20 e 4 incorretos com pontos negativos entre -5 e -15). Cada alvo tem uma afirmação sobre o conteúdo. timeLimit: "45 segundos", levels: "3 níveis", difficulty: "Progressiva".',
            'Quiz': 'Crie 10 perguntas, cada uma com uma pergunta como title, a resposta correta ou explicação como description. Use 4 alternativas por pergunta no targets e deixe claro qual é a correta. points: entre 10 e 25 para corretas, -5 a -10 para incorretas. timeLimit: "30 segundos por pergunta", levels: "1 fase", difficulty: "Crescente".',
            'Memória': 'Crie 8 pares de cartas (16 items no total, mas retorne apenas 8 pares únicos). Cada par tem title (conceito) e description (definição ou imagem). isCorrect: true para todos. points: +10 cada par. timeLimit: "2 minutos", levels: "1 fase", difficulty: "Moderada".',
            'Arrastar e Soltar': 'Crie 6 items para arrastar para a categoria correta. title = item, description = categoria onde deve ser encaixado. 4 corretos (isCorrect: true, +15pts) e 2 incorretos (isCorrect: false, -10pts). timeLimit: "60 segundos", levels: "2 fases", difficulty: "Progressiva".',
            'Jogo de Plataforma 2D': 'Crie um jogo de plataforma com 3 fases. O jogo deve ter um personagem principal definido. Crie 8 elementos: 3 INIMIGOS (isCorrect: false, -15pts), 3 OBSTÁCULOS (isCorrect: false, -10pts) e 2 ITENS INFORMATIVOS (isCorrect: true, +20pts). Nos itens informativos, coloque conceitos chave do tema no title e a explicação detalhada no description. Relacione inimigos e obstáculos com desafios do conteúdo e garanta que a progressão ocorra em 3 níveis distintos. timeLimit: "3 minutos", levels: "3 fases", difficulty: "Progressiva".',
            'Roleta': 'Crie 10 casas para o jogo de roleta seguindo estritamente estas regras: 1) 4 casas de QUIZ (title: O ENUNCIADO COMPLETO E DETALHADO DA PERGUNTA, options: exatamente 4 alternativas curtas e objetivas, answer: a alternativa correta exata, isCorrect: true). 2) 3 casas INFORMATIVAS (title: "DICA", description: informação crucial para ajudar no quiz, isCorrect: true). 3) 3 casas de PERDA (title: "PENALIDADE", description: consequência negativa, isCorrect: false, points: -20). O visual vermelho é ativado por isCorrect: false. Objetivo: Responder todos os 4 quizes.',
            'Quebra-Cabeça': 'Crie 6 peças do quebra-cabeça, cada peça é um fragmento de imagem ou conceito. isCorrect: true para as que se encaixam, false para as que não pertencem. +15 corretas, -5 incorretas. title = fragmento, description = o que representa. timeLimit: "90 segundos", levels: "2 fases", difficulty: "Moderada".',
            'Enigmas Movimento': 'Crie 6 enigmas de movimento (labirinto/direção). title = a pergunta ou dica do enigma, description = explicação da resposta correta. 4 corretos (+15pts) e 2 incorretos (-10pts). timeLimit: "60 segundos", levels: "3 fases", difficulty: "Crescente".',
            'Tabuleiro': 'Crie 8 casas do tabuleiro. Casas-bônus (isCorrect: true, +20pts) e casas-armadilha (isCorrect: false, -10pts). title = nome da casa, description = o que acontece ao cair nela e qual conteúdo ela representa. timeLimit: "Sem limite", levels: "1 partida", difficulty: "Moderada".',
            'Esmaga Palavras': 'Crie uma lista de 10 palavras-chave relacionadas ao conteúdo para um jogo estilo "Caça Palavras" with mecânica de esmagar blocos que caem. Para cada item, coloque a palavra exata no "title" e uma descrição/pista sugestiva no "description". No jogo, a descrição será a dica visual e a palavra será o alvo encontrado. isCorrect: true para todos. points: +15pts cada. timeLimit: "2 minutos", levels: "1 fase", difficulty: "Moderada".',
            'Jogo da Velha': 'Crie 9 posições do tabuleiro com afirmações sobre o conteúdo. Para marcar X ou O o jogador deve responder corretamente. 6 afirmações corretas (isCorrect: true, +10pts) e 3 incorretos (isCorrect: false, -5pts). title = afirmação, description = explicação. timeLimit: "Sem limite", levels: "Melhor de 3", difficulty: "Moderada".',
        };
        return map[gameType] || 'Crie 6 elementos do jogo com title, description, isCorrect (true/false), points e feedback relevantes ao conteúdo.';
    };

    const handleGenerate = async (gameTypeOverride?: string | React.MouseEvent | React.PointerEvent) => {
        // SOLUÇÃO DEFINITIVA: Intercepta se o primeiro argumento for um evento (ocorre via onClick)
        // Se for um evento, ignoramos e usamos os seletores normais.
        let finalGameType = '';
        if (typeof gameTypeOverride === 'string' && gameTypeOverride.trim() !== '') {
            finalGameType = gameTypeOverride;
        } else {
            // Se chamado via onClick, gameTypeOverride será o SyntheticEvent object
            finalGameType = toStr(pendingGameTypeRef.current || formDataRef.current.gameType);
        }

        const currentData = formDataRef.current;
        const capturedGameType = toStr(finalGameType);
        const capturedGradeLevel = toStr(currentData.gradeLevel);
        const capturedSubject = toStr(currentData.subject);
        const capturedYear = toStr(currentData.year);
        const capturedQuarter = toStr(currentData.quarter);
        const capturedContext = toStr(currentData.additionalContext);
        const capturedPdf = pdfBase64;

        const hasPdf = !!capturedPdf;
        const hasContext = toStr(capturedContext).trim().length > 0;

        // Validação com feedback detalhado para o usuário
        const missing = [];
        if (!capturedGradeLevel) missing.push('Nível de Ensino');
        if (!capturedSubject) missing.push('Matéria');
        if (!capturedYear) missing.push('Ano/Série');
        if (!capturedQuarter) missing.push('Bimestre');
        if (!capturedGameType) missing.push('Tipo de Jogo');

        if (missing.length > 0) {
            alert(`Por favor, preencha os campos: ${missing.join(', ')}`);
            return;
        }

        if (!hasPdf && !hasContext) {
            alert('Por favor, envie um PDF de apoio ou preencha o campo "Objetivo / Contexto".');
            return;
        }

        setIsGenerating(true);
        try {
            const pdfInstruction = capturedPdf
                ? 'O professor enviou um PDF com o material de apoio. PRIORIDADE MÁXIMA: use EXCLUSIVAMENTE o conteúdo do PDF como fonte primária para todos os campos, especialmente o conteúdo pedagógico, termos técnicos, exemplos e o campo intro que deve conter a introdução baseada nesse material.'
                : '';

            const gameLogicInstruction = getGameLogicInstruction(capturedGameType);

            const prompt = `Você é um especialista em gamificação educacional.
${pdfInstruction}
Crie um planejamento de gamificação educacional completo com os seguintes dados:
- Nível: ${capturedGradeLevel}
- Matéria: ${capturedSubject}
- Ano: ${capturedYear}
- Bimestre: ${capturedQuarter}
- Tipo de Jogo: ${capturedGameType}
- Regras Específicas: ${gameLogicInstruction}
- Contexto/Ideia do professor: ${capturedContext || '(não informado, use o PDF como base)'}

Retorne APENAS um JSON válido com esta estrutura:
{
  "creativeTitle": "UM TÍTULO CRIATIVO E IMPACTANTE EM MAIÚSCULAS",
  "curriculumRelation": {
    "area": "", "yearAndQuarter": "${capturedYear} - ${capturedQuarter}", "subject": "${capturedSubject}",
    "theme": "", "bnccSkills": "", "skillsDescription": "", "bibliography": ""
  },
  "gameStyle": { "genre": "${capturedGameType}", "targetAudience": "${capturedGradeLevel}", "narrative": "" },
  "gamePlot": { "synopsis": "FLUXO DO JOGO: Detalhe o que acontece desde o início até o fim sob a ótica da mecânica de '${capturedGameType}'. Explique como o aluno progride no jogo (ex: se for plataforma, como ele pula e coleta itens; se for roleta, como ele gira e responde), dividindo a experiência em cenários ou fases que agrupam subtemas do conteúdo. Mapeie a progressão e a organização das etapas.", "characters": "CHEFES E INIMIGOS / OBSTÁCULOS: Identifique o personagem principal controlado pelo jogador e os elementos de resistência (chefes, inimigos, obstáculos) que o desafiam. Planeje dificuldades que impeçam o progresso imediato (cronômetros, casas de perda de pontos, inimigos patrulha, etc) para que a vitória tenha mais valor. Note: Para o tipo '${capturedGameType}', descreva o protagonista e seus adversários de forma contextualizada.", "gameFlow": "", "obstacles": "", "mechanics": "" },
  "programmaticContent": {
    "intro": "INTRODUÇÃO (baseado ${capturedPdf ? 'no PDF enviado' : 'no contexto fornecido'}): Escreva uma introdução cativante e contextualizada sobre o tema abordado no jogo, referenciando os conceitos principais extraídos do material. O texto deve situar o jogador no universo do tema e explicar brevemente o que será explorado pedagogicamente.",
    "winCondition": "",
    "loseCondition": ""
  },
  "gameLogic": {
    "howToPlay": "", "timeLimit": "", "levels": "", "difficulty": "",
    "targets": [{ "title": "", "description": "", "isCorrect": true, "points": 15, "options": ["", "", "", ""], "answer": "", "feedback": "" }]
  },
  "quiz": ${capturedGameType === 'Quiz' ? '{ "questions": [{ "question": "", "options": ["","","",""], "answer": "" }] }' : 'null'}
}`;

            const parts: Part[] = [{ text: prompt }];

            if (capturedPdf) {
                parts.push({
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: capturedPdf,
                    }
                });
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig: { responseMimeType: 'application/json' },
            });

            const text = result.response.text().replace(/```json|```/g, '').trim();
            console.log('IA Bruta:', text);
            const data = JSON.parse(text);

            // Sanitiza e atualiza o estado com o conteúdo final bloqueando o gênero
            const sanitizedData = sanitizeContent(data, capturedGameType) as any;

            // Força IDs BNCC e complementos se faltarem
            const cr = sanitizedData.curriculumRelation as any;
            if (!cr.area) cr.area = capturedSubject;
            if (!cr.subject) cr.subject = capturedSubject;
            if (!cr.yearAndQuarter) cr.yearAndQuarter = `${capturedYear} - ${capturedQuarter}`;

            setGeneratedContent(sanitizedData);
            setIsViewMode(false);
            setIsDirty(true);

            // Forçar que o formData.gameType mantenha o valor capturado
            setFormData(prev => ({ ...prev, gameType: capturedGameType }));

            if (data.creativeTitle) {
                setProjectTitle(toStr(data.creativeTitle).toUpperCase());
            } else if (!projectTitle || isViewMode) {
                setProjectTitle(toStr(capturedContext || capturedSubject || 'Novo Planejamento').split('\n')[0]);
            }
        } catch (error: any) {
            console.error('Erro detalhado na geração:', error);
            console.error('Stack trace:', error?.stack);
            alert(`Falha ao gerar conteúdo: ${error?.message || 'Erro desconhecido'}. Tente novamente.`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Recriar roteiro com os parâmetros atuais
    // Captura o gameType via ref (sempre live) ANTES de qualquer setState
    const handleRecreate = () => {
        const gameTypeSnapshot = pendingGameTypeRef.current || formData.gameType;
        setIsViewMode(false);
        // Timeout mínimo para garantir que os setStates acima sejam processados
        // antes de iniciar a geração, evitando qualquer batching inesperado
        setTimeout(() => handleGenerate(gameTypeSnapshot), 0);
    };

    const handleExportPDF = () => {
        const input = document.getElementById('canvas-content');
        if (!input) { alert("Conteúdo não encontrado."); return; }

        // Captura o estado atual do canvas de Drag & Drop, se existir
        let dragDropImageUrl: string | null = null;
        const ddCanvas = document.querySelector('#drag-drop-canvas-section canvas') as HTMLCanvasElement | null;
        if (ddCanvas) {
            dragDropImageUrl = ddCanvas.toDataURL('image/png');
        }

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) { alert("O popup foi bloqueado."); return; }

        if (!printWindow || !generatedContent) { alert("Erro ao gerar PDF ou popup bloqueado."); return; }

        const currentTitle = projectTitle || formData.subject || 'Canvas Gamificado';
        const docTitle = (currentTitle).toUpperCase();

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8" />
                <title>${docTitle}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background: #fff; }
                    h1 { color: #4f46e5; border-bottom: 3px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 40px; text-align: center; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; }
                    .canvas-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                    .section { margin-bottom: 25px; padding: 25px; border: 2px solid #f1f5f9; border-radius: 20px; background: #fcfdfe; page-break-inside: avoid; }
                    .section-full { grid-column: span 2; }
                    .header-meta { text-align: center; margin-bottom: 40px; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
                    .section-title { font-weight: 900; text-transform: uppercase; font-size: 13px; color: #4f46e5; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
                    .label { font-weight: 800; font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-top: 15px; margin-bottom: 4px; }
                    .value { font-size: 14px; color: #334155; }
                    .target-item { margin-top: 10px; padding: 10px; border-radius: 10px; background: #f8fafc; border-left: 4px solid #4f46e5; }
                    .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; background: #eef2ff; color: #4f46e5; font-size: 10px; font-weight: 900; margin-right: 5px; }
                    @media print { body { padding: 0; } .section { border-color: #e2e8f0; } }
                </style>
            </head>
            <body>
                <h1>${docTitle}</h1>
                <div class="header-meta">
                    ${formData.gradeLevel} &bull; ${formData.subject} &bull; ${formData.year} - ${formData.quarter}
                </div>
                
                <div class="canvas-grid">
                    <div class="section section-full">
                        <div class="section-title">1. Planejamento Curricular</div>
                        <div class="label">Área</div><div class="value">${generatedContent.curriculumRelation.area}</div>
                        <div class="label">Tema</div><div class="value">${generatedContent.curriculumRelation.theme}</div>
                        <div class="label">BNCC</div><div class="value">${generatedContent.curriculumRelation.bnccSkills}</div>
                        <div class="label">Descrição</div><div class="value">${generatedContent.curriculumRelation.skillsDescription}</div>
                    </div>

                    <div class="section">
                        <div class="section-title">2. Estilo do Jogo</div>
                        <div class="label">TIPO DE JOGO</div><div class="value">${generatedContent.gameStyle.genre}</div>
                        <div class="label">PÚBLICO</div><div class="value">${generatedContent.gameStyle.targetAudience}</div>
                        <div class="label">NARRATIVA CURTA</div><div class="value">${generatedContent.gameStyle.narrative}</div>
                    </div>

                    <div class="section">
                        <div class="section-title">3. Fluxo do Jogo</div>
                        <div class="label">FLUXO DO JOGO</div><div class="value">${generatedContent.gamePlot.synopsis}</div>
                        <div class="label">CHEFES E INIMIGOS / OBSTÁCULOS</div><div class="value">${generatedContent.gamePlot.characters}</div>
                    </div>

                    <div class="section section-full">
                        <div class="section-title">4. Conteúdo Programático</div>
                        <div class="label">INTRODUÇÃO</div><div class="value">${(generatedContent.programmaticContent.intro || '').replace(/^GUIA DE IMPLEMENTAÇÃO PARA O DESENVOLVEDOR:?/i, '').trim()}</div>
                        <div style="display: flex; gap: 20px; margin-top: 15px;">
                            <div style="flex: 1"><div class="label">VITÓRIA</div><div class="value">${generatedContent.programmaticContent.winCondition}</div></div>
                            <div style="flex: 1"><div class="label">DERROTA</div><div class="value">${generatedContent.programmaticContent.loseCondition}</div></div>
                        </div>
                    </div>

                    <div class="section section-full">
                        <div class="section-title">5. Lógica do Jogo</div>
                        <div class="label">COMO JOGAR</div><div class="value">${generatedContent.gameLogic.howToPlay}</div>
                        <div class="label">CONFIGURAÇÕES</div>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            <span class="tag">TEMPO: ${generatedContent.gameLogic.timeLimit}</span>
                            <span class="tag">FASES: ${generatedContent.gameLogic.levels}</span>
                            <span class="tag">DIFICULDADE: ${generatedContent.gameLogic.difficulty}</span>
                        </div>
                        <div class="label">ELEMENTOS DO JOGO</div>
                        ${generatedContent.gameLogic.targets.map(t => `
                            <div class="target-item">
                                <div style="font-weight: bold; font-size: 13px; color: ${t.isCorrect ? '#10b981' : '#f43f5e'}">${t.title}</div>
                                <div class="label" style="margin-top: 5px; color: #94a3b8; font-size: 8px;">${formData.gameType === 'Esmaga Palavras' ? 'DICA' : 'FEEDBACK'}</div>
                                <div style="font-size: 11px; color: #64748b">${t.description || t.feedback}</div>
                            </div>
                        `).join('')}
                    </div>

                    ${generatedContent.quiz ? `
                    <div class="section section-full">
                        <div class="section-title">Quiz Extra</div>
                        ${generatedContent.quiz.questions.map((q, i) => `
                            <div style="margin-bottom: 15px;">
                                <div style="font-weight: bold; font-size: 13px;">${i + 1}. ${q.question}</div>
                                <div style="font-size: 12px; color: #64748b; margin-left: 15px; margin-top: 5px;">
                                    ${q.options.map(o => `&bull; ${o}${o === q.answer ? ' <b>(CORRETA)</b>' : ''}`).join('<br>')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}

                    ${dragDropImageUrl ? `
                    <div class="section section-full">
                        <div class="section-title">Canvas Drag &amp; Drop — Posições finais</div>
                        <img src="${dragDropImageUrl}" style="width:100%; border-radius: 12px; margin-top: 10px; border: 1px solid #f1f5f9;" />
                    </div>
                    ` : ''}
                </div>

                <div style="margin-top: 50px; padding-top: 20px; border-top: 1px border #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center;">
                    Documento gerado eletronicamente por Game Canvas AI.
                </div>

                <script>window.onload = function() { window.print(); window.close(); };<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleContentUpdate = (section: keyof GeneratedContent, field: string, value: any) => {
        if (field === '_projectTitle') {
            setProjectTitle(value);
            return;
        }
        if (!generatedContent) return;
        setGeneratedContent(prev => {
            if (!prev) return null;
            const newState = { ...prev };

            const setNested = (obj: any, path: string, val: any) => {
                const keys = path.replace(/\]/g, '').split(/[.\[]/);
                let current = obj;
                for (let i = 0; i < keys.length - 1; i++) {
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = val;
            };

            setIsDirty(true);

            try {
                if (field.includes('.') || field.includes('[')) {
                    setNested(newState[section], field, value);
                } else {
                    (newState[section] as any)[field] = value;
                }
            } catch (e) {
                console.error("Error updating field:", field, e);
            }

            return { ...newState };
        });
    };

    const handleAddItem = (section: keyof GeneratedContent, path: string, item: any) => {
        if (!generatedContent) return;
        setGeneratedContent(prev => {
            if (!prev) return null;
            const newState = JSON.parse(JSON.stringify(prev));
            const keys = path.replace(/\]/g, '').split(/[.\[]/);
            let current = newState[section];
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            const lastKey = keys[keys.length - 1];
            if (Array.isArray(current[lastKey])) {
                current[lastKey].push(item);
            }
            setIsDirty(true);
            return newState;
        });
    };

    const handleRemoveItem = (section: keyof GeneratedContent, path: string, index: number) => {
        if (!generatedContent) return;
        setGeneratedContent(prev => {
            if (!prev) return null;
            const newState = JSON.parse(JSON.stringify(prev));
            const keys = path.replace(/\]/g, '').split(/[.\[]/);
            let current = newState[section];
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            const lastKey = keys[keys.length - 1];
            if (Array.isArray(current[lastKey])) {
                current[lastKey].splice(index, 1);
            }
            setIsDirty(true);
            return newState;
        });
    };

    const displayTitle = projectTitle || formData.subject || 'Novo Planejamento';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-screen bg-mesh-light overflow-hidden transition-colors duration-300 font-sans"
        >
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="h-20 bg-slate-100/90 backdrop-blur-3xl border-b border-slate-300/30 flex items-center justify-between px-8 z-[70]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => isDirty ? setShowUnsavedModal(true) : navigate('/dashboard')}
                            className="flex items-center gap-2 px-6 py-2 border-2 border-slate-200 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/5 cursor-pointer bg-white"
                            title="Voltar ao Dashboard"
                        >
                            Voltar
                        </button>
                    </div>

                    <div className="flex flex-col items-center flex-1 max-w-xl mx-auto px-4">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-1">Canvas Gamificado</span>
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2 group w-full">
                                <input
                                    autoFocus
                                    className="text-lg font-black text-indigo-500 border-none outline-none bg-indigo-500/5 px-6 py-2 rounded-2xl text-center flex-1 transition-all"
                                    value={titleDraft}
                                    onChange={e => setTitleDraft(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') confirmEditTitle(); if (e.key === 'Escape') cancelEditTitle(); }}
                                />
                                <div className="flex gap-1">
                                    <button onClick={confirmEditTitle} className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all">
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={cancelEditTitle} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-rose-500 transition-all">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={startEditTitle}
                                className="group flex items-center gap-3 px-6 py-2 rounded-2xl hover:bg-black/5 transition-all text-center cursor-pointer"
                            >
                                <span className="text-lg font-black text-slate-800 truncate max-w-[400px] tracking-tight">{displayTitle}</span>
                                <Pencil className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {generatedContent && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleExportPDF}
                                    className="flex items-center gap-2 border-rose-200 text-rose-500 hover:bg-rose-50 px-6 font-black text-[10px] tracking-widest uppercase"
                                >
                                    <FolderDown className="w-4 h-4" />
                                    Exportar PDF
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    isLoading={isSaving}
                                    className="flex items-center gap-2 shadow-xl shadow-indigo-500/10 bg-indigo-500 hover:bg-indigo-600 border-none px-6"
                                >
                                    <Save className="w-4 h-4" />
                                    {isViewMode ? 'ATUALIZAR' : 'SALVAR'}
                                </Button>
                            </>
                        )}
                    </div>
                </header>

                {showSavedBanner && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center gap-2 text-emerald-700 text-sm"
                    >
                        <CheckCircle className="w-4 h-4" />
                        <span>Planejamento salvo com sucesso!</span>
                        <button onClick={() => navigate('/dashboard')} className="ml-auto text-emerald-600 underline font-medium hover:text-emerald-800">Ver no Painel</button>
                    </motion.div>
                )}

                <div className="flex flex-1 overflow-hidden">
                    <GeneratorSidebar
                        formData={formData}
                        setFormData={(updater) => {
                            // Marca que o usuário modificou — impede loadProject de sobrescrever
                            userHasModifiedRef.current = true;
                            setFormData(updater);
                        }}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        onPdfChange={handlePdfChange}
                        pdfFileName={pdfFileName}
                        viewOnly={isViewMode}
                        onRecreate={handleRecreate}
                    />

                    <main className="flex-1 bg-slate-200/30 p-8 overflow-y-auto custom-scrollbar">
                        {isGenerating ? (
                            <LoadingAnimation />
                        ) : generatedContent ? (
                            <div className="space-y-6 max-w-5xl mx-auto">
                                <div id="canvas-content" className="bg-slate-100 rounded-[3rem] shadow-2xl shadow-indigo-500/5 p-1 border border-white/50">
                                    <DocumentViewErrorBoundary>
                                        <DocumentView
                                            content={generatedContent}
                                            title={displayTitle}
                                            gameType={formData.gameType}
                                            onEdit={handleContentUpdate}
                                            onAdd={handleAddItem}
                                            onRemove={handleRemoveItem}
                                        />
                                    </DocumentViewErrorBoundary>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                                <div className="w-20 h-20 bg-slate-100/80 rounded-3xl shadow-xl shadow-indigo-500/5 flex items-center justify-center mx-auto mb-8 border border-white/50">
                                    <Wand2 className="w-10 h-10 text-indigo-500" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Onde a mágica começa</h2>
                                <p className="text-slate-500 font-medium leading-relaxed">Defina os parâmetros ao lado e nossa IA criará um planejamento educacional gamificado completo para você.</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* Modal de Confirmação para Sair sem Salvar */}
            {showUnsavedModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white text-center"
                    >
                        <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-indigo-500/10 transition-transform hover:scale-105">
                            <X className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-3 uppercase tracking-tight">Sair sem salvar?</h3>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed mb-10 px-4 opacity-80">
                            Você tem alterações pendentes que serão perdidas se sair agora.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full py-4 bg-[#0f172a] hover:bg-slate-800 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-slate-900/10 active:scale-95 cursor-pointer"
                            >
                                Sair mesmo assim
                            </button>
                            <button
                                onClick={() => setShowUnsavedModal(false)}
                                className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 cursor-pointer"
                            >
                                Continuar Editando
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default GeneratorPage;