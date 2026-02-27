// Definições de tipos para o sistema de gamificação

// Dados do formulário de entrada
export interface GeneratorFormData {
    gradeLevel: string;      // Nível de Ensino (Fund 1, Fund 2, Médio)
    subject: string;         // Matéria (Matemática, História, etc)
    year: string;            // Ano Escolar
    quarter: string;         // Bimestre
    gameType: string;        // Tipo de Jogo (Quiz, Plataforma, etc)
    additionalContext: string; // Contexto ou ideia inicial do professor
    withQuiz?: boolean;      // Se deve incluir um quiz
    quizQuestionCount?: number; // Quantidade de questões no quiz (max 15)
    wordCount?: number;      // Quantidade de palavras (para Esmaga Palavras)
    phaseCount?: number;     // Quantidade de fases (para Esmaga Palavras)
    smashMode?: 'word' | 'description'; // Modo do Esmaga Palavras
}

// Alvo/Item da lógica do jogo
export interface GameTarget {
    title: string;       // Título do alvo ou afirmação
    description: string; // Descrição ou feedback explicativo
    isCorrect: boolean;  // Correto = verde, Incorreto = vermelho
    points: number;      // Pontos (positivo = ganha, negativo = perde)
    feedback: string;    // Feedback exibido após resposta
    options?: string[];  // Alternativas (para quizes na roleta)
    answer?: string;     // Resposta correta
}

// Estrutura do Conteúdo Gerado pela IA
export interface GeneratedContent {
    // Seção 1: Relação com o Currículo
    curriculumRelation: {
        area: string;            // Área do Conhecimento
        yearAndQuarter: string;  // Ano e Bimestre formatados
        subject: string;         // Disciplina
        theme: string;           // Tema Principal
        bnccSkills: string;      // Códigos da BNCC
        skillsDescription: string; // Descrição das habilidades
        bibliography: string;    // Referências bibliográficas
    };

    // Seção 2: Estilo e Dados do Jogo
    gameStyle: {
        genre: string;           // Gênero do Jogo
        targetAudience: string;  // Público Alvo
        narrative: string;       // Resumo Narrativo
    };

    // Seção 3: Enredo do Jogo (Detalhes Narrativos)
    gamePlot: {
        synopsis: string;        // Sinopse
        characters: string;      // Personagens
        gameFlow: string;        // Fluxo do Jogo
        obstacles: string;       // Obstáculos
        mechanics: string;       // Mecânicas
    };

    // Seção 4: Conteúdo Programático
    programmaticContent: {
        intro: string;           // Introdução (Texto Imersivo)
        winCondition: string;    // Condição de Vitória
        loseCondition: string;   // Condição de Derrota
    };

    // Seção 5: Lógica do Jogo (gerada por tipo de jogo)
    gameLogic: {
        howToPlay: string;       // Regras gerais
        timeLimit: string;       // Tempo limite (ex: "45 segundos")
        levels: string;          // Número de fases/níveis (ex: "3 níveis")
        difficulty: string;      // Sistema de dificuldade (ex: "Progressiva")
        targets: GameTarget[];   // Itens do jogo (alvos, pares, perguntas, peças, etc.)
    };

    // Seção Extra: Quiz
    quiz?: {
        questions: {
            question: string;
            options: string[];
            answer: string;
        }[];
    };
}

// Definição de um Projeto Salvo
export interface Project {
    id: string;
    title: string;
    userId: string;
    formData: GeneratorFormData;
    content: GeneratedContent;
    createdAt: Date;
    updatedAt: string;
}
