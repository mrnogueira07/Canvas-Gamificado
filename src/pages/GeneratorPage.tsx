// Componente da Página do Gerador
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { GeneratorSidebar } from '../components/generator/GeneratorSidebar';
import { DocumentView, DocumentViewErrorBoundary } from '../components/generator/DocumentView';
import type { GeneratorFormData, GeneratedContent } from '../types';
import { Wand2, Save, FolderDown, CheckCircle, Pencil, Check, X, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { model } from '../lib/gemini';
import type { Part } from '@google/generative-ai';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { generatePDFBlob } from '../lib/pdfExport';

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

    // Força a existência ds mecânicas do jogo
    if (!data.gameMechanics || typeof data.gameMechanics !== 'object') {
        data.gameMechanics = { technicalRules: '', timeControl: '', challengesPerPhase: '', feedbackSystem: '', scoringSystem: '', collectibleItems: '' };
    }
    const gm = data.gameMechanics as Record<string, unknown>;
    gm.technicalRules = toStr(gm.technicalRules);
    gm.timeControl = toStr(gm.timeControl);
    gm.challengesPerPhase = toStr(gm.challengesPerPhase);
    gm.feedbackSystem = toStr(gm.feedbackSystem);
    gm.scoringSystem = toStr(gm.scoringSystem);
    gm.collectibleItems = toStr(gm.collectibleItems);

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
        let maxTargets = 3;
        const normalizedType = toStr(gameType);
        if (normalizedType === 'Roleta') maxTargets = 10;
        if (normalizedType === 'Jogo de Tiro ao Alvo') maxTargets = 9;
        if (normalizedType === 'Arrastar e Soltar') maxTargets = 5; // Allow for user additions up to 5
        if (normalizedType === 'Quiz') maxTargets = 10;

        gl.targets = (gl.targets as Record<string, unknown>[]).slice(0, maxTargets).map(t => {
            const rawQuestion = toStr(t.question || (t as any).pergunta || (t as any).enunciado);
            const rawTitle = toStr(t.title);

            // Prefer the longer text for the 'question' field to ensure it's "elaborated"
            const finalQuestion = (rawQuestion.length >= rawTitle.length) ? rawQuestion : rawTitle;
            const finalTitle = (rawTitle.length < rawQuestion.length && rawTitle.length > 0) ? rawTitle : finalQuestion.split('.')[0] + '.';

            // Force isCorrect for games that shouldn't have penalties
            const forceCorrect = normalizedType === 'Arrastar e Soltar' || normalizedType === 'Quiz';

            return {
                ...t,
                title: finalTitle,
                question: finalQuestion,
                description: toStr(t.description),
                feedback: toStr(t.feedback),
                answer: toStr(t.answer),
                options: toStrArr(t.options),
                points: typeof t.points === 'number' ? t.points : Number(t.points) || 15,
                isCorrect: forceCorrect ? true : Boolean(t.isCorrect),
            };
        });
    } else {
        gl.targets = [];
    }

    if (Array.isArray(gl.questionPool)) {
        gl.questionPool = (gl.questionPool as Record<string, unknown>[]).map(q => ({
            question: toStr(q.question),
            options: toStrArr(q.options),
            answer: toStr(q.answer)
        }));
    }

    if (data.quiz && typeof data.quiz === 'object') {
        const quiz = data.quiz as Record<string, unknown>;
        if (Array.isArray(quiz.questions)) {
            quiz.questions = (quiz.questions as Record<string, unknown>[]).slice(0, 3).map(q => ({
                ...q,
                question: toStr(q.question),
                answer: toStr(q.answer),
                options: toStrArr(q.options).length > 0 ? toStrArr(q.options) : ['Opção A', 'Opção B'],
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

    // SINCRONIZAÇÃO IMEDIATA: Garante que refs tenham sempre o valor mais atual do estado
    // Isso evita qualquer "atraso" do useEffect em cliques rápidos.
    formDataRef.current = formData;
    pendingGameTypeRef.current = formData.gameType;

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
                updatedAt: new Date().toISOString(),
                createdAt: savedProjectId ? (new Date().toISOString()) : new Date().toISOString(), // Simplified for now
                formData,
                content: generatedContent,
                color: 'bg-indigo-500',
                order: Date.now()
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
            'Jogo de Tiro ao Alvo': 'Crie EXATAMENTE 3 perguntas elaboradas e contextualizadas sobre o tema. Gere 3 alvos por questão.',
            'Quiz': 'Crie EXATAMENTE 3 perguntas elaboradas. Use enunciados que apresentem uma situação-problema.',
            'Memória': 'Crie EXATAMENTE 3 pares. O título deve ser uma pergunta ou conceito técnico elaborado.',
            'Arrastar e Soltar': 'Crie EXATAMENTE 3 itens. O enunciado DEVE ser uma pergunta elaborada e contextualizada de acordo com o tema. Gere 3 alternativas curtas.',
            'Jogo de Plataforma 2D': 'Crie EXATAMENTE 3 desafios pedagógicos elaborados.',
            'Roleta': 'Em "targets" crie EXATAMENTE 5 *perguntas elaboradas* com alternativas. Já na roleta (roletaSegments), crie EXATAMENTE 10 itens como descritos na instrução.',
            'Quebra-Cabeça': 'Crie EXATAMENTE 3 desafios. Enunciado elaborado e 3 opções curtas.',
            'Enigmas Movimento': 'Crie EXATAMENTE 3 enigmas seguindo o estilo de desafio pedagógico contextualizado.',
            'Tabuleiro': 'Crie EXATAMENTE 3 casas de desafio com perguntas elaboradas sobre o tema.',
            'Esmaga Palavras': 'Crie EXATAMENTE 12 palavras curtas e relevantes. Para cada palavra: use o campo "title" para a palavra em si e o campo "description" para uma definição técnica ou contexto pedagógico elaborado (2-3 linhas).',
            'Jogo da Velha': 'Crie EXATAMENTE 3 desafios com perguntas elaboradas e diretas.',
        };
        return map[gameType] || 'Crie EXATAMENTE 3 desafios pedagógicos elaborados e contextualizados.';
    };

    const handleGenerate = async (arg?: unknown) => {
        // SOLUÇÃO FINAL: Ignora QUALQUER argumento que venha do onClick (SyntheticEvent)
        // e lê os valores exclusivamente do Ref, que agora é sincronizado no ato do setFormData.
        const currentData = formDataRef.current;

        let capturedGameType = '';
        if (typeof arg === 'string' && arg.trim() !== '') {
            capturedGameType = arg;
        } else {
            capturedGameType = toStr(currentData.gameType);
        }

        const capturedGradeLevel = toStr(currentData.gradeLevel);
        const capturedSubject = toStr(currentData.subject);
        const capturedYear = toStr(currentData.year);
        const capturedQuarter = toStr(currentData.quarter);
        const capturedContext = toStr(currentData.additionalContext);
        const capturedPdf = pdfBase64;

        console.log('Validando formulário:', {
            capturedGameType, capturedGradeLevel, capturedSubject,
            capturedYear, capturedQuarter, hasPdf: !!capturedPdf
        });

        const hasPdf = !!capturedPdf;
        const hasContext = toStr(capturedContext).trim().length > 0;

        // Validação mínima (segurança extra - o botão já deve estar desabilitado se faltam campos)
        if (!capturedGameType || !capturedGradeLevel || !capturedSubject || !capturedYear || !capturedQuarter) {
            console.warn('handleGenerate chamado com campos vazios (botão deveria estar desabilitado):',
                { capturedGameType, capturedGradeLevel, capturedSubject, capturedYear, capturedQuarter });
            return;
        }

        if (!hasPdf && !hasContext) {
            return;
        }

        setIsGenerating(true);
        try {
            const pdfInstruction = capturedPdf
                ? 'O professor enviou um PDF com o material de apoio. PRIORIDADE MÁXIMA: use EXCLUSIVAMENTE o conteúdo do PDF como fonte primária para todos os campos, especialmente o conteúdo pedagógico, termos técnicos, exemplos e o campo intro que deve conter a introdução baseada nesse material.'
                : '';

            const gameLogicInstruction = getGameLogicInstruction(capturedGameType);

            const globalInstruction = capturedGameType === 'Roleta'
                ? '- INSTRUÇÃO ROLETA: Crie UM NOVO ARRAY chamado "roletaSegments" dentro de "gameLogic" com EXATAMENTE 6 itens (sendo 3 Dicas e 3 Penalidades). NESTE NOVO ARRAY, É PROIBIDO CRIAR PERGUNTAS OU BÔNUS. Cada target de `roletaSegments` DEVE ser APENAS "Dica" (texto temático interativo) ou "Penalidade" (crie um pequeno relato narrativo e imersivo informando algo rum que aconteceu no contexto do tema, ex: "Ops, entrei na trincheira inimiga e fui pego!"). O texto longo vai em "description" e o "title" é um resumo (ex: "Trincheira Inimiga!").\n- Além disso, O ARRAY PADRÃO "targets" (5.1) DEVE CONTINUAR EXISTINDO NORMALMENTE E TER EXATAMENTE 3 PERGUNTAS ELABORADAS, com "options" e "answer". Insira a numeração no campo "title" de cada pergunta (ex: "Pergunta 1: Título do Tema").'
                : '- Instrução Global para Perguntas: Crie EXATAMENTE 3 perguntas no total. É TERMINANTEMENTE PROIBIDO criar mais de 3 perguntas. Cada uma das 3 questões DEVE ser diferente da outra, explorando diferentes aspectos do tema. O enunciado de CADA questão deve ser elaborado (3 a 5 linhas), apresentando uma situação-problema ou um contexto técnico profundo antes da pergunta direta.\n  Use linguajar técnico e variado, com termos reais do tema. PROIBIDO repetir a mesma abordagem ou o mesmo tipo de desafio nas 3 questões. Gere EXATAMENTE 3 alternativas no array "options" para cada questão. O campo "answer" deve conter o texto EXATO da alternativa correta. TUDO deve estar preenchido pela IA. Proibido usar placeholders.';

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
${globalInstruction}
- Question Pool: Deixe o array "questionPool" VAZIO. Não gere questões extras.
- Tiro ao Alvo: Gere EXATAMENTE 3 questões. Cada questão deve ter 3 alvos (1 correto, 2 incorretos). Total de 9 targets no array, mas apenas 3 enunciados de questão diferentes.
- ATENÇÃO MECÂNICAS: No campo "gameMechanics", preencha CADA subcampo com texto REAL e específico para o tipo de jogo "${capturedGameType}" e conteúdo "${capturedSubject}". Escreva regras concretas com pelo menos 2 frases por campo.

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
  "gameMechanics": {
    "technicalRules": "[GERE: regras técnicas detalhadas e específicas para ${capturedGameType} com o conteúdo de ${capturedSubject}]",
    "timeControl": "[GERE: tempo específico por rodada/fase/total para ${capturedGameType}]",
    "challengesPerPhase": "[GERE: quantidade e tipo de desafios por fase no ${capturedGameType}]",
    "scoringSystem": "[GERE: pontuação por acerto, penalidade por erro e bônus no ${capturedGameType}]"
  },
  "gameLogic": {
    "howToPlay": "", "timeLimit": "", "levels": "", "difficulty": "",
    "targets": [
      { 
        "question": "Na frase 'Os alunos estudaram para a prova ontem.', qual a função de 'para a prova'?", 
        "title": "Análise Sintática: Adjunto Adverbial", 
        "options": ["Objeto Indireto", "Adjunto Adverbial", "Complemento Nominal"], 
        "answer": "Adjunto Adverbial", 
        "isCorrect": true, 
        "points": 15 
      }
    ],
    ${capturedGameType === 'Roleta' ? '"roletaSegments": [{ "title": "Dica de Ouro", "description": "Lembre-se desta dica", "points": 0, "isCorrect": true }],' : ''}
    "questionPool": [{ "question": "", "options": ["", "", ""], "answer": "" }]
  },
  "quiz": ${capturedGameType === 'Quiz' ? '{ "questions": [{ "question": "", "options": ["","",""], "answer": "" }] }' : 'null'}
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

    const handleExportPDF = async () => {
        const result = await generatePDFBlob('canvas-content', projectTitle || formData.subject || 'Planejamento');
        if (result) {
            result.pdf.save(result.fileName);
        }
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
                <header className="h-20 bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 flex items-center justify-between px-8 z-[70] sticky top-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => isDirty ? setShowUnsavedModal(true) : navigate('/dashboard')}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95 shadow-sm cursor-pointer group"
                            title="Voltar ao Dashboard"
                        >
                            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
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
                                    <button onClick={cancelEditTitle} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-indigo-500 transition-all">
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
                                <button
                                    onClick={handleExportPDF}
                                    className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase transition-all active:scale-95 shadow-sm cursor-pointer"
                                >
                                    <FolderDown className="w-4 h-4" />
                                    PDF
                                </button>
                                <button
                                    onClick={handleSave}
                                    className={`flex items-center gap-3 px-8 py-3 rounded-2xl font-black text-[10px] tracking-[0.2em] uppercase transition-all active:scale-95 shadow-xl shadow-indigo-600/10 cursor-pointer ${
                                        isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                                    } text-white`}
                                >
                                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-white-500" /> : <Save className="w-4 h-4" />}
                                    {isViewMode ? 'ATUALIZAR' : 'SALVAR'}
                                </button>
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
                            userHasModifiedRef.current = true;
                            setFormData(prev => {
                                const next = typeof updater === 'function' ? updater(prev) : updater;
                                formDataRef.current = next;
                                return next;
                            });
                        }}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        onPdfChange={handlePdfChange}
                        pdfFileName={pdfFileName}
                        hasPdf={!!pdfBase64}
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white rounded-[3rem] p-10 max-w-sm w-full shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] border border-white relative overflow-hidden"
                    >
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner shadow-white">
                                <AlertTriangle className="w-8 h-8 text-amber-500 stroke-[2.5]" />
                            </div>

                            <div className="text-center mb-10">
                                <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase">Sair sem salvar?</h3>
                                <p className="text-slate-500 font-medium text-sm leading-relaxed px-2">
                                    Existem alterações pendentes. Se você sair agora, todo o progresso não salvo será <span className="text-rose-500 font-bold">perdido permanentemente</span>.
                                </p>
                            </div>

                            <div className="w-full space-y-3">
                                <button
                                    onClick={() => setShowUnsavedModal(false)}
                                    className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98] cursor-pointer"
                                >
                                    Continuar Editando
                                </button>
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="w-full py-5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-[0.98] cursor-pointer border border-slate-100 hover:border-rose-100"
                                >
                                    Sair mesmo assim
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default GeneratorPage;