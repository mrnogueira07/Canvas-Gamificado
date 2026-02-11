
export type EducationLevel = 'Ensino Fundamental 1' | 'Ensino Fundamental 2' | 'Ensino Médio' | 'Ensino Superior';
export type Bimester = '1º Bimestre' | '2º Bimestre' | '3º Bimestre' | '4º Bimestre';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Índice 0-3
  explanation?: string; // Feedback
}

// Interfaces para Jogos Pedagógicos (Gerador Extra)
export interface CrosswordItem {
  word: string;
  clue: string;
}

export interface WordSearchData {
  words: string[];
  grid?: string[][]; // Matriz opcional se a IA gerar
  gridSize?: number;
}

export interface MemoryPair {
  term: string;
  definition: string;
}

export interface TrueFalseQuestion {
  statement: string;
  isTrue: boolean;
  explanation: string;
}

export type PedagogicalActivityType = 'crossword' | 'wordsearch' | 'memory' | 'truefalse';

export interface PedagogicalActivity {
  type: PedagogicalActivityType;
  title: string;
  data: CrosswordItem[] | WordSearchData | MemoryPair[] | TrueFalseQuestion[];
}

// --- ESTRUTURAS ESPECÍFICAS DE LEVEL DESIGN ---

// TIRO AO ALVO
export interface TargetItem {
  id: string; // identificador único
  title: string; // O que aparece no alvo ou o conceito
  description: string; // Feedback ao acertar
  points: number; // Pontos ganhos ou perdidos (+10, -10)
  type: 'correct' | 'wrong' | 'info'; // Tipo do alvo
}

export interface TargetShootingData {
  timeLimit: string;
  difficulty: string;
  levelsCount: string;
  targets: TargetItem[];
}

// JOGO DE TABULEIRO
export interface BoardHouse {
  number: number;
  type: 'start' | 'info' | 'quiz' | 'setback' | 'bonus' | 'finish';
  title: string; // Ex: "Desafio Matemático" ou "Casa da Sorte"
  description: string; // A pergunta ou a consequência
  action?: string; // Ex: "Volte 2 casas", "Jogue novamente"
}

export interface BoardGameData {
  totalHouses: number; // Fixo em 10
  playersConfig: string; // Ex: "2 Jogadores"
  diceConfig: string; // Ex: "1 Dado de 6 lados (D6)"
  houses: BoardHouse[];
}

// ARRASTAR E SOLTAR (DRAG AND DROP)
export interface DragDropPair {
  item: string; // O objeto que será arrastado (Ex: "Leão")
  zone: string; // A zona correta (Ex: "Animais Selvagens")
}

export interface DragDropLevel {
  title: string; // Ex: "Fase 1: Classificação Básica"
  description: string; // Ex: "Arraste os animais para seu habitat correto."
  pairs: DragDropPair[];
}

export interface DragDropData {
  levels: DragDropLevel[];
}

// Estrutura de Regras/Lógica do Jogo (Genérica)
export interface GameRules {
  total_elements: string; 
  challenge_elements: string; 
  penalty_elements: string; 
  reward_elements: string; 
  gameplay_loop: string; 
}

// Estrutura exata baseada nos prints
export interface GamifiedCanvas {
  curriculum: {
    area: string;
    year_bimester: string;
    subject: string;
    theme: string;
    bncc_codes: string;
    bncc_description: string;
    bibliography: string;
  };
  style: {
    genre: string;
    target_audience: string;
    narrative_intro: string;
  };
  
  // Regras Genéricas
  gameRules: GameRules;
  
  // Dados Específicos
  targetShooting?: TargetShootingData;
  boardGame?: BoardGameData;
  dragDrop?: DragDropData;

  narrative: {
    synopsis: string;
    characters: string;
    flow: string;
    enemies: string;
    mechanics: string;
  };
  content: {
    intro: string;
    victory_condition: string;
    defeat_condition: string;
  };
  title_suggestion?: string;
  quiz?: QuizQuestion[];
  activities?: PedagogicalActivity[];
}

export interface ScriptItem {
  id: string;
  userId: string;
  title: string;
  subject: string;
  level: EducationLevel;
  year: string;
  bimester: Bimester;
  gameType: string;
  includeQuiz: boolean;
  questionsCount: number;
  ideaText: string;
  
  generatedContent?: GamifiedCanvas;
  
  lastModified: any; 
  createdAt: any; 
  status: 'active' | 'deleted';
}

export interface User {
  uid: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export type AppView = 'dashboard' | 'create_script' | 'view_script' | 'library' | 'settings';
