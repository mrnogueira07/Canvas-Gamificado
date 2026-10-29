// Componente da Pagina do Gerador
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratorSidebar } from '../components/generator/GeneratorSidebar';
import { DocumentView, DocumentViewErrorBoundary } from '../components/generator/DocumentView';
import type { GeneratorFormData, GeneratedContent } from '../types';
import { CheckCircle, AlertTriangle, Sliders, FileText, ArrowLeft, Gamepad2, BookOpen, Layers3, RefreshCw } from 'lucide-react';
import { model } from '../lib/gemini';
import type { Part } from '@google/generative-ai';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resolveRouteParams, encryptRoute } from '../lib/routeCrypto';
import { auth, db, storage } from '../lib/firebase';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import mammoth from 'mammoth';
import '../styles/generator.css';


let cachedBnccPdfBase64: string | null = null;
let bnccFetchPromise: Promise<string | null> | null = null;

const fetchBnccPdf = (): Promise<string | null> => {
    if (cachedBnccPdfBase64) return Promise.resolve(cachedBnccPdfBase64);
    if (bnccFetchPromise) return bnccFetchPromise;

    bnccFetchPromise = (async () => {
        try {
            const pathRef = storageRef(storage, 'consulta BNCC/BNCC_EI_EF_110518_versaofinal_site.pdf');
            const downloadUrl = await getDownloadURL(pathRef);
            const res = await fetch(downloadUrl);
            if (!res.ok) throw new Error('Failed to fetch BNCC PDF from secure URL');
            const blob = await res.blob();
            
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    cachedBnccPdfBase64 = base64String;
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.warn('BNCC PDF da nuvem não pôde ser carregado diretamente (utilizando base nativa do Gemini):', err);
            bnccFetchPromise = null; // allow retry
            return null;
        }
    })();

    return bnccFetchPromise;
};
const extractTextFromJsonLikeString = (str: string): string => {
    const cleanStr = str.trim();
    if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
        const keyRegex = /(?:"(?:text|texto|option|opcao|value|valor|resposta)"|'(?:text|texto|option|opcao|value|valor|resposta)')\s*:\s*(?:"([^"]*)"|'([^']*)')/i;
        const match = cleanStr.match(keyRegex);
        if (match) {
            return match[1] || match[2] || '';
        }
        const anyQuoteRegex = /(?:"([^"]*)"|'([^']*)')/g;
        const keys = ['text', 'texto', 'option', 'opcao', 'value', 'valor', 'resposta', 'iscorrect', 'points', 'feedback'];
        let m;
        while ((m = anyQuoteRegex.exec(cleanStr)) !== null) {
            const val = m[1] || m[2];
            if (val && !keys.includes(val.toLowerCase())) {
                return val;
            }
        }
    }
    return '';
};

// Limpa e trata os dados que chegam da IA pra nao quebrar a tela
// Transforma tudo em string pra evitar os erros do React com objetos
const unpackJsonText = (parsed: unknown): string => {
    if (!parsed || typeof parsed !== 'object') return '';
    const obj = parsed as Record<string, unknown>;
    const keysToCheck = ['text', 'texto', 'option', 'opcao', 'value', 'valor', 'resposta'];
    for (const key of keysToCheck) {
        if (key in obj && obj[key] !== undefined && obj[key] !== null) {
            return String(obj[key]);
        }
    }
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string' && val.trim().length > 0) {
            return val;
        }
    }
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'number' || typeof val === 'boolean') {
            return String(val);
        }
    }
    return '';
};

const toStr = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            try {
                const parsed = JSON.parse(trimmed);
                return toStr(parsed);
            } catch {
                /* ignore json parse failure */
            }
        }
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object') {
                    const unpacked = unpackJsonText(parsed);
                    if (unpacked) return toStr(unpacked);
                } else if (typeof parsed === 'string') {
                    return toStr(parsed);
                }
            } catch {
                const extracted = extractTextFromJsonLikeString(trimmed);
                if (extracted) return toStr(extracted);
            }
        }
        return v;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(toStr).join(', ');
    if (typeof v === 'object') {
        const unpacked = unpackJsonText(v);
        if (unpacked) return toStr(unpacked);
    }
    try { return JSON.stringify(v); } catch { return ''; }
};
const toStrArr = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(toStr);
    if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map(toStr);
                }
            } catch {
                /* ignore json parse failure */
            }
        }
        return v.split('\n').filter(Boolean);
    }
    return [];
};

