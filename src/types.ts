// Definições de tipos para o sistema de gamificação

// Dados do formulário de entrada
export interface GeneratorFormData {
  gradeLevel: string; // Nível de Ensino (Fund 1, Fund 2, Médio)
  subject: string; // Matéria (Matemática, História, etc)
  year: string; // Ano Escolar
  quarter: string; // Bimestre
  gameType: string; // Tipo de Jogo (Quiz, Plataforma, etc)
  additionalContext: string; // Contexto ou ideia inicial do professor
  bnccSkill?: string; // Habilidade BNCC extraída do PDF
  withQuiz?: boolean; // Se deve incluir um quiz
  quizQuestionCount?: number; // Quantidade de questões no quiz (max 15)
  wordCount?: number; // Quantidade de palavras (para Esmaga Palavras)
  phaseCount?: number; // Quantidade de fases (para Esmaga Palavras)
  smashMode?: "word" | "description"; // Modo do Esmaga Palavras
}

// Alvo/Item da lógica do jogo
export interface GameTarget {
  title: string; // Título do alvo ou afirmação
  description: string; // Descrição ou feedback explicativo
  isCorrect: boolean; // Correto = verde, Incorreto = vermelho
  points: number; // Pontos (positivo = ganha, negativo = perde)
  feedback: string; // Feedback exibido após resposta
  question?: string; // Pergunta associada (para games baseados em desafios múltiplos)
  options?: string[]; // Alternativas (para quizes na roleta)
  answer?: string; // Resposta correta
}

// Estrutura do Conteúdo Gerado pela IA
export interface GeneratedContent {
  // Seção 1: Relação com o Currículo
  curriculumRelation: {
    area: string; // Área do Conhecimento
    yearAndQuarter: string; // Ano e Bimestre formatados
    subject: string; // Disciplina
    theme: string; // Tema Principal
    bnccSkills: string; // Códigos da BNCC
    skillsDescription: string; // Descrição das habilidades
    bibliography: string; // Referências bibliográficas
    bnccSource?: "web" | "pdf" | "user"; // Fonte da habilidade BNCC
  };

  // Seção 2: Estilo e Dados do Jogo
  gameStyle: {
    genre: string; // Gênero do Jogo
    targetAudience: string; // Público Alvo
    narrative: string; // Resumo Narrativo
  };

  // Seção 3: Enredo do Jogo (Detalhes Narrativos)
  gamePlot: {
    synopsis: string; // Sinopse
    characters: string; // Personagens
    gameFlow: string; // Fluxo do Jogo
    obstacles: string; // Obstáculos
    mechanics: string; // Mecânicas
  };

  // Seção 4: Conteúdo Programático
  programmaticContent: {
    intro: string; // Introdução (Texto Imersivo)
    winCondition: string; // Condição de Vitória
    loseCondition: string; // Condição de Derrota
  };

  // Seção 5: Lógica do Jogo (gerada por tipo de jogo)
  gameLogic: {
    howToPlay: string; // Regras gerais
    timeLimit: string; // Tempo limite (ex: "45 segundos")
    levels: string; // Número de fases/níveis (ex: "3 níveis")
    difficulty: string; // Sistema de dificuldade (ex: "Progressiva")
    targets: GameTarget[]; // Itens do jogo (alvos, pares, perguntas, peças, etc.)
    questionPool?: {
      // Banco de questões reserva extraídas do PDF
      question: string;
      options: string[];
      answer: string;
    }[];
    thematicHints?: string[]; // Dicas sobre a temática (especialmente para plataforma)
    finalQuestions?: {
      // Questões finais (especialmente para plataforma)
      question: string;
      options: string[];
      answer: string;
    }[];
    puzzleImageUrl?: string; // URL da imagem do quebra-cabeça
    puzzleDescription?: string; // Descrição contextual do quebra-cabeça
    puzzlePieceCount?: number; // Contagem legacy do quebra cabeça
    puzzles?: {
      imageUrl: string;
      description: string;
      pieceCount: number;
    }[];
    referenceImages?: string[]; // Array of base64 image strings
    roletaSegments?: any[]; // Segmentos específicos para o preview da roleta (dicas, penalidades, bônus)
  };

  // Seção 6: Mecânicas e Tarefas
  gameMechanics?: {
    technicalRules: string; // Regras técnicas e ações repetitivas
    timeControl: string; // Controle de tempo (ex: "30s por rodada")
    challengesPerPhase: string; // Quantidade de desafios por fase
    feedbackSystem: string; // Como o sistema informa o usuário
    scoringSystem: string; // Sistema de pontuação detalhado
    collectibleItems: string; // Itens coletáveis (especialmente para plataforma)
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
  createdAt: Date | string;
  updatedAt: Date | string;
  folderId?: string | null;
  order?: number;
}
