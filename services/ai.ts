
import { GoogleGenAI, Type } from "@google/genai";
import { GamifiedCanvas, QuizQuestion, PedagogicalActivity, PedagogicalActivityType } from "../types";

// A API Key deve vir do environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface GenerateParams {
  level: string;
  subject: string;
  year: string;
  bimester: string;
  gameType: string;
  context?: string;
  includeQuiz?: boolean;
  quizCount?: number;
  amountLevels?: number; // Novo parâmetro para quantidade de fases
}

export const generateCanvasContent = async (params: GenerateParams) => {
  const modelId = "gemini-2.0-flash";
  const gameTypeLower = params.gameType.toLowerCase();
  const isTargetShooting = gameTypeLower.includes("tiro ao alvo");
  const isBoardGame = gameTypeLower.includes("tabuleiro") || gameTypeLower.includes("trilha");
  const isDragDrop = gameTypeLower.includes("arrastar") || gameTypeLower.includes("drag");
  const levelAmount = params.amountLevels || 5; // Default para 5 se não especificado

  let prompt = `
    Atue como um Especialista em Game Design Educacional (focado na BNCC Brasil).
    Gere um Roteiro de Jogo Educacional completo baseado nos inputs.

    INPUTS:
    - Nível: ${params.level}
    - Ano: ${params.year}
    - Matéria: ${params.subject}
    - Bimestre: ${params.bimester}
    - Tipo de Jogo: ${params.gameType}
    - Contexto Extra: ${params.context || "Crie um tema criativo e engajador."}

    REQUISITO DE LÓGICA DE JOGO:
    Você deve criar um modelo lógico de distribuição de elementos para o Tipo de Jogo escolhido.
  `;

  if (isTargetShooting) {
    prompt += `
    ESPECÍFICO PARA TIRO AO ALVO:
    Gere uma estrutura com EXATAMENTE ${levelAmount} ALVOS no total.
    Misture alvos corretos (+pontos) e incorretos (-pontos) dentro dessa quantidade.
    Defina 'levelsCount' como "${levelAmount} Níveis/Alvos".
    `;
  } else if (isBoardGame) {
    prompt += `
    ESPECÍFICO PARA JOGO DE TABULEIRO:
    Crie uma estrutura de TRILHA LINEAR com EXATAMENTE ${Math.max(10, levelAmount)} CASAS FIXAS (Se o usuário pediu menos que 10, use 10. Se pediu mais, use o valor pedido).
    - O jogo é para 2 jogadores usando dados.
    - Casa 1 é SEMPRE "Início".
    - A Última Casa é SEMPRE "Chegada/Vitória".
    - Casas intermediárias devem variar entre: 
      * 'info' (Curiosidade sobre o tema), 
      * 'quiz' (Pergunta sobre o tema, se errar volta casa), 
      * 'setback' (Punição/Obstáculo, ex: perca a vez ou volte casas), 
      * 'bonus' (Avance casas ou jogue novamente).
    `;
  } else if (isDragDrop) {
    prompt += `
    ESPECÍFICO PARA JOGO DE ARRASTAR E SOLTAR (DRAG & DROP):
    Crie uma estrutura com EXATAMENTE ${levelAmount} FASES (Levels).
    - Cada fase deve ter um desafio diferente de associação.
    - Exemplo: Fase 1 (Conceitos Básicos), até Fase ${levelAmount} (Desafio Final).
    - Para cada fase, defina "Pares": O item que é arrastado e a zona onde ele deve ser solto.
    - Use itens variados como palavras, frases curtas, descrições de imagens, números ou animais.
    `;
  } else {
    prompt += `
    Para outros jogos, defina regras genéricas equilibradas no objeto gameRules, considerando aproximadamente ${levelAmount} rodadas ou elementos principais.
    `;
  }

  if (params.includeQuiz) {
    prompt += `
    ALÉM DO CANVAS, GERE UM QUIZ:
    - Crie ${params.quizCount || 5} perguntas de múltipla escolha.
    `;
  }

  // Schema base
  const properties: any = {
    curriculum: {
      type: Type.OBJECT,
      properties: {
        area: { type: Type.STRING },
        year_bimester: { type: Type.STRING },
        subject: { type: Type.STRING },
        theme: { type: Type.STRING },
        bncc_codes: { type: Type.STRING },
        bncc_description: { type: Type.STRING },
        bibliography: { type: Type.STRING }
      },
      required: ["area", "year_bimester", "subject", "theme", "bncc_codes", "bncc_description", "bibliography"]
    },
    style: {
      type: Type.OBJECT,
      properties: {
        genre: { type: Type.STRING },
        target_audience: { type: Type.STRING },
        narrative_intro: { type: Type.STRING }
      },
      required: ["genre", "target_audience", "narrative_intro"]
    },
    gameRules: {
      type: Type.OBJECT,
      description: "Resumo textual das regras",
      properties: {
        total_elements: { type: Type.STRING },
        challenge_elements: { type: Type.STRING },
        penalty_elements: { type: Type.STRING },
        reward_elements: { type: Type.STRING },
        gameplay_loop: { type: Type.STRING }
      },
      required: ["total_elements", "challenge_elements", "penalty_elements", "reward_elements", "gameplay_loop"]
    },
    narrative: {
      type: Type.OBJECT,
      properties: {
        synopsis: { type: Type.STRING },
        characters: { type: Type.STRING },
        flow: { type: Type.STRING },
        enemies: { type: Type.STRING },
        mechanics: { type: Type.STRING }
      },
      required: ["synopsis", "characters", "flow", "enemies", "mechanics"]
    },
    content: {
      type: Type.OBJECT,
      properties: {
        intro: { type: Type.STRING },
        victory_condition: { type: Type.STRING },
        defeat_condition: { type: Type.STRING }
      },
      required: ["intro", "victory_condition", "defeat_condition"]
    },
    title_suggestion: { type: Type.STRING }
  };

  // Schema Específico: Tiro ao Alvo
  if (isTargetShooting) {
    properties.targetShooting = {
      type: Type.OBJECT,
      properties: {
        timeLimit: { type: Type.STRING },
        difficulty: { type: Type.STRING },
        levelsCount: { type: Type.STRING },
        targets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              points: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["correct", "wrong", "info"] }
            },
            required: ["title", "description", "points", "type"]
          }
        }
      },
      required: ["timeLimit", "difficulty", "levelsCount", "targets"]
    };
  }

  // Schema Específico: Jogo de Tabuleiro
  if (isBoardGame) {
    properties.boardGame = {
      type: Type.OBJECT,
      properties: {
        totalHouses: { type: Type.NUMBER, description: `Deve ser ${levelAmount >= 10 ? levelAmount : 10}` },
        playersConfig: { type: Type.STRING, description: "Ex: 2 Jogadores" },
        diceConfig: { type: Type.STRING, description: "Ex: 1 Dado D6" },
        houses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              number: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ['start', 'info', 'quiz', 'setback', 'bonus', 'finish'] },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              action: { type: Type.STRING }
            },
            required: ["number", "type", "title", "description"]
          }
        }
      },
      required: ["totalHouses", "houses"]
    };
  }

  // Schema Específico: Drag and Drop
  if (isDragDrop) {
    properties.dragDrop = {
      type: Type.OBJECT,
      properties: {
        levels: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              pairs: {
                type: Type.ARRAY,
                items: {
                   type: Type.OBJECT,
                   properties: {
                     item: { type: Type.STRING },
                     zone: { type: Type.STRING }
                   },
                   required: ["item", "zone"]
                }
              }
            },
            required: ["title", "description", "pairs"]
          }
        }
      },
      required: ["levels"]
    };
  }

  if (params.includeQuiz) {
    properties.quiz = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.INTEGER },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctAnswer"]
      }
    };
  }

  // Monta lista de required fields dinamicamente
  const requiredFields = ["curriculum", "style", "gameRules", "narrative", "content", "title_suggestion"];
  if (isTargetShooting) requiredFields.push("targetShooting");
  if (isBoardGame) requiredFields.push("boardGame");
  if (isDragDrop) requiredFields.push("dragDrop");
  if (params.includeQuiz) requiredFields.push("quiz");

  const responseSchema = {
    type: Type.OBJECT,
    properties: properties,
    required: requiredFields
  };

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta da IA");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Erro na geração de IA:", error);
    throw error;
  }
};

export const generateQuiz = async (canvasData: GamifiedCanvas, questionsCount: number) => {
  const modelId = "gemini-2.0-flash";
  const prompt = `Baseado no seguinte Roteiro, crie um Quiz com ${questionsCount} perguntas. Contexto: ${canvasData.narrative.synopsis}`;
  
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswer: { type: Type.INTEGER },
        explanation: { type: Type.STRING }
      },
      required: ["question", "options", "correctAnswer"]
    }
  };

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema }
  });
  return JSON.parse(response.text || "[]") as QuizQuestion[];
};

export const generateGameActivity = async (canvasData: GamifiedCanvas, activityType: PedagogicalActivityType): Promise<PedagogicalActivity> => {
    throw new Error("Funcionalidade removida da interface.");
};