// Mapeia a área do conhecimento conforme a regra pedida pelo usuário
function mapAreaDoConhecimento(gradeLevel?: string, subject?: string): string | null {
    if (!gradeLevel && !subject) return null;

    const level = (gradeLevel || "").trim().toLowerCase();
    const sub = (subject || "").trim().toLowerCase();

    // Remove acentuação e caracteres especiais para facilitar a comparação
    const normalizeText = (text: string) => {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    const normSub = normalizeText(sub);

    if (level.includes("médio") || level.includes("medio")) {
        if (["historia", "geografia", "sociologia", "filosofia"].includes(normSub)) {
            return "CIÊNCIAS HUMANAS E SOCIAIS APLICADAS";
        }
        if (["quimica", "biologia", "fisica"].includes(normSub)) {
            return "CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS";
        }
        if (normSub === "matematica") {
            return "MATEMÁTICA E SUAS TECNOLOGIAS";
        }
        if (["lingua portuguesa", "portugues", "lingua inglesa", "ingles", "lingua espanhola", "espanhol", "educacao fisica", "artes", "arte"].includes(normSub)) {
            return "LINGUAGENS E SUAS TECNOLOGIAS";
        }
    } else if (level.includes("fundamental 1") || level.includes("fundamental 2") || level.includes("fundamental")) {
        if (["geografia", "historia"].includes(normSub)) {
            return "CIÊNCIAS HUMANAS";
        }
        if (normSub === "ciencias") {
            return "CIÊNCIAS";
        }
        if (normSub === "matematica") {
            return "MATEMÁTICA";
        }
        if (["lingua portuguesa", "portugues", "lingua inglesa", "ingles", "educacao fisica", "arte", "artes", "ensino religioso"].includes(normSub)) {
            return "LINGUAGENS";
        }
    }
    return null;
}

// Da uma limpada no conteudo que a IA gerou ou que veio do banco
// Garante que todo texto da tela seja de fato texto (string)
function sanitizeContent(input: unknown, gameType?: string, gradeLevel?: string, subject?: string): Record<string, unknown> {
    // Se a IA acabar devolvendo uma lista, a gente pega logo o primeiro item pra nao dar ruim
    let data: Record<string, unknown>;
    if (Array.isArray(input)) {
        data = (input[0] && typeof input[0] === 'object') ? (input[0] as Record<string, unknown>) : {};
    } else if (input && typeof input === 'object') {
        data = input as Record<string, unknown>;
    } else {
        data = {};
    }

    data.creativeTitle = toStr(data.creativeTitle);

    // Garante que a parte do curriculo exista pra nao bugar
    if (!data.curriculumRelation || typeof data.curriculumRelation !== 'object') {
        data.curriculumRelation = { area: '', yearAndQuarter: '', subject: '', theme: '', bnccSkills: '', skillsDescription: '', bibliography: '' };
    }
    const cr = data.curriculumRelation as Record<string, unknown>;
    cr.area = toStr(cr.area);
    cr.yearAndQuarter = toStr(cr.yearAndQuarter);
    cr.subject = toStr(cr.subject);
    cr.theme = toStr(cr.theme);

    // Mapeia e sobresscreve a Área do Conhecimento se necessário
    const mappedArea = mapAreaDoConhecimento(gradeLevel, subject || (cr.subject as string));
    if (mappedArea) {
        cr.area = mappedArea;
    }
    
    // Separa bem o codigo da BNCC e a descricao pra ficar arrumadinho
    const rawBncc = toStr(cr.bnccSkills).trim();
    const bnccCodes = rawBncc.match(/[A-Z]{2}\d{2}[A-Z]{2,3}\d{2,3}/gi);
    if (bnccCodes && bnccCodes.length > 0) {
        const formattedCodes = Array.from(new Set(bnccCodes.map(code => code.toUpperCase()))).join(", ");
        cr.bnccSkills = formattedCodes;
        
        const cleanDesc = toStr(cr.skillsDescription).trim();
        if (!cleanDesc && bnccCodes.length === 1) {
            const separatorIndex = rawBncc.toUpperCase().indexOf(bnccCodes[0].toUpperCase()) + bnccCodes[0].length;
            const extraText = rawBncc.substring(separatorIndex).replace(/^[\s\-:;),.]+/, '').trim();
            if (extraText) {
                cr.skillsDescription = extraText;
            }
        }
    } else {
        cr.bnccSkills = rawBncc;
    }
    
    cr.skillsDescription = toStr(cr.skillsDescription);
    cr.bibliography = toStr(cr.bibliography);

    // Garante que o estilo do jogo venha certinho
    if (!data.gameStyle || typeof data.gameStyle !== 'object') {
        data.gameStyle = { genre: gameType || 'Nao Definido', targetAudience: '', narrative: '' };
    }
    const gs = data.gameStyle as Record<string, unknown>;

    // Se o usuario escolheu o tipo de jogo, nao deixa a IA mudar
    const safeGameType = toStr(gameType);
    if (safeGameType.trim() !== '') {
        gs.genre = safeGameType;
    } else {
        gs.genre = toStr(gs.genre) || 'Nao Definido';
    }
    gs.targetAudience = toStr(gs.targetAudience);
    gs.narrative = toStr(gs.narrative);

    // Previne erros criando o enredo caso venha vazio
    if (!data.gamePlot || typeof data.gamePlot !== 'object') {
        data.gamePlot = { synopsis: '', characters: '', gameFlow: '', obstacles: '', mechanics: '' };
    }
    const gp = data.gamePlot as Record<string, unknown>;
    gp.synopsis = toStr(gp.synopsis);
    gp.characters = toStr(gp.characters);
    gp.gameFlow = toStr(gp.gameFlow);
    gp.obstacles = toStr(gp.obstacles);
    gp.mechanics = toStr(gp.mechanics);

    // Garante a base do conteudo programatico
    if (!data.programmaticContent || typeof data.programmaticContent !== 'object') {
        data.programmaticContent = { intro: '', winCondition: '', loseCondition: '' };
    }
    const pc = data.programmaticContent as Record<string, unknown>;
    pc.intro = toStr(pc.intro);
    pc.winCondition = toStr(pc.winCondition);
    pc.loseCondition = toStr(pc.loseCondition);

    // O mesmo cuidado com as mecanicas do jogo
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

    // Prepara a estrutura pras regras do jogo
    if (!data.gameLogic || typeof data.gameLogic !== 'object') {
        data.gameLogic = { howToPlay: '', targets: [] };
    }
    const gl = data.gameLogic as Record<string, unknown>;
    gl.howToPlay = toStr(gl.howToPlay);
    gl.developerNotes = toStr(gl.developerNotes);
    const normalizedType = toStr(gameType);
    const howToPlayStr = gl.howToPlay as string;
    if (!howToPlayStr || howToPlayStr.trim() === '') {
        const tutorials: Record<string, string> = {
            'Esmaga Palavras': 'Encontre as palavras ocultas no grid de letras! Leia a dica pedagógica (descrição/contexto) para saber qual palavra procurar. Em seguida, localize a palavra no tabuleiro de letras e selecione-a para esmagá-la. Encontre as 3 palavras corretas para vencer o desafio!',
            'Sliding Puzzle': 'Resolva o quebra-cabeça deslizante para liberar os desafios! No modo Clássico, deslize as peças numeradas até ordená-las de 1 a 8. No modo Unblock, deslize os blocos de madeira para liberar o caminho do bloco chave roxo até a saída. Conclua o puzzle para liberar as perguntas de fixação!',
            'Jogo de Tiro ao Alvo': 'Mire e atire no alvo que contém a resposta correta para a pergunta exibida no topo. Acerte os alvos corretos para acumular pontos e conclua todas as rodadas!',
            'Quiz': 'Responda às perguntas de múltipla escolha selecionando a alternativa correta. Analise cada questão com atenção e tente obter a pontuação máxima!',
            'Memoria': 'Encontre os pares correspondentes! Vire as cartas e associe o conceito pedagógico correto à sua respectiva descrição ou imagem correspondente.',
            'Jogo de Plataforma 2D': 'Controle o personagem pelas plataformas, desvie dos obstáculos e chegue até os checkpoints de desafio. Responda corretamente às perguntas para liberar o caminho e vencer!',
            'Roleta': 'Gire a roleta para receber perguntas, dicas ou penalidades. Responda corretamente para ganhar pontos e avançar!',
            'Quebra-Cabeca': 'Responda aos desafios pedagógicos para liberar peças do quebra-cabeça. Encaixe todas as peças e monte a imagem completa para vencer!',
            'Tabuleiro': 'Jogue os dados e avance pelas casas do tabuleiro. Cada casa possui um desafio ou pergunta pedagógica sobre a matéria que você deve responder corretamente para continuar avançando até a linha de chegada!',
            'Jogo da Velha': 'Desafie o adversário respondendo às perguntas. Cada acerto permite que você marque seu símbolo (X ou O) no tabuleiro. Complete uma linha de três símbolos iguais para ganhar!',
            'Arrastar e Soltar': 'Na tela você verá elementos (palavras, conceitos ou imagens) que devem ser arrastados e encaixados nas suas zonas de destino corretas. Clique e segure um elemento, arraste-o até a área de encaixe correspondente e solte para confirmar. Encaixe todos os elementos nos lugares certos para completar o desafio e avançar no jogo!'
        };
        gl.howToPlay = tutorials[normalizedType] || 'Leia as regras e responda corretamente às perguntas pedagógicas para vencer o jogo e concluir o desafio!';
    }
    // Regex que elimina prefixos de lista/alternativas como a), b), 1., º, -, • etc.
    const OPTION_PREFIX_REGEX = /^\s*(?:[a-zA-Z0-9º°]+\s*[).-]\s*|[-*•]\s*)/;
    const stripOptionPrefix = (s: string) =>
        normalizedType === 'Memoria' ? s.replace(OPTION_PREFIX_REGEX, '').trim() : s;
    if (Array.isArray(gl.targets)) {
        const isTiroAlvoAlreadyExpanded =
            normalizedType === 'Jogo de Tiro ao Alvo' &&
            (gl.targets.length > 3 || (gl.targets as Record<string, unknown>[]).some(t => t.isCorrect === false));

        gl.targets = (gl.targets as Record<string, unknown>[]).flatMap(t => {
            const rawQuestion = toStr(t.question || t.pergunta || t.enunciado);
            const rawTitle = toStr(t.title);

            // Prefere rawQuestion se estiver definido. Se não, usa rawTitle como fallback.
            const finalQuestion = rawQuestion || rawTitle;
            const finalTitle = rawTitle || (finalQuestion ? finalQuestion.split(/[.?]/)[0] + '.' : '');

            // Força isCorrect para jogos que não devem ter penalidades
            const forceCorrect = normalizedType === 'Arrastar e Soltar' || normalizedType === 'Quiz' || normalizedType === 'Jogo de Plataforma 2D';

            let finalOptions = toStrArr(t.options);
            let finalAnswer = toStr(t.answer);
            let isQuestion = true;

            if (normalizedType === 'Tabuleiro') {
                const titleLabel = toStr(t.title || '').toUpperCase();
                const isPenalty = t.isCorrect === false;
                const isCuriosity = t.isCorrect !== false && (
                    titleLabel === 'CURIOSIDADE' ||
                    titleLabel === 'DICA' ||
                    titleLabel === 'INFORMACAO' ||
                    titleLabel === 'CONCEITO' ||
                    titleLabel === 'INFORMATIVO' ||
                    !t.options ||
                    toStrArr(t.options).length === 0
                );
                if (isPenalty || isCuriosity) {
                    isQuestion = false;
                }
            }

            if (isQuestion && ['Jogo de Plataforma 2D', 'Quiz', 'Jogo de Tiro ao Alvo', 'Sliding Puzzle', 'Jogo da Velha', 'Roleta', 'Tabuleiro', 'Arrastar e Soltar'].includes(normalizedType)) {
                if (finalOptions.length < 3) {
                    finalOptions = [
                        finalOptions[0] || 'Alternativa Correta',
                        finalOptions[1] || 'Alternativa Incorreta 1',
                        finalOptions[2] || 'Alternativa Incorreta 2'
                    ];
                } else if (finalOptions.length > 3) {
                    finalOptions = finalOptions.slice(0, 3);
                }
                if (!finalAnswer || !finalOptions.includes(finalAnswer)) {
                    finalAnswer = finalOptions[0];
                }
            } else if (!isQuestion) {
                finalOptions = [];
                finalAnswer = '';
            }

            if (normalizedType === 'Jogo de Tiro ao Alvo') {
                if (isTiroAlvoAlreadyExpanded) {
                    // Se já estiver expandido, apenas sanitiza os campos individuais
                    return [{
                        ...t,
                        title: finalTitle,
                        question: finalQuestion,
                        description: toStr(t.description || t.feedback || (t.isCorrect ? "Excelente! Esta resposta está correta." : "Esta opção está incorreta.")),
                        feedback: "",
                        options: finalOptions,
                        answer: finalAnswer,
                        points: typeof t.points === 'number' ? t.points : (t.isCorrect ? 20 : -10),
                        isCorrect: t.isCorrect !== undefined ? Boolean(t.isCorrect) : true
                    }];
                }

                const wrongOptions = finalOptions.filter(o => o !== finalAnswer);
                const wrong1 = wrongOptions[0] || "Alternativa Incorreta 1";
                const wrong2 = wrongOptions[1] || "Alternativa Incorreta 2";

                return [
                    {
                        ...t,
                        title: finalAnswer,
                        question: finalQuestion,
                        description: "Excelente! Esta resposta está correta.",
                        feedback: "",
                        options: finalOptions,
                        answer: finalAnswer,
                        points: 20,
                        isCorrect: true
                    },
                    {
                        ...t,
                        title: wrong1,
                        question: finalQuestion,
                        description: "Esta opção está incorreta conforme o conteúdo.",
                        feedback: "",
                        options: finalOptions,
                        answer: finalAnswer,
                        points: -10,
                        isCorrect: false
                    },
                    {
                        ...t,
                        title: wrong2,
                        question: finalQuestion,
                        description: "Desafio extra! Esta opção também está incorreta.",
                        feedback: "",
                        options: finalOptions,
                        answer: finalAnswer,
                        points: -10,
                        isCorrect: false
                    }
                ];
            }

            let sanitizedTitle = stripOptionPrefix(finalTitle);
            let sanitizedQuestion = stripOptionPrefix(finalQuestion);
            let finalDesc = stripOptionPrefix(toStr(t.description || t.feedback));

            if (normalizedType === 'Esmaga Palavras') {
                // Para Esmaga Palavras, garante palavra maiúscula, sem espaços
                sanitizedTitle = sanitizedTitle.replace(/\s/g, '').toUpperCase();
                sanitizedQuestion = sanitizedTitle;
                if (!finalDesc) {
                    finalDesc = `Definição pedagógica sobre a palavra "${sanitizedTitle || 'Palavra'}".`;
                }
            }

            let defaultPoints = 15;
            if (normalizedType === 'Tabuleiro' && !isQuestion) {
                const isPenalty = t.isCorrect === false;
                defaultPoints = isPenalty ? -10 : 0;
            }

            const parsedPoints = typeof t.points === 'number' ? t.points : (t.points !== undefined ? Number(t.points) : NaN);
            const finalPoints = isNaN(parsedPoints) ? defaultPoints : parsedPoints;

            return [{
                ...t,
                // Para Memória: remove prefixos ("a)", "1.", "º", "-", "•") da frente e do verso da carta
                title: sanitizedTitle,
                question: sanitizedQuestion,
                description: finalDesc,
                feedback: finalDesc,
                answer: normalizedType === 'Esmaga Palavras' ? sanitizedTitle : finalAnswer,
                options: finalOptions,
                points: finalPoints,
                isCorrect: forceCorrect ? true : (t.isCorrect !== undefined ? Boolean(t.isCorrect) : true),
            }];
        });
    } else {
        gl.targets = [];
    }

    if (Array.isArray(gl.questionPool)) {
        gl.questionPool = (gl.questionPool as Record<string, unknown>[]).map(q => {
            let opts = toStrArr(q.options);
            if (opts.length < 3) {
                opts = [
                    opts[0] || 'Alternativa Correta',
                    opts[1] || 'Alternativa Incorreta 1',
                    opts[2] || 'Alternativa Incorreta 2'
                ];
            } else if (opts.length > 3) {
                opts = opts.slice(0, 3);
            }
            const ans = toStr(q.answer);
            return {
                question: toStr(q.question),
                options: opts,
                answer: opts.includes(ans) ? ans : opts[0]
            };
        });
    }

    if (data.quiz && typeof data.quiz === 'object') {
        const quiz = data.quiz as Record<string, unknown>;
        if (Array.isArray(quiz.questions)) {
            quiz.questions = (quiz.questions as Record<string, unknown>[]).map(q => {
                let opts = toStrArr(q.options);
                if (opts.length < 3) {
                    opts = [
                        opts[0] || 'Alternativa Correta',
                        opts[1] || 'Alternativa Incorreta 1',
                        opts[2] || 'Alternativa Incorreta 2'
                    ];
                } else if (opts.length > 3) {
                    opts = opts.slice(0, 3);
                }
                const ans = toStr(q.answer);
                return {
                    ...q,
                    question: toStr(q.question),
                    answer: opts.includes(ans) ? ans : opts[0],
                    options: opts,
                };
            });

            if (normalizedType === 'Quiz') {
                // Só reconstrói a partir de quiz.questions se gl.targets estiver vazio ou sem perguntas reais.
                // Isso evita sobrescrever targets editados pelo usuário com o quiz gerado pela IA antiga.
                const targetsList = gl.targets as Record<string, unknown>[];
                const existingTargetsHaveData = Array.isArray(gl.targets) &&
                    targetsList.length > 0 &&
                    targetsList.some(t => toStr(t.question || t.title).trim().length > 10);

                if (!existingTargetsHaveData) {
                    gl.targets = (quiz.questions as Record<string, unknown>[]).map((q, i: number) => ({
                        title: `Pergunta ${i + 1}`,
                        question: q.question,
                        options: q.options,
                        answer: q.answer,
                        isCorrect: true,
                        points: 15,
                        description: "Clique para editar o feedback explicativo."
                    }));
                }
            }
        } else {
            quiz.questions = [];
        }
    }

    if (normalizedType === 'Roleta') {
        if (Array.isArray(gl.roletaSegments)) {
            gl.roletaSegments = (gl.roletaSegments as Record<string, unknown>[]).map(seg => ({
                title: toStr(seg.title || "Casa"),
                description: toStr(seg.description || "Conteúdo"),
                isCorrect: seg.isCorrect !== undefined ? Boolean(seg.isCorrect) : true,
                points: typeof seg.points === 'number' ? seg.points : (seg.isCorrect === false ? -10 : 0)
            }));
        } else {
            gl.roletaSegments = [];
        }
    }

    return data;
}
// ───────────────────────────────────────────────────────────────────────────

const GeneratorPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const returnPath = '/projetos';
    const returnLabel = 'Voltar para Meus Projetos';

    // Controle de abas para visualização adaptativa no celular / tablet
    const [mobileTab, setMobileTab] = useState<'form' | 'document'>('form');

    // Estado para armazenar os dados do formulario
    const [formData, setFormData] = useState<GeneratorFormData>({
        gradeLevel: '',
        subject: '',
        year: '',
        quarter: '',
        gameType: '',
        additionalContext: ''
    });

    // SOLUCAO: refs que sempre refletem os valores atuais sem stale closures
    const formDataRef = useRef<GeneratorFormData>(formData);
    const pendingGameTypeRef = useRef<string>(formData.gameType);

    // Impede que loadProject (async) sobrescreva formData apos mudancas do usuario
    const projectHasLoadedRef = useRef(false);
    const userHasModifiedRef = useRef(false);

    // Estados para o conteudo gerado e carregamento
    const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
    const [showSavedBanner, setShowSavedBanner] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [showRecreateConfirmModal, setShowRecreateConfirmModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [saveNotice, setSaveNotice] = useState<string | null>(null);

    // Rastreia se o usuario alterou parametros do formulario apos uma geracao existente
    // Quando true, exibe o botao "Atualizar Canvas" na sidebar
    const [hasParamChanges, setHasParamChanges] = useState(false);

    // ─── REF CRÍTICA: sempre sincronizada IMEDIATAMENTE (não espera re-render) ───
    // Atualizada explicitamente em cada handler de mutação, garantindo que
    // handleSave leia sempre a versão mais recente, mesmo antes do re-render.
    const generatedContentRef = useRef<GeneratedContent | null>(null);

    // Titulo do projeto (editavel)
    const [projectTitle, setProjectTitle] = useState('');
    const projectTitleRef = useRef('');

    const [pdfBase64, setPdfBase64] = useState<string | null>(null);
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);
    const [pdfTextContent, setPdfTextContent] = useState<string | null>(null);
    const [isExtractingPdf, setIsExtractingPdf] = useState(false);
    const [projectCreatedAt, setProjectCreatedAt] = useState<string | null>(null);

    // SINCRONIZACAO IMEDIATA: Garante que refs tenham sempre o valor mais atual do estado
    // Isso evita qualquer "atraso" do useEffect em cliques rapidos.
    formDataRef.current = formData;
    pendingGameTypeRef.current = formData.gameType;

    // Aviso do navegador ao tentar fechar a aba ou recarregar durante geracao ou edicao pendente
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isGenerating || isDirty) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isGenerating, isDirty]);
    // NOTA: generatedContentRef.current NÃO é sincronizado aqui automaticamente.
    // Ele é atualizado explicitamente em cada mutação (handleContentUpdate,
    // handleAddItem, handleRemoveItem, handleGenerate, loadProject) para
    // garantir que handleSave sempre leia o valor mais recente.

    const handlePdfChange = async (base64: string | null, name: string | null) => {
        setPdfBase64(base64);
        setPdfFileName(name);
        setIsDirty(true);
        if (generatedContentRef.current) {
            setHasParamChanges(true);
        }
        if (base64) {
            setIsExtractingPdf(true);
            setMobileTab('document');
            try {
                const fileExt = name?.toLowerCase().split('.').pop() || '';
                if (fileExt === 'docx') {
                    // Para arquivos Word (.docx), extrai o texto no cliente usando o mammoth
                    const byteCharacters = atob(base64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const arrayBuffer = byteArray.buffer;
                    const res = await mammoth.extractRawText({ arrayBuffer });
                    setPdfTextContent((res.value || '').split('\0').join(''));
                } else {
                    // Para PDFs, continua utilizando o Gemini para extrair texto
                    const prompt = "Você é um assistente de extração de dados pedagógicos. Transcreva de forma muito detalhada e fiel todo o conteúdo relevante de texto deste documento (BNCC, habilidades, conceitos, definições, listas de palavras, perguntas e respostas, explicações, fórmulas e textos didáticos). Não omita nenhum conteúdo de texto.";
                    const parts = [
                        { text: prompt },
                        { inlineData: { mimeType: 'application/pdf', data: base64 } }
                    ];
                    const result = await model.generateContent({
                        contents: [{ role: 'user', parts }]
                    });
                    const text = result.response.text();
                    setPdfTextContent((text || '').split('\0').join(''));
                }
            } catch (err) {
                console.error("Erro ao extrair texto do documento de referência:", err);
            } finally {
                setIsExtractingPdf(false);
            }
        } else {
            setPdfTextContent(null);
        }
    };

    const wasGeneratingQuestionRef = useRef(false);

    useEffect(() => {
        if (isGeneratingQuestion) {
            wasGeneratingQuestionRef.current = true;
        } else if (wasGeneratingQuestionRef.current) {
            wasGeneratingQuestionRef.current = false;
            setTimeout(() => {
                const cards = document.querySelectorAll('[data-question-card]');
                if (cards.length > 0) {
                    const lastCard = cards[cards.length - 1];
                    lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [isGeneratingQuestion]);

    // Sincroniza o ref do titulo apenas quando o estado do titulo realmente muda,
    // evitando overwrites causados por re-renders intermediarios de outros estados (ex: isSaving).
    useEffect(() => {
        projectTitleRef.current = projectTitle;
    }, [projectTitle]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty || isGenerating || isGeneratingQuestion) {
                e.preventDefault();
                e.returnValue = 'A geração está em andamento ou existem alterações não salvas. Deseja mesmo sair?';
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty, isGenerating, isGeneratingQuestion]);

    // Carrega projeto de Firestore ou localStorage
    useEffect(() => {
        const routeData = resolveRouteParams(searchParams);
        const projectId = routeData.id;
        if (routeData.isLegacy && projectId) {
            setSearchParams({ p: encryptRoute({ id: projectId, from: routeData.from }) }, { replace: true });
        }
        if (projectId && projectId === savedProjectId) {
            // Already loaded/saved this project, no need to re-fetch
            return;
        }
        if (!projectId) {
            // Reset to creation mode
            setFormData({
                gradeLevel: '',
                subject: '',
                year: '',
                quarter: '',
                gameType: '',
                additionalContext: ''
            });
            generatedContentRef.current = null;
            setGeneratedContent(null);
            setSavedProjectId(null);
            setIsViewMode(false);
            setProjectTitle('');
            setPdfFileName(null);
            setPdfBase64(null);
            setProjectCreatedAt(null);
            setIsDirty(false);
            return;
        }

        let cancelled = false;  // Previne race condition: se o usuario mudou algo antes do getDoc terminar, ignora
        projectHasLoadedRef.current = false;
        userHasModifiedRef.current = false;

        const loadProject = async () => {
            try {
                // Tenta primeiro o Firestore se o usuario estiver logado
                if (auth.currentUser) {
                    const docRef = doc(db, 'projects', projectId);
                    const docSnap = await getDoc(docRef);

                    // PROTECAO: abandona se o usuario ja modificou o form enquanto esperava
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
                        const sanitized = sanitizeContent(project.content || {}, project.formData?.gameType || project.gameType || '', project.formData?.gradeLevel, project.formData?.subject) as unknown as GeneratedContent;
                        generatedContentRef.current = sanitized;
                        setGeneratedContent(sanitized);
                        setSavedProjectId(projectId);
                        setIsViewMode(true);
                        setProjectTitle(project.title);
                        projectTitleRef.current = project.title;
                        setPdfFileName(project.pdfFileName || null);
                        setPdfBase64(project.pdfBase64 || null);
                        setPdfTextContent(project.pdfTextContent || null);
                        setProjectCreatedAt(project.createdAt || null);
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
                    const sanitized = sanitizeContent(project.content || {}, project.formData?.gameType || '', project.formData?.gradeLevel, project.formData?.subject) as unknown as GeneratedContent;
                    generatedContentRef.current = sanitized;
                    setGeneratedContent(sanitized);
                    setSavedProjectId(projectId);
                    setIsViewMode(true);
                    const title = toStr(project.title || project.formData?.additionalContext || project.formData?.subject || 'Planejamento').split('\n')[0];
                    setProjectTitle(title);
                    projectTitleRef.current = title;
                    setPdfFileName(project.pdfFileName || null);
                    setPdfBase64(project.pdfBase64 || null);
                    setPdfTextContent(project.pdfTextContent || null);
                    setProjectCreatedAt(project.createdAt || null);
                }
            } catch (err) {
                console.warn('Erro ao carregar projeto:', err);
            }
        };

        loadProject();
        return () => { cancelled = true; };  // Cleanup: marca como cancelado se o effect re-executar
    }, [searchParams, savedProjectId]);

    // Atualiza titulo quando formData muda (modo criacao)
    useEffect(() => {
        if (!isViewMode && !projectTitle) {
            const derived = toStr(formData.additionalContext || formData.subject || '').split('\n')[0];
            setProjectTitle(derived);
            projectTitleRef.current = derived;
        }
    }, [formData, isViewMode, projectTitle]);

    // ─── handleSave: usa generatedContentRef.current que é atualizado de forma síncrona ───
    const handleSave = async () => {
        // Força o blur no elemento ativo para garantir que campos em edição disparem onChange
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        // Aguarda o React processar os eventos de blur → onChange → setState
        // (os handlers são síncronos, mas o React pode fazer batching)
        await new Promise(r => setTimeout(r, 300));

        // generatedContentRef.current é atualizado SINCRONAMENTE em cada mutação
        // então aqui sempre temos o valor mais recente, independente de re-renders.
        const contentToSave = generatedContentRef.current;
        if (!contentToSave) return false;

        // Também captura o título mais recente via ref
        const titleToSave = projectTitleRef.current || formDataRef.current.subject || 'Novo Planejamento';

        setIsSaving(true);
        try {
            const projectId = savedProjectId || doc(collection(db, 'projects')).id;
            const currentFormData = formDataRef.current;
            const user = auth.currentUser;

            // --- Lógica de Nomenclatura Única ---
            let finalTitleToSave = titleToSave;
            let wasRenamed = false;
            let baseTitle = titleToSave;
            
            // Remove sufixos como " (1)" da base, caso já tenha
            const match = titleToSave.match(/^(.*?)\s*\(\d+\)$/);
            if (match) {
                baseTitle = match[1];
            }

            const storedLocal = localStorage.getItem('gamecanvas_projects');
            const existingProjectsLocal = storedLocal ? JSON.parse(storedLocal) : [];

            let counter = 1;
            let currentTitle = finalTitleToSave;

            while (true) {
                const existsLocal = existingProjectsLocal.some((p: { id?: string; title?: string }) => p.id !== projectId && p.title === currentTitle);
                let existsFire = false;

                if (!existsLocal && user) {
                    try {
                        const titleQuery = query(collection(db, 'projects'), where('userId', '==', user.uid), where('title', '==', currentTitle));
                        const snapshot = await getDocs(titleQuery);
                        existsFire = snapshot.docs.some(d => d.id !== projectId);
                    } catch (err) {
                        console.warn("Erro ao checar titulo no firestore", err);
                    }
                }

                if (existsLocal || existsFire) {
                    currentTitle = `${baseTitle} (${counter})`;
                    counter++;
                    wasRenamed = true;
                } else {
                    break;
                }
            }

            finalTitleToSave = currentTitle;

            if (wasRenamed) {
                setProjectTitle(finalTitleToSave);
                projectTitleRef.current = finalTitleToSave;
            }
            // ------------------------------------

            const projectData = {
                id: projectId,
                userId: user?.uid || 'local',
                title: finalTitleToSave,
                subject: currentFormData.subject,
                grade: currentFormData.gradeLevel,
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                formData: currentFormData,
                content: contentToSave,
                color: 'bg-violet-500',
                order: Date.now(),
                pdfFileName: pdfFileName,
                pdfBase64: pdfBase64,
                pdfTextContent: pdfTextContent,
                authorName: user?.displayName || user?.email?.split('@')[0] || '',
                authorPhoto: user?.photoURL || null,
                authorEmail: user?.email || ''
            };

            if (user) {
                setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    name: user.displayName || user.email?.split('@')[0] || 'Educador(a)',
                    email: user.email || '',
                    photoURL: user.photoURL || null,
                    updatedAt: new Date(),
                }, { merge: true }).catch(() => {});
            }

            // Se o ID mudou (por exemplo, ao subir um PDF ou renomear), remove o antigo
            if (savedProjectId && savedProjectId !== projectId) {
                if (user) {
                    try {
                        await deleteDoc(doc(db, 'projects', savedProjectId));
                    } catch (err) {
                        console.error('Erro ao deletar documento antigo no Firestore:', err);
                    }
                }
                const stored = localStorage.getItem('gamecanvas_projects');
                if (stored) {
                    try {
                        const existingProjects = JSON.parse(stored);
                        const filtered = existingProjects.filter((p: { id: string }) => p.id !== savedProjectId);
                        localStorage.setItem('gamecanvas_projects', JSON.stringify(filtered));
                    } catch (err) {
                        console.error('Erro ao remover projeto antigo do localStorage:', err);
                    }
                }
            }

            const cleanLargeFields = (data: Record<string, unknown>, forceAggressive = false) => {
                let cleaned = false;
                if (data.pdfBase64) { data.pdfBase64 = null; cleaned = true; }
                const content = data.content as Record<string, unknown> | undefined;
                const gameLogic = content?.gameLogic as Record<string, unknown> | undefined;
                if (gameLogic) {
                    const refImages = gameLogic.referenceImages;
                    if (Array.isArray(refImages) && refImages.length > 0) {
                        gameLogic.referenceImages = [];
                        cleaned = true;
                    }
                    if (gameLogic.puzzleImageUrl) {
                        gameLogic.puzzleImageUrl = "";
                        cleaned = true;
                    }
                    const puzzles = gameLogic.puzzles;
                    if (Array.isArray(puzzles) && puzzles.length > 0) {
                        puzzles.forEach((p: unknown) => {
                            if (p && typeof p === 'object') {
                                (p as Record<string, unknown>).imageUrl = "";
                            }
                        });
                        cleaned = true;
                    }
                }

                const limit = forceAggressive ? 50000 : 150000;

                // Fallback de segurança absoluto: remove qualquer string gigante que tenha passado (como imagens em base64 em locais inesperados)
                const stripHugeStrings = (obj: unknown) => {
                    if (!obj || typeof obj !== 'object') return;
                    const record = obj as Record<string, unknown>;
                    for (const key of Object.keys(record)) {
                        const val = record[key];
                        if (typeof val === 'string' && val.length > limit) {
                            record[key] = "";
                            cleaned = true;
                        } else if (Array.isArray(val)) {
                            for (let i = 0; i < val.length; i++) {
                                const item = val[i];
                                if (typeof item === 'string' && item.length > limit) {
                                    val[i] = "";
                                    cleaned = true;
                                } else if (typeof item === 'object') {
                                    stripHugeStrings(item);
                                }
                            }
                        } else if (typeof val === 'object') {
                            stripHugeStrings(val);
                        }
                    }
                };
                stripHugeStrings(data);

                // Firestore não suporta arrays aninhados. Previne crash substituindo por arrays vazios.
                const removeNestedArrays = (obj: unknown) => {
                    if (!obj || typeof obj !== 'object') return;
                    const record = obj as Record<string, unknown>;
                    for (const key of Object.keys(record)) {
                        const val = record[key];
                        if (Array.isArray(val)) {
                            for (let i = 0; i < val.length; i++) {
                                const item = val[i];
                                if (Array.isArray(item)) {
                                    val[i] = [];
                                    cleaned = true;
                                } else if (typeof item === 'object') {
                                    removeNestedArrays(item);
                                }
                            }
                        } else if (typeof val === 'object') {
                            removeNestedArrays(val);
                        }
                    }
                };
                removeNestedArrays(data);

                return cleaned;
            };

            // Salva no Firestore se logado
            if (user) {
                const projectDataCopy = JSON.parse(JSON.stringify(projectData));
                
                // Remove caracteres nulos (\u0000) que causariam erro no Firestore
                const stripNullBytes = (obj: unknown) => {
                    if (!obj || typeof obj !== 'object') return;
                    const record = obj as Record<string, unknown>;
                    for (const key of Object.keys(record)) {
                        const val = record[key];
                        if (typeof val === 'string') {
                            record[key] = val.split('\0').join('');
                        } else if (Array.isArray(val)) {
                            record[key] = val.map((item: unknown) => {
                                if (typeof item === 'string') {
                                    return item.split('\0').join('');
                                } else if (item && typeof item === 'object') {
                                    stripNullBytes(item);
                                    return item;
                                }
                                return item;
                            });
                        } else if (val && typeof val === 'object') {
                            stripNullBytes(val);
                        }
                    }
                };
                stripNullBytes(projectDataCopy);

                const sizeEstimate = JSON.stringify(projectDataCopy).length;
                
                if (sizeEstimate > 800000) {
                    cleanLargeFields(projectDataCopy);
                }

                try {
                    await setDoc(doc(db, 'projects', projectId), projectDataCopy);
                } catch (dbError: unknown) {
                    let needsRetry = cleanLargeFields(projectDataCopy, true);

                    // Se a remoção agressiva ainda não sinalizou mudanças e o PDF de texto for enorme (ou falhou por causa dele)
                    if (!needsRetry && projectDataCopy.pdfTextContent) {
                        projectDataCopy.pdfTextContent = "";
                        needsRetry = true;
                    }

                    if (needsRetry) {
                        console.warn('Erro ao salvar com arquivos pesados, tentando sem eles (limpeza agressiva):', dbError);
                        await setDoc(doc(db, 'projects', projectId), projectDataCopy);
                    } else {
                        throw dbError;
                    }
                }
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

            try {
                localStorage.setItem('gamecanvas_projects', JSON.stringify(existingProjects));
            } catch (localErr) {
                console.warn('Erro ao salvar no localStorage (cota excedida), tentando sem arquivos grandes:', localErr);
                const cleanProjects = existingProjects.map((p: Record<string, unknown>) => {
                    if (p.id === projectId) {
                        const cleaned = JSON.parse(JSON.stringify(p));
                        cleanLargeFields(cleaned);
                        return cleaned;
                    }
                    return p;
                });
                try {
                    localStorage.setItem('gamecanvas_projects', JSON.stringify(cleanProjects));
                } catch (secondLocalErr) {
                    console.error('Falha crítica no localStorage:', secondLocalErr);
                }
            }

            setSavedProjectId(projectId);
            setSearchParams({ p: encryptRoute({ id: projectId }) }, { replace: true });
            setIsViewMode(true);
            setIsDirty(false);
            setShowSavedBanner(true);
            setTimeout(() => setShowSavedBanner(false), 3000);

            if (wasRenamed) {
                setSaveNotice(`Projeto salvo com sucesso! Já existia um projeto com este nome. O arquivo foi salvo como "${finalTitleToSave}" para evitar confusão.`);
            }
            return true;
        } catch (error: unknown) {
            console.error('Erro ao salvar:', error);
            const errDetail = error instanceof Error ? error.message : String(error);
            setErrorMessage(`Erro ao salvar o projeto. Verifique sua conexão com a internet. Se o problema persistir, pode ser que o tamanho do arquivo ou das imagens de referência seja grande demais para salvar no servidor.\n\nDetalhes do erro: ${errDetail}`);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndExit = async () => {
        setErrorMessage(null);
        setShowUnsavedModal(false);
        const success = await handleSave();
        if (success) {
            navigate(returnPath);
        }
    };

    // Instrucoes especificas de gameLogic por tipo de jogo
    const getGameLogicInstruction = (gameType: string): string => {
        const map: Record<string, string> = {
            'Jogo de Tiro ao Alvo': 'Crie EXATAMENTE 3 perguntas de múltipla escolha bem curtas, básicas e diretas sobre o tema (máximo 1 frase cada). Cada pergunta deve ter EXATAMENTE 3 alternativas no array "options" (1 correta e 2 distratores) e a resposta exata no campo "answer".',
            'Quiz': 'Crie EXATAMENTE 5 itens. O enunciado DEVE ser uma pergunta super curta, direta e basica (maximo 1 frase) de acordo com o tema. A RESPOSTA CORRETA NUNCA DEVE ESTAR DENTRO DO ENUNCIADO DA PERGUNTA. Gere 3 alternativas curtas.',
            'Memoria': 'Crie EXATAMENTE 3 pares pedagogicos curtos, garantindo que TODOS os pares tenham conteúdo real nos campos. O campo "title" e a frente da carta (pergunta ou termo bem curto). O campo "description" DEVE ser uma descricao muito curta, basica e resumida de uma imagem que represente o termo (ex: "Soldado na trincheira"), pois no jogo real o aluno devera encontrar o par entre o texto e a imagem correspondente. IMPORTANTE: NÃO inclua prefixos de alternativas como "a)", "b)", "c)" ou numerações em nenhum dos campos.',
            'Arrastar e Soltar': 'Crie EXATAMENTE 3 itens. O enunciado DEVE ser uma pergunta super curta, direta e basica (maximo 1 frase) de acordo com o tema. A RESPOSTA CORRETA NUNCA DEVE ESTAR DENTRO DO ENUNCIADO DA PERGUNTA. Gere 3 alternativas curtas.',
            'Jogo de Plataforma 2D': 'Crie EXATAMENTE 3 obstaculos. O enunciado de cada um DEVE ser uma pergunta super curta e basica de acordo com o tema. A RESPOSTA CORRETA NUNCA DEVE ESTAR DENTRO DO ENUNCIADO. Gere 3 alternativas curtas.',
            'Roleta': 'Em "targets" crie EXATAMENTE 3 *perguntas bem diretas e resumidas* com alternativas curtas. Ja na roleta (roletaSegments), crie EXATAMENTE 4 itens curtos (sendo 2 dicas e 2 penalidades), priorizando as informações do PDF.',
            'Quebra-Cabeca': 'Crie EXATAMENTE 3 desafios. Enunciado direto e curto e 3 opcoes curtas.',
            'Enigmas Movimento': 'Crie EXATAMENTE 3 enigmas seguindo o estilo de desafio pedagogico bem direto, simples e curto.',
            'Tabuleiro': 'Crie EXATAMENTE 10 casas (targets) no total representando as casas do tabuleiro: sendo 5 perguntas de múltipla escolha sobre o tema, 3 curiosidades gamificadas sobre o tema (dicas pedagógicas) e 2 penalidades gamificadas integradas ao tema.',
            'Esmaga Palavras': 'Crie EXATAMENTE 3 palavras curtas e relevantes sobre o tema (uma única palavra por item de até 12 letras, sem frases no campo da palavra). Para cada item: use o campo "title" e o campo "question" para a palavra em si, e o campo "description" e o campo "feedback" para uma definição pedagógica clara e explicativa da palavra (a descrição deve ser preenchida obrigatoriamente e nunca ficar vazia).',
            'Sliding Puzzle': 'Crie EXATAMENTE 3 perguntas de múltipla escolha bem curtas, básicas e diretas (máximo 1 frase cada) sobre o tema. Cada uma deve ter EXATAMENTE 3 alternativas no array "options", a resposta exata no campo "answer", e "isCorrect": true.',
            'Jogo da Velha': 'Crie EXATAMENTE 3 desafios com perguntas bem curtas, basicas e diretas.',
        };
        return map[gameType] || 'Crie EXATAMENTE 3 desafios pedagogicos curtos, basicos e diretas.';
    };

    const handleGenerate = async (arg?: unknown) => {
        const previousCurriculumRelation = generatedContentRef.current?.curriculumRelation;
        // SOLUCAO FINAL: Ignora QUALQUER argumento que venha do onClick (SyntheticEvent)
        // e le os valores exclusivamente do Ref, que agora e sincronizado no ato do setFormData.
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



        const hasPdf = !!capturedPdf || !!pdfTextContent;
        const hasContext = toStr(capturedContext).trim().length > 0;

        // So pra garantir: se tiver faltando algum campo importante, o botao ja deveria estar desabilitado, mas a gente barra aqui tambem
        if (!capturedGameType || !capturedGradeLevel || !capturedSubject || !capturedYear || !capturedQuarter) {
            console.warn('handleGenerate chamado com campos vazios (botao deveria estar desabilitado):',
                { capturedGameType, capturedGradeLevel, capturedSubject, capturedYear, capturedQuarter });
            return;
        }

        if (!hasPdf && !hasContext) {
            return;
        }

        setIsGenerating(true);
        try {
            let finalPdfBase64 = capturedPdf;
            let isUsingBnccCloud = false;

            if (!hasPdf) {
                try {
                    const bnccBase64 = await fetchBnccPdf();
                    if (bnccBase64) {
                        finalPdfBase64 = bnccBase64;
                        isUsingBnccCloud = true;
                    }
                } catch (err) {
                    console.warn('Erro ao carregar BNCC da nuvem', err);
                }
            }

            const isFundamental1 = capturedGradeLevel.toLowerCase().includes("fundamental 1");
            const isFundamental2 = capturedGradeLevel.toLowerCase().includes("fundamental 2");
            const isEnsinoMedio = capturedGradeLevel.toLowerCase().includes("médio") || capturedGradeLevel.toLowerCase().includes("medio");

            const isPdf = pdfFileName?.toLowerCase().endsWith(".pdf");
            const fileTypeLabel = isPdf ? "PDF" : "Word (.docx)";
            const pdfInstruction = pdfTextContent
                ? `O professor enviou um documento de apoio (${fileTypeLabel}). Segue o texto extraído do documento:\n\n${pdfTextContent}\n\nPRIORIDADE MAXIMA: use EXCLUSIVAMENTE o conteudo do documento acima como fonte primaria para todos os campos, especialmente para extrair a habilidade da BNCC (procure por códigos como EF01LP01, EF02MA01, etc. e suas descrições), o conteudo pedagogico, termos tecnicos, exemplos e o campo intro que deve conter a introducao baseada nesse material.`
                : isUsingBnccCloud
                ? `ATENCAO: O usuario nao enviou um material base, mas o PDF anexado e o documento oficial da Base Nacional Comum Curricular (BNCC). Voce DEVE escolher uma habilidade da BNCC correspondente a materia (${capturedSubject}), ano/serie (${capturedYear}) e nivel (${capturedGradeLevel}) diretamente deste PDF. A partir da habilidade que voce escolher, crie um tema de jogo correspondente ("theme") e coloque a sua descricao exata e literal de acordo com o PDF.`
                : '';

            const gameLogicInstruction = getGameLogicInstruction(capturedGameType);

            const expectedQuestionCount = 3;

            const globalInstruction = capturedGameType === 'Roleta'
                ? `- INSTRUCAO ROLETA: Crie UM NOVO ARRAY chamado "roletaSegments" dentro "gameLogic" com EXATAMENTE 4 itens (sendo 2 Dicas e 2 Penalidades). NESTE NOVO ARRAY, E PROIBIDO CRIAR PERGUNTAS OU BONUS. Cada target de "roletaSegments" DEVE ser APENAS "Dica" (texto tematico interativo contendo curiosidades ou conceitos pedagógicos) ou "Penalidade" (crie um pequeno relato narrativo imersivo e bem curto informando algo ruim ou desafiador que aconteceu). O texto deve ser curto e resumido (maximo 1 frase curta) em "description" e o "title" deve ser um resumo curto (2 a 4 palavras). Priorize sempre o conteúdo do PDF como fonte para gerar as dicas e penalidades. Além disso, o ARRAY PADRAO "targets" (5.1) DEVE CONTINUAR EXISTINDO NORMALMENTE E TER EXATAMENTE 3 PERGUNTAS ${isFundamental1 ? 'BEM CURTAS E DIRETAS (maximo 1 frase cada)' : 'ELABORADAS E CONTEXTUALIZADAS (com 2 a 3 frases se necessário)'}, com "options" e "answer" adequadas ao nível de ensino (${capturedGradeLevel}). Insira a numeracao no campo "title" de cada pergunta (ex: "Pergunta 1: Titulo do Tema").`
                : capturedGameType === 'Tabuleiro'
                ? `- INSTRUCAO TABULEIRO: Crie EXATAMENTE 10 casas (targets) no total para o array "targets" do tabuleiro. É TERMINANTEMENTE PROIBIDO criar menos ou mais de 10 casas. O array "targets" deve conter um mix de:\n  1. EXATAMENTE 5 casas de Pergunta (múltipla escolha): o "title" deve ser "Pergunta X", a "question" deve conter uma pergunta ${isFundamental1 ? 'curta e direta' : 'bem elaborada e contextualizada'} sobre o tema, o array "options" deve conter exatamente 3 alternativas, o campo "answer" deve conter o texto exato da resposta correta, "isCorrect" deve ser true, e "points" deve ser 15.\n  2. EXATAMENTE 3 casas de Curiosidade: o "title" deve ser "Curiosidade", a "question" deve conter um texto muito curto com uma curiosidade pedagógica interessante sobre o tema de forma gamificada, o array "options" deve ser vazio ([]), o campo "answer" deve ser vazio (""), "isCorrect" deve ser true, e "points" deve ser 0.\n  3. EXATAMENTE 2 casas de Penalidade: o "title" deve ser "Penalidade", a "question" deve conter um texto gamificado curto com uma penalidade ou obstáculo de acordo com o tema (ex: "Você escorregou no gelo! Volte 2 casas"), o array "options" deve ser vazio ([]), o campo "answer" deve ser vazio (""), "isCorrect" deve ser false, e "points" deve ser -10.\n  IMPORTANTE: Distribua essas 10 casas de forma intercalada ou lógica ao longo do array (ex: pergunta, curiosidade, pergunta, penalidade...) para que o tabuleiro fique dinâmico.`
                : capturedGameType === 'Jogo de Plataforma 2D'
                ? `- INSTRUCAO CRITICA PLATAFORMA 2D: Crie EXATAMENTE 3 targets no array "targets". E ABSOLUTAMENTE PROIBIDO criar 4, 5, 6, 7, 8 ou 9 targets. O limite e 3 e apenas 3.\n  Cada target DEVE TER: "question" com enunciado ${isFundamental1 ? 'super curto, direto e resumido (maximo 1 frase)' : 'bem elaborado e contextualizado (2 a 3 frases se necessário)'}, "options" com EXATAMENTE 3 strings correspondentes, "answer" com o texto exato copiado de dentro de "options", "isCorrect": true, "points": 20.\n  FORMATO OBRIGATORIO DE CADA OPTION: Use frases adequadas ao nível de ensino (${capturedGradeLevel}). PROIBIDO: strings vazias, "Opcao A", "Alternativa 1", ou qualquer placeholder.`
                : `- Instrucao Global para Perguntas: Crie EXATAMENTE ${expectedQuestionCount} perguntas no total para o array "targets" (exceto se instruido de outra forma). E TERMINANTEMENTE PROIBIDO criar menos ou mais de ${expectedQuestionCount} perguntas. Cada uma das ${expectedQuestionCount} questoes DEVE ser diferente da outra, explorando diferentes aspectos do tema. O enunciado de CADA questao deve ser ${isFundamental1 ? 'super curto, direto e resumido (o basico em no maximo 1 frase curta), sem situacoes-problema extensas ou rodeios' : 'elaborado, contextualizado e pedagogicamente aprofundado, com foco em situações-problema ou raciocínio analítico adequado ao nível de ensino (' + capturedGradeLevel + ')'}. Gere EXATAMENTE 3 alternativas no array "options" para cada questao. O campo "answer" deve conter o texto EXATO da alternativa correta. TUDO deve estar preenchido pela IA. Proibido usar placeholders.`;

            const bnccInstruction = isUsingBnccCloud
                ? `- ATENCAO HABILIDADES BNCC: No campo "bnccSkills", insira exatamente o codigo alfanumerico da habilidade geral que voce escolheu do PDF da BNCC anexado (ex: "EF03MA01"). Os campos "bnccSkillsComputing" e "bnccSkillsRegional" sao OPCIONAIS, insira os respectivos codigos apenas se existirem. E expressamente proibido inventar habilidades que nao estejam no PDF.`
                : `- ATENCAO HABILIDADES BNCC: Prioridade 1: Analise o texto do material de apoio enviado e extraia exatamente o código da habilidade da BNCC (ex: "EF03MA01") e sua descrição presentes no documento. Coloque o código no campo "bnccSkills". Prioridade 2: Caso o documento enviado NÃO contenha explicitamente códigos da BNCC, analise o conteúdo pedagógico do documento, busque em sua base de conhecimento as habilidades oficiais da BNCC correspondentes para este tema, ano/série (${capturedYear}) e matéria (${capturedSubject}), e preencha o campo "bnccSkills" com o código da habilidade mais adequada de forma precisa. Os campos "bnccSkillsComputing" e "bnccSkillsRegional" são OPCIONAIS; preencha-os apenas se encontrar correspondentes no documento, senão deixe vazio ("").`;

            let fundamentalInstruction = '';
            if (isFundamental1) {
                fundamentalInstruction = '- ATENCAO ENSINO FUNDAMENTAL 1: Como o público-alvo é do Ensino Fundamental 1 (crianças de anos iniciais), todas as perguntas/enunciados (question), as alternativas de opções de resposta (options), as respostas (answer) e as descrições/feedbacks/explicações (description) DEVEM ser extremamente curtas, simples, diretas e com vocabulário simples de fácil compreensão. Mantenha enunciados com no máximo 6 a 8 palavras e alternativas/opções/respostas com no máximo 2 a 3 palavras. Seja super direto.';
            } else if (isFundamental2) {
                fundamentalInstruction = '- ATENCAO ENSINO FUNDAMENTAL 2: Como o público-alvo é do Ensino Fundamental 2 (anos finais), as perguntas/enunciados (question) e as alternativas devem ser mais elaboradas, completas e contextualizadas pedagogicamente (com aproximadamente 10 a 15 palavras por enunciado), utilizando um vocabulário adequado para pré-adolescentes de forma a testar a compreensão e interpretação deles.';
            } else if (isEnsinoMedio) {
                fundamentalInstruction = '- ATENCAO ENSINO MEDIO: Como o público-alvo é do Ensino Médio, todas as perguntas/enunciados (question), alternativas (options) e descrições/feedbacks/explicações (description) devem ser bem elaboradas, utilizando uma linguagem formal, culta, precisa e analítica (no estilo de questões de pré-vestibular ou ENEM). Os enunciados devem conter contextualizações ricas e completas sobre os conceitos pedagógicos, exigindo leitura analítica e interpretação.';
            }

            const prompt = `Voce e um especialista em gamificacao educacional.
${pdfInstruction}
Crie um planejamento de gamificacao educacional completo com os seguintes dados:
- Nivel: ${capturedGradeLevel}
- Materia: ${capturedSubject}
- Ano: ${capturedYear}
- Bimestre: ${capturedQuarter}
- Tipo de Jogo: ${capturedGameType}
- Regras Especificas: ${gameLogicInstruction}
- Contexto/Ideia do professor: ${capturedContext || '(nao informado, use o PDF como base)'}
${globalInstruction}
- Question Pool: Deixe o array "questionPool" VAZIO. Nao gere questoes extras.
- Jogo de Tiro ao Alvo: Gere EXATAMENTE 3 questões. Cada questão deve ser um objeto com "question" (enunciado curto de 1 frase), "options" (array com 3 alternativas muito curtas, sendo 1 correta e 2 distratores) e "answer" (texto exato da alternativa correta). Não gere alvos duplicados no JSON de retorno; o array "targets" deve conter apenas as 3 questões básicas (a expansão para 3 alvos por questão será feita automaticamente).
- ATENCAO MECANICAS E TAREFAS: No campo "gameMechanics", preencha CADA subcampo com regras e ações extremamente curtas, diretas e objetivas, com o mínimo de texto possível (máximo 6 a 8 palavras por campo). Evite parágrafos ou explicações longas.
${fundamentalInstruction}
- DICAS: Quaisquer dicas geradas para o jogo (como no array "thematicHints") devem ser textos extremamente curtos, simples e resumidos (no máximo 1 frase curta cada, máximo 6 a 8 palavras), em formato de texto resumido para serem listadas uma embaixo da outra.
${bnccInstruction}

Retorne APENAS um JSON valido com esta estrutura:
{
  "creativeTitle": "UM TITULO CRIATIVO E IMPACTANTE EM MAIUSCULAS",
  "curriculumRelation": {
    "area": "[GERE: Área do Conhecimento correspondente. Se Ensino Médio, use apenas: CIÊNCIAS HUMANAS E SOCIAIS APLICADAS, CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS, MATEMÁTICA E SUAS TECNOLOGIAS ou LINGUAGENS E SUAS TECNOLOGIAS. Se Fundamental, use apenas: CIÊNCIAS HUMANAS, CIÊNCIAS, MATEMÁTICA ou LINGUAGENS]", "yearAndQuarter": "${capturedYear} - ${capturedQuarter}", "subject": "${capturedSubject}",
    "theme": "[GERE: Tema principal da aula]",
    "bnccSkills": "[GERE: Habilidade principal da BNCC extraída do PDF ou deduzida do conteúdo, ex: EF03MA01]",
    "bnccSkillsComputing": "[GERE: Habilidade BNCC de Computação se houver, ex: EI03ET07. Se não houver, deixe vazio '']",
    "bnccSkillsRegional": "[GERE: Habilidade Regional se houver. Se não houver, deixe vazio '']",
    "bibliography": "[GERE: Referências bibliográficas extraídas ou sugeridas]"
  },
  "gameStyle": { "genre": "${capturedGameType}", "targetAudience": "${capturedGradeLevel}", "narrative": "" },
  "gamePlot": { "synopsis": "FLUXO DO JOGO: De forma super resumida, direta e basica (o fluxo essencial em ate 1 ou 2 frases curtas), descreva como o aluno avanca e progride no jogo sob a otica da mecanica de '${capturedGameType}'.", "characters": "CHEFES E INIMIGOS / OBSTACULOS: Identifique de forma muito resumida o personagem principal controlado pelo jogador e os elementos de resistencia (chefes, inimigos, obstaculos) que o desafiam. Maximo 1 frase curta.", "gameFlow": "", "obstacles": "", "mechanics": "" },
  "programmaticContent": {
    "intro": "INTRODUCAO (baseado ${capturedPdf ? 'no PDF enviado' : 'no contexto fornecido'}): Escreva uma introducao elaborada e bem construída sobre o tema abordado no jogo, com vocabulário rico. Apesar de elaborada, deve ser relativamente curta (maximo de 2 a 3 frases).",
    "winCondition": "CONDICAO DE VITORIA: Escreva um texto sobre a vitoria que aconteceu no jogo. Explique que o jogador concluiu o desafio com exito.",
    "loseCondition": "CONDICAO DE DERROTA: Escreva um texto sobre a derrota que aconteceu no jogo. Explique que o jogador falhou em concluir os objetivos."
  },
  "gameMechanics": {
    "technicalRules": "[GERE: regra técnica curta (máximo 6 palavras)]",
    "timeControl": "[GERE: tempo curto (máximo 6 palavras)]",
    "challengesPerPhase": "[GERE: desafios curtos (máximo 6 palavras)]",
    "scoringSystem": "[GERE: pontuação curta (máximo 6 palavras)]"
  },
    "gameLogic": {
      "howToPlay": "",
      "targets": ${
        capturedGameType === 'Esmaga Palavras'
          ? `[
        { 
          "title": "[PALAVRA 1: uma única palavra curta oculta relevante para o tema, sem espaços, ex: CLOROFILA]",
          "question": "[Mesma palavra do title]", 
          "description": "[Definição pedagógica detalhada e explicativa da palavra 1]", 
          "feedback": "[Mesma definição do description]", 
          "isCorrect": true, 
          "points": 15
        },
        { 
          "title": "[PALAVRA 2: uma única palavra curta oculta relevante para o tema, sem espaços, ex: FOTOSINTESE]",
          "question": "[Mesma palavra do title]", 
          "description": "[Definição pedagógica detalhada e explicativa da palavra 2]", 
          "feedback": "[Mesma definição do description]", 
          "isCorrect": true, 
          "points": 15
        },
        { 
          "title": "[PALAVRA 3: uma única palavra curta oculta relevante para o tema, sem espaços, ex: ESTOMATO]",
          "question": "[Mesma palavra do title]", 
          "description": "[Definição pedagógica detalhada e explicativa da palavra 3]", 
          "feedback": "[Mesma definição do description]", 
          "isCorrect": true, 
          "points": 15
        }
      ]`
          : capturedGameType === 'Memoria'
          ? `[
        { 
          "title": "[Conceito 1 curto, ex: Mitocôndria]",
          "question": "[Mesmo conceito do title]", 
          "description": "Imagem de [descrição visual simplificada para a carta da mitocôndria]", 
          "feedback": "Imagem de [descrição visual simplificada para a carta da mitocôndria]", 
          "isCorrect": true, 
          "points": 10
        },
        { 
          "title": "[Conceito 2 curto, ex: Cloroplasto]",
          "question": "[Mesmo conceito do title]", 
          "description": "Imagem de [descrição visual simplificada para a carta do cloroplasto]", 
          "feedback": "Imagem de [descrição visual simplificada para a carta do cloroplasto]", 
          "isCorrect": true, 
          "points": 10
        },
        { 
          "title": "[Conceito 3 curto, ex: Ribossomo]",
          "question": "[Mesmo conceito do title]", 
          "description": "Imagem de [descrição visual simplificada para a carta do ribossomo]", 
          "feedback": "Imagem de [descrição visual simplificada para a carta do ribossomo]", 
          "isCorrect": true, 
          "points": 10
        }
      ]`
          : capturedGameType === 'Tabuleiro'
          ? `[
        { 
          "title": "Pergunta 1",
          "question": "[Enunciado da 1a pergunta curta de múltipla escolha]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator]", "[Texto real do 2o distrator]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": 15,
          "description": "[Feedback explicativo]"
        },
        { 
          "title": "Curiosidade",
          "question": "[Uma curiosidade interessante e gamificada sobre o tema da aula]", 
          "options": [], 
          "answer": "", 
          "isCorrect": true, 
          "points": 0,
          "description": "Curiosidade sobre o tema."
        },
        { 
          "title": "Penalidade",
          "question": "[Um contratempo gamificado, ex: Você tropeçou em uma raiz! Volte 1 casa]", 
          "options": [], 
          "answer": "", 
          "isCorrect": false, 
          "points": -10,
          "description": "Penalidade aplicada."
        },
        { 
          "title": "Pergunta 2",
          "question": "[Enunciado da 2a pergunta curta de múltipla escolha]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator]", "[Texto real do 2o distrator]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": 15,
          "description": "[Feedback explicativo]"
        },
        { 
          "title": "Curiosidade",
          "question": "[Outra curiosidade curta e gamificada sobre o tema]", 
          "options": [], 
          "answer": "", 
          "isCorrect": true, 
          "points": 0,
          "description": "Curiosidade sobre o tema."
        },
        { 
          "title": "Pergunta 3",
          "question": "[Enunciado da 3a pergunta curta de múltipla escolha]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator]", "[Texto real do 2o distrator]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": 15,
          "description": "[Feedback explicativo]"
        },
        { 
          "title": "Penalidade",
          "question": "[Outro contratempo gamificado, ex: O vento soprou forte! Volte 2 casas]", 
          "options": [], 
          "answer": "", 
          "isCorrect": false, 
          "points": -10,
          "description": "Penalidade aplicada."
        },
        { 
          "title": "Pergunta 4",
          "question": "[Enunciado da 4a pergunta curta de múltipla escolha]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator]", "[Texto real do 2o distrator]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": 15,
          "description": "[Feedback explicativo]"
        },
        { 
          "title": "Curiosidade",
          "question": "[Mais uma curiosidade curta e gamificada sobre o tema]", 
          "options": [], 
          "answer": "", 
          "isCorrect": true, 
          "points": 0,
          "description": "Curiosidade sobre o tema."
        },
        { 
          "title": "Pergunta 5",
          "question": "[Enunciado da 5a pergunta curta de múltipla escolha]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator]", "[Texto real do 2o distrator]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": 15,
          "description": "[Feedback explicativo]"
        }
      ]`
          : ['Jogo de Plataforma 2D', 'Quiz', 'Tabuleiro', 'Arrastar e Soltar', 'Jogo da Velha', 'Roleta', 'Jogo de Tiro ao Alvo', 'Quebra-Cabeca', 'Enigmas Movimento', 'Sliding Puzzle'].includes(capturedGameType)
          ? `[
        { 
          "title": "Pergunta 1",
          "question": "[Enunciado completo da 1a pergunta]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator plausivel]", "[Texto real do 2o distrator plausivel]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": ${capturedGameType === 'Jogo de Plataforma 2D' ? 20 : 15},
          "description": "[Feedback explicativo detalhado sobre a resposta correta]"
        },
        { 
          "title": "Pergunta 2",
          "question": "[Enunciado completo da 2a pergunta]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator plausivel]", "[Texto real do 2o distrator plausivel]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": ${capturedGameType === 'Jogo de Plataforma 2D' ? 20 : 15},
          "description": "[Feedback explicativo detalhado sobre a resposta correta]"
        },
        { 
          "title": "Pergunta 3",
          "question": "[Enunciado completo da 3a pergunta]", 
          "options": ["[Texto real da alternativa CORRETA]", "[Texto real do 1o distrator plausivel]", "[Texto real do 2o distrator plausivel]"], 
          "answer": "[Texto real da alternativa CORRETA]", 
          "isCorrect": true, 
          "points": ${capturedGameType === 'Jogo de Plataforma 2D' ? 20 : 15},
          "description": "[Feedback explicativo detalhado sobre a resposta correta]"
        }
      ]`
          : '[]'},
      ${capturedGameType === 'Roleta' ? `"roletaSegments": [
        { "title": "[Dica 1: Título Curto]", "description": "[Dica 1: Curiosidade ou conceito pedagógico baseado no PDF]", "isCorrect": true, "points": 0 },
        { "title": "[Penalidade 1: Título Curto]", "description": "[Penalidade 1: Relato narrativo imersivo de obstáculo/setback baseado no PDF]", "isCorrect": false, "points": -10 },
        { "title": "[Dica 2: Título Curto]", "description": "[Dica 2: Curiosidade ou conceito pedagógico baseado no PDF]", "isCorrect": true, "points": 0 },
        { "title": "[Penalidade 2: Título Curto]", "description": "[Penalidade 2: Relato narrativo imersivo de obstáculo/setback baseado no PDF]", "isCorrect": false, "points": -10 }
      ],` : ''}
      "questionPool": [],
      "thematicHints": ${capturedGameType === 'Jogo de Plataforma 2D'
        ? `["[Dica 1 resumida (máximo 6 palavras)]", "[Dica 2 resumida]", "[Dica 3 resumida]", "[Dica 4 resumida]", "[Dica 5 resumida]"]`
        : '[]'}
    }
}`;

            const parts: Part[] = [{ text: prompt }];
            if (pdfTextContent) {
                parts.push({ text: `\n\nTexto do material de apoio:\n${pdfTextContent}` });
            }
            if (finalPdfBase64 && isPdf) {
                parts.push({
                    inlineData: { mimeType: 'application/pdf', data: finalPdfBase64 }
                });
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig: { responseMimeType: 'application/json' }
            });

            const rawText = result.response.text();
            const jsonText = rawText.replace(/```json|```/g, '').trim();
            let parsed: Record<string, unknown>;
            try {
                parsed = JSON.parse(jsonText);
            } catch {
                const match = jsonText.match(/\{[\s\S]*\}/);
                if (match) {
                    parsed = JSON.parse(match[0]);
                } else {
                    throw new Error('JSON inválido retornado pela IA');
                }
            }

            const sanitized = sanitizeContent(parsed, capturedGameType, capturedGradeLevel, capturedSubject) as unknown as GeneratedContent;

            if (previousCurriculumRelation && !hasParamChanges) {
                sanitized.curriculumRelation = JSON.parse(JSON.stringify(previousCurriculumRelation));
            } else if (sanitized.curriculumRelation) {
                if (pdfTextContent || capturedPdf) {
                    sanitized.curriculumRelation.bnccSource = 'pdf';
                } else if (isUsingBnccCloud) {
                    sanitized.curriculumRelation.bnccSource = 'web';
                }
            }

            // Garante o limite estrito inicial de 3 itens para os jogos de múltipla escolha (ou 9 itens para Tiro ao Alvo que possui 3 alvos por pergunta)
            if (Array.isArray(sanitized.gameLogic?.targets)) {
                if (['Memoria', 'Quiz', 'Jogo de Plataforma 2D', 'Esmaga Palavras', 'Sliding Puzzle'].includes(capturedGameType)) {
                    sanitized.gameLogic!.targets = sanitized.gameLogic!.targets.slice(0, 3);
                } else if (capturedGameType === 'Jogo de Tiro ao Alvo') {
                    sanitized.gameLogic!.targets = sanitized.gameLogic!.targets.slice(0, 9);
                }
            }

            // Atualiza ref ANTES do setGeneratedContent para garantir consistência
            generatedContentRef.current = sanitized;
            setGeneratedContent(sanitized);
            setIsViewMode(false);
            setIsDirty(true);
            setHasParamChanges(false);

            const curriculumRel = parsed.curriculumRelation as Record<string, unknown> | undefined;
            const creativeTitle = toStr(parsed.creativeTitle || curriculumRel?.theme || capturedSubject);
            if (creativeTitle) {
                setProjectTitle(creativeTitle);
                projectTitleRef.current = creativeTitle;
            }

        } catch (error: unknown) {
            console.error('Erro ao gerar:', error);
            let userFriendlyMessage = 'Erro ao gerar o planejamento. Tente novamente.';
            if (error instanceof Error) {
                const msg = error.message;
                if (msg.includes('REFERRER_BLOCKED') || msg.includes('403')) {
                    userFriendlyMessage = 'Acesso à API do Gemini restrito por domínio (403). Verifique as permissões de chave no Google Cloud Console.';
                } else if (msg.includes('JSON')) {
                    userFriendlyMessage = 'A IA retornou um formato inválido. Tente novamente ou simplifique o contexto.';
                } else if (msg.includes('quota') || msg.includes('429')) {
                    userFriendlyMessage = 'Limite de uso da IA atingido. Aguarde alguns minutos e tente novamente.';
                } else if (msg.includes('unauthenticated')) {
                    userFriendlyMessage = 'Sessão expirada. Faça login novamente para continuar.';
                } else if (msg.includes('network') || (msg.includes('fetch') && !navigator.onLine)) {
                    userFriendlyMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
                } else {
                    userFriendlyMessage = error.message;
                }
            }
            
            if (typeof error === 'object' && error !== null && 'message' in error) {
                const msg = String((error as { message?: unknown }).message || '');
                if (msg.includes('JSON')) {
                    userFriendlyMessage = `ERRO_JSON_IA: ${userFriendlyMessage}`;
                }
            }
            
            setErrorMessage(userFriendlyMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    // Recriar roteiro com os parametros atuais
    // Captura o gameType via ref (sempre live) ANTES de qualquer setState
    const handleRecreate = () => {
        if (isDirty) {
            setShowRecreateConfirmModal(true);
            return;
        }
        executeRecreate();
    };

    const executeRecreate = () => {
        setShowRecreateConfirmModal(false);
        const gameTypeSnapshot = pendingGameTypeRef.current || formData.gameType;
        setIsViewMode(false);
        // Timeout minimo para garantir que os setStates acima sejam processados
        // antes de iniciar a geracao, evitando qualquer batching inesperado
        setTimeout(() => handleGenerate(gameTypeSnapshot), 0);
    };

    const handleExportPDF = async () => {
        // Garante que o documento está ativo e visível no DOM
        setMobileTab('document');

        const originalTitle = document.title;
        
        const yearFormatted = formData.year ? formData.year.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : 'ANO';
        const quarterStr = formData.quarter ? formData.quarter.replace(/[^0-9]/g, '') : '';
        const quarterFormatted = quarterStr ? `${quarterStr}BIM` : 'BIM';
        const subjectFormatted = formData.subject ? formData.subject.toUpperCase() : 'MATERIA';
        const themeFormatted = projectTitle || 'TEMA';
        
        const newFileName = `CV_${yearFormatted}_${quarterFormatted}_${subjectFormatted}_${themeFormatted}`.toUpperCase();
        
        document.title = newFileName;
        
        // Aguarda a sincronização e renderização completa do DOM
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.title = originalTitle;
            }, 1000);
        }, 150);
    };

    // ─── handleContentUpdate ────────────────────────────────────────────────────
    // Atualiza generatedContentRef SINCRONAMENTE antes de chamar setGeneratedContent,
    // garantindo que handleSave sempre leia o valor mais recente.
    const handleContentUpdate = (section: keyof GeneratedContent, field: string, value: unknown) => {
        if (field === '_projectTitle') {
            // Atualiza título E marca como dirty
            const titleVal = String(value || '');
            setProjectTitle(titleVal);
            projectTitleRef.current = titleVal;
            setIsDirty(true);
            return;
        }

        const setNested = (obj: Record<string, unknown>, path: string, val: unknown) => {
            const keys = path.replace(/\]/g, '').split(/[.[]/);
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]] as Record<string, unknown>;
            }
            current[keys[keys.length - 1]] = val;
        };

        // Cria o novo estado ANTES de chamar setGeneratedContent
        const prev = generatedContentRef.current;
        if (!prev) return;
        const newState = JSON.parse(JSON.stringify(prev)) as GeneratedContent;
        try {
            const targetSection = (newState as unknown as Record<string, unknown>)[section] as Record<string, unknown>;
            if (field.includes('.') || field.includes('[')) {
                setNested(targetSection, field, value);
            } else {
                targetSection[field] = value;
            }
            if (section === 'curriculumRelation' && (field === 'bnccSkills' || field === 'bnccSkillsComputing' || field === 'bnccSkillsRegional')) {
                if (newState.curriculumRelation) {
                    newState.curriculumRelation.bnccSource = 'user';
                }
            }
        } catch (e) {
            console.error("Error updating state field:", field, e);
            return;
        }

        // Atualiza ref SINCRONAMENTE (imediatamente, antes do re-render)
        generatedContentRef.current = newState;
        // Agenda o re-render
        setGeneratedContent(newState);
        // setIsDirty fora do updater (correto)
        setIsDirty(true);
    };

    // ─── handleAddItem ───────────────────────────────────────────────────────────
    const handleAddItem = (section: keyof GeneratedContent, path: string, item: unknown) => {
        const prev = generatedContentRef.current;
        if (!prev) return;
        const newState = JSON.parse(JSON.stringify(prev)) as GeneratedContent;
        let current = (newState as unknown as Record<string, unknown>)[section] as Record<string, unknown>;
        const keys = path.replace(/\]/g, '').split(/[.[]/);
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]] as Record<string, unknown>;
        }
        const lastKey = keys[keys.length - 1];
        const targetArr = current[lastKey];
        if (Array.isArray(targetArr)) {
            targetArr.push(item);
        }

        // Atualiza ref SINCRONAMENTE
        generatedContentRef.current = newState;
        setGeneratedContent(newState);
        setIsDirty(true);
    };

    // ─── handleRemoveItem ────────────────────────────────────────────────────────
    const handleRemoveItem = (section: keyof GeneratedContent, path: string, index: number) => {
        const prev = generatedContentRef.current;
        if (!prev) return;
        const newState = JSON.parse(JSON.stringify(prev)) as GeneratedContent;
        let current = (newState as unknown as Record<string, unknown>)[section] as Record<string, unknown>;
        const keys = path.replace(/\]/g, '').split(/[.[]/);
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]] as Record<string, unknown>;
        }
        const lastKey = keys[keys.length - 1];
        const targetArr = current[lastKey];
        if (Array.isArray(targetArr)) {
            targetArr.splice(index, 1);
        }

        // Atualiza ref SINCRONAMENTE
        generatedContentRef.current = newState;
        setGeneratedContent(newState);
        setIsDirty(true);
    };

    const displayTitle = projectTitle || formData.subject || 'Novo Planejamento';

    return (
        <motion.div
            id="main-page-wrapper"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="generator-workspace flex flex-col overflow-hidden relative print:h-auto print:block print:overflow-visible print:!bg-white"
        >

            <header className="generator-toolbar print:hidden relative z-20">
                <div className="generator-toolbar-brand">
                    <button type="button" aria-label={returnLabel} title={returnLabel} onClick={() => (isDirty || isGenerating) ? setShowUnsavedModal(true) : navigate(returnPath)}><ArrowLeft size={18} /></button>
                    <span className="generator-brand-icon" title="Mind Canvas">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(255, 255, 255, 0.22)" stroke="#ffffff" />
                            <path d="M2 17l10 5 10-5" stroke="#ffffff" />
                            <path d="M2 12l10 5 10-5" stroke="#ffffff" />
                        </svg>
                    </span>
                    <span className="generator-brand-name">MIND CANVAS</span>
                    <span className="generator-toolbar-divider" />
                    <span className="generator-product-name"><Gamepad2 size={17} /> Game Canvas</span>
                </div>
                <div className="generator-document-status"><span className={isDirty ? 'is-unsaved' : ''} />{isExtractingPdf ? 'Analisando roteiro' : isGenerating ? 'Criando seu canvas' : isDirty ? 'Alterações não salvas' : generatedContent ? 'Canvas carregado' : 'Novo projeto'}</div>
            </header>

            {/* ── BARRA DE ABAS MOBILE (Apenas em telas < lg para alternar com facilidade) ── */}
            <div className="generator-mobile-tabs lg:hidden print:hidden flex items-center justify-center px-4 py-2.5 shrink-0 z-30">
                <div className="flex bg-[#161822] border border-[#242738] p-1 rounded-xl w-full max-w-sm">
                    <button
                        type="button"
                        onClick={() => setMobileTab('form')}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            mobileTab === 'form'
                                ? 'bg-white/10 text-white shadow-sm border border-white/10'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Parâmetros</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('document')}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                            mobileTab === 'document'
                                ? 'bg-white/10 text-white shadow-sm border border-white/10'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Visualizar canvas</span>
                        {generatedContent && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10 print:overflow-visible print:h-auto">

                {showSavedBanner && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 text-emerald-800 text-sm z-[70] shrink-0"
                    >
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-bold">Planejamento salvo com sucesso!</span>
                        <button onClick={() => navigate('/meus-roteiros')} className="ml-auto text-emerald-700 underline font-semibold text-xs hover:text-emerald-900">Ver nos projetos</button>
                    </motion.div>
                )}

                <div className="flex flex-1 min-h-0 overflow-hidden relative z-10 items-stretch print:overflow-visible print:block">
                    {/* ── PAINEL DE PARÂMETROS / SIDEBAR (Responsivo Mobile/Desktop) ── */}
                    <div className={`generator-settings-container print:hidden shrink-0 h-full w-full lg:w-auto overflow-y-auto lg:overflow-visible ${
                        mobileTab === 'form' ? 'flex justify-center' : 'hidden lg:flex'
                    }`}>
                        <GeneratorSidebar
                        formData={formData}
                        setFormData={(updater) => {
                            userHasModifiedRef.current = true;
                            setFormData(prev => {
                                const next = typeof updater === 'function' ? updater(prev) : updater;
                                formDataRef.current = next;
                                return next;
                            });
                            // Se ja existe conteudo gerado, sinaliza que os parametros mudaram
                            if (generatedContentRef.current) {
                                setHasParamChanges(true);
                            }
                        }}
                        onGenerate={() => {
                            setMobileTab('document');
                            void handleGenerate();
                        }}
                        isGenerating={isGenerating || isGeneratingQuestion || isExtractingPdf}
                        onPdfChange={handlePdfChange}
                        pdfFileName={pdfFileName}
                        hasPdf={!!pdfBase64 || !!pdfTextContent}
                        pdfBase64={pdfBase64}
                        pdfTextContent={pdfTextContent}
                        viewOnly={isViewMode}
                        onRecreate={handleRecreate}
                        onBack={() => (isDirty || isGenerating) ? setShowUnsavedModal(true) : navigate(returnPath)}
                        hasGeneratedContent={!!generatedContent}
                        onExportPdf={handleExportPDF}
                        onSave={handleSave}
                        isSaving={isSaving}
                        isViewMode={isViewMode}
                        isDirty={isDirty}
                        hasSavedProject={!!savedProjectId}
                        hasParamChanges={hasParamChanges}
                        isExtractingBncc={isExtractingPdf}
                        />
                    </div>

                    {/* ── PAINEL DE VISUALIZAÇÃO DO DOCUMENTO ── */}
                    <main className={`generator-document-area flex-1 min-w-0 p-3 sm:p-7 pb-24 lg:pb-7 overflow-y-auto custom-scrollbar h-full print:!block print:!p-0 print:!overflow-visible print:!h-auto ${
                        mobileTab === 'document' ? 'block' : 'hidden lg:block'
                    }`}>
                        <AnimatePresence mode="wait">
                            {isGenerating || isExtractingPdf ? (
                                <motion.div
                                    key={isExtractingPdf ? "analyzing-document" : "loading"}
                                    initial={{ opacity: 0, scale: 0.96, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96, y: -15 }}
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="h-full w-full flex items-center justify-center min-h-[350px]"
                                >
                                    <div className="generator-loading" role="status" aria-live="polite" aria-busy="true">
                                        <div className="generator-loading-icon"><RefreshCw size={30} className="animate-spin" /></div>
                                        <span className="generator-eyebrow">{isExtractingPdf ? 'ANÁLISE DO MATERIAL' : 'INTELIGÊNCIA CRIATIVA'}</span>
                                        <h2>{isExtractingPdf ? 'Seu roteiro está sendo analisado' : 'Seu canvas está ganhando forma'}</h2>
                                        <p>{isExtractingPdf ? 'Lendo o material de referência e identificando o conteúdo pedagógico para o seu jogo.' : 'Organizando o conteúdo pedagógico, a narrativa e os desafios do seu jogo.'}</p>
                                        <span className="generator-loading-caption">Aguarde nesta tela até a conclusão.</span>
                                    </div>
                                </motion.div>
                            ) : generatedContent ? (
                                <motion.div
                                    key="content"
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -30 }}
                                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                                    className="space-y-3 max-w-6xl mx-auto w-full print:max-w-none print:w-full print:mx-auto"
                                >
                                    <div id="canvas-content" className="generator-document-sheet rounded-xl p-1 print:!bg-white print:shadow-none print:border-none print:rounded-none">
                                        <table className="w-full">
                                            <thead className="hidden print:table-header-group">
                                                <tr><td><div className="h-[5mm]"></div></td></tr>
                                            </thead>
                                            <tfoot className="hidden print:table-footer-group">
                                                <tr><td><div className="h-[10mm]"></div></td></tr>
                                            </tfoot>
                                            <tbody>
                                                <tr>
                                                    <td>
                                                        <DocumentViewErrorBoundary>
                                                            <DocumentView
                                                                content={generatedContent}
                                                                title={displayTitle}
                                                                gameType={formData.gameType}
                                                                onEdit={handleContentUpdate}
                                                                onAdd={handleAddItem}
                                                                onRemove={handleRemoveItem}
                                                                pdfBase64={pdfBase64}
                                                                pdfFileName={pdfFileName}
                                                                pdfTextContent={pdfTextContent}
                                                                onIsGenerating={setIsGeneratingQuestion}
                                                            />
                                                        </DocumentViewErrorBoundary>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.3 }}
                                    className="generator-empty-state"
                                >
                                    <div className="generator-blueprint" aria-hidden="true">
                                        <div className="generator-blueprint-top"><span><Gamepad2 size={17} /> GAME CANVAS</span><i /><i /><i /></div>
                                        <div className="generator-blueprint-title"><span /><span /></div>
                                        <div className="generator-blueprint-grid">
                                            <div><BookOpen size={18} /><b>Objetivos</b><i /><i /><i /></div>
                                            <div><Layers3 size={18} /><b>Mecânicas</b><i /><i /><i /></div>
                                            <div><Gamepad2 size={18} /><b>Desafios</b><i /><i /><i /></div>
                                        </div>
                                        <div className="generator-blueprint-bottom"><span /><span /><span /></div>
                                    </div>
                                    <span className="generator-eyebrow">SEU PRÓXIMO PROJETO COMEÇA AQUI</span>
                                    <h2>Uma boa ideia. Um jogo com propósito.</h2>
                                    <p>Defina o contexto pedagógico e adicione seu conteúdo. Vamos transformá-los em um canvas completo, pronto para revisar e compartilhar.</p>
                                    <div className="generator-empty-features"><span><CheckCircle size={13} /> Alinhamento à BNCC</span><span><CheckCircle size={13} /> Conteúdo editável</span><span><CheckCircle size={13} /> Exportação em PDF</span></div>
                                    <button
                                        type="button"
                                        onClick={() => setMobileTab('form')}
                                        className="lg:hidden mt-6 py-3 px-6 rounded-lg bg-[#6d36d5] text-white font-semibold text-sm active:scale-95 transition-transform flex items-center gap-2"
                                    >
                                        <Sliders className="w-4 h-4" />
                                        <span>Configurar meu jogo</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        {/* ── BARRA DE AÇÕES FLUTUANTE MOBILE (quando houver conteúdo gerado) ── */}
                        {generatedContent && !isExtractingPdf && !isGenerating && (
                            <div className="lg:hidden print:hidden fixed bottom-3 left-3 right-3 z-50 flex items-center justify-center gap-2 bg-slate-950/85 backdrop-blur-2xl border border-white/15 p-2 rounded-2xl shadow-2xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                                <button
                                    type="button"
                                    onClick={() => setMobileTab('form')}
                                    className="flex-1 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                    <span>Parâmetros</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportPDF}
                                    className="py-3 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>PDF</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="py-3 px-5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-purple-500/25 cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>{isSaving ? "Salvando..." : "Salvar"}</span>
                                </button>
                            </div>
                        )}

                        {/* Custom Print Footer */}
                        <div className="canvas-print-footer hidden print:flex fixed bottom-0 left-0 w-full justify-center items-center pb-4 text-[11px] text-slate-400 font-medium uppercase tracking-widest bg-white/0 z-[9999]">
                            {projectCreatedAt ? (
                                <span>CRIADO POR {auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'USUÁRIO'} EM {new Date(projectCreatedAt).toLocaleDateString('pt-BR')} ÀS {new Date(projectCreatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            ) : (
                                <span>CRIADO POR {auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'USUÁRIO'} EM {new Date().toLocaleDateString('pt-BR')} ÀS {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            {/* Modal de Confirmacao para Sair sem Salvar ou durante Geracao */}
            {showUnsavedModal && (
                <div className="generator-confirm-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="generator-confirm-dialog p-8 max-w-sm w-full relative overflow-hidden"
                    >
                        <div className="relative z-10 flex flex-col items-center">
                            <div className={`generator-confirm-icon flex items-center justify-center mb-6 ${
                                isGenerating ? 'bg-rose-50' : 'bg-amber-50'
                            }`}>
                                <AlertTriangle className={`w-9 h-9 stroke-[2.5] ${
                                    isGenerating ? 'text-rose-500' : 'text-amber-500'
                                }`} />
                            </div>

                            <div className="text-center mb-8">
                                <h3 className="generator-confirm-title text-2xl mb-3 tracking-tight">
                                    {isGenerating ? 'Criação em Andamento' : 'Sair sem Salvar?'}
                                </h3>
                                <p className="generator-confirm-description text-sm leading-relaxed px-1">
                                    {isGenerating ? (
                                        <>
                                            Seu planejamento está sendo gerado agora. Se você sair antes de concluir e salvar, o processo será cancelado e você <span className="generator-confirm-warning font-semibold">vai perder o arquivo</span>.
                                        </>
                                    ) : (
                                        <>
                                            Existem alterações pendentes no seu planejamento. Se você sair agora sem salvar, você <span className="generator-confirm-warning font-semibold">vai perder o arquivo</span> e todas as modificações.
                                        </>
                                    )}
                                </p>
                            </div>

                            <div className="w-full space-y-2.5">
                                {isGenerating ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowUnsavedModal(false)}
                                            className="generator-confirm-button generator-confirm-button--primary w-full text-sm"
                                        >
                                            Continuar Aguardando
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsGenerating(false);
                                                setShowUnsavedModal(false);
                                                navigate(returnPath);
                                            }}
                                            className="generator-confirm-button generator-confirm-button--danger w-full text-sm"
                                        >
                                            Sair e Cancelar
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleSaveAndExit}
                                            className="generator-confirm-button generator-confirm-button--primary w-full text-sm"
                                        >
                                            Salvar e Sair
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowUnsavedModal(false);
                                                navigate(returnPath);
                                            }}
                                            className="generator-confirm-button generator-confirm-button--danger w-full text-sm"
                                        >
                                            Sair sem Salvar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowUnsavedModal(false)}
                                            className="generator-confirm-button generator-confirm-button--secondary w-full text-sm"
                                        >
                                            Continuar Editando
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Modal de Confirmacao para Recriar sem Salvar */}
            {showRecreateConfirmModal && (
                <div className="generator-confirm-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="generator-confirm-dialog p-8 max-w-sm w-full relative overflow-hidden"
                    >
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="generator-confirm-icon flex items-center justify-center mb-6">
                                <AlertTriangle className="w-8 h-8 text-amber-500 stroke-[2.5]" />
                            </div>

                            <div className="text-center mb-10">
                                <h3 className="generator-confirm-title text-2xl mb-3 tracking-tight">Recriar canvas?</h3>
                                <p className="generator-confirm-description text-sm leading-relaxed px-2">
                                    Existem alterações pendentes. Se você recriar agora, você <span className="generator-confirm-warning font-semibold">perderá as alterações não salvas</span>. Tem certeza?
                                </p>
                            </div>

                            <div className="w-full space-y-3">
                                <button
                                    onClick={() => setShowRecreateConfirmModal(false)}
                                    className="generator-confirm-button generator-confirm-button--secondary w-full text-sm"
                                >
                                    Continuar Editando
                                </button>
                                <button
                                    onClick={async () => {
                                        await handleSave();
                                        navigate(returnPath);
                                    }}
                                    className="generator-confirm-button generator-confirm-button--primary w-full text-sm"
                                >
                                    Salvar e Sair
                                </button>
                                <button
                                    onClick={executeRecreate}
                                    className="generator-confirm-button generator-confirm-button--danger w-full text-sm"
                                >
                                    Recriar Mesmo Assim
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Modal de Erro */}
            {errorMessage && (
                <div className="generator-confirm-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="generator-confirm-dialog p-8 max-w-sm w-full relative overflow-hidden"
                    >
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="generator-confirm-icon flex items-center justify-center mb-6">
                                <AlertTriangle className="w-8 h-8 text-rose-500 stroke-[2.5]" />
                            </div>
                            <div className="text-center mb-10">
                                <h3 className="generator-confirm-title text-2xl mb-3 tracking-tight">Erro</h3>
                                <p className="generator-confirm-description text-sm leading-relaxed px-2">{errorMessage}</p>
                            </div>
                            <button
                                onClick={() => setErrorMessage(null)}
                                className="generator-confirm-button generator-confirm-button--secondary w-full text-sm"
                            >
                                Fechar
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Aviso de PDF excluido do servidor */}
            {saveNotice && (
                <div className="generator-confirm-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="generator-confirm-dialog p-8 max-w-sm w-full relative overflow-hidden"
                    >
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="generator-confirm-icon flex items-center justify-center mb-6">
                                <AlertTriangle className="w-8 h-8 text-amber-500 stroke-[2.5]" />
                            </div>
                            <div className="text-center mb-10">
                                <h3 className="generator-confirm-title text-2xl mb-3 tracking-tight">Atenção</h3>
                                <p className="generator-confirm-description text-sm leading-relaxed px-2">{saveNotice}</p>
                            </div>
                            <button
                                onClick={() => setSaveNotice(null)}
                                className="generator-confirm-button generator-confirm-button--secondary w-full text-sm"
                            >
                                Entendi
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default GeneratorPage;
