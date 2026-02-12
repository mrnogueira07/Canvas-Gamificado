import { GoogleGenAI, Type } from "@google/genai";
import { GamifiedCanvas, QuizQuestion, PedagogicalActivity, PedagogicalActivityType } from "../types";

// Helper function to safely get API Key using Vite standard
const getApiKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY;
  }
  return 'AIzaSyCGrutvte9LiXdhC0UOxBaD02Wa8qUM4A8';
};

// Initialize the client
const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
  cleaned = cleaned.replace(/```\s*/g, "");
  return cleaned.trim();
};

interface GenerateParams {
  level: string;
  subject: string;
  year: string;
  bimester: string;
  gameType: string;
  context?: string;
  includeQuiz?: boolean;
  quizCount?: number;
  amountLevels?: number;
}

export const generateCanvasContent = async (params: GenerateParams) => {
  if (!apiKey) {
     console.error("API Key do Gemini não encontrada. Configure VITE_API_KEY nas variáveis de ambiente.");
     throw new Error("API Key do Gemini ausente.");
  }

  // Using gemini-3-pro-preview for complex text tasks (generating educational content)
  const modelId = "gemini-3-pro-preview";
  const levelAmount = params.amountLevels || 5; 
  const isTargetShooting = params.gameType.toLowerCase().includes("tiro ao alvo");
  const isBoardGame = params.gameType.toLowerCase().includes("tabuleiro");
  const isDragDrop = params.gameType.toLowerCase().includes("arrastar");

  let prompt = `
    Atue como um Especialista em Game Design Educacional (BNCC).
    Gere um Roteiro de Jogo Educacional.
    INPUTS: Nível: ${params.level}, Matéria: ${params.subject}, Ano: ${params.year}, Tipo: ${params.gameType}.
    Contexto: ${params.context || "Tema livre"}.
  `;

  if (isTargetShooting) {
    prompt += ` Crie EXATAMENTE ${levelAmount} alvos (misture corretos/incorretos).`;
  } else if (isBoardGame) {
    prompt += ` Crie trilha de tabuleiro com ${Math.max(10, levelAmount)} casas.`;
  } else if (isDragDrop) {
    prompt += ` Crie ${levelAmount} fases de arrastar e soltar.`;
  }

  if (params.includeQuiz) {
    prompt += ` Inclua ${params.quizCount || 5} perguntas de quiz.`;
  }

  // Definição de Schema Simplificada para brevidade, mantendo a estrutura necessária
  const baseSchema = {
    type: Type.OBJECT,
    properties: {
      curriculum: { type: Type.OBJECT, properties: { area: {type:Type.STRING}, year_bimester: {type:Type.STRING}, subject: {type:Type.STRING}, theme: {type:Type.STRING}, bncc_codes: {type:Type.STRING}, bncc_description: {type:Type.STRING}, bibliography: {type:Type.STRING} } },
      style: { type: Type.OBJECT, properties: { genre: {type:Type.STRING}, target_audience: {type:Type.STRING}, narrative_intro: {type:Type.STRING} } },
      gameRules: { type: Type.OBJECT, properties: { total_elements: {type:Type.STRING}, challenge_elements: {type:Type.STRING}, penalty_elements: {type:Type.STRING}, reward_elements: {type:Type.STRING}, gameplay_loop: {type:Type.STRING} } },
      narrative: { type: Type.OBJECT, properties: { synopsis: {type:Type.STRING}, characters: {type:Type.STRING}, flow: {type:Type.STRING}, enemies: {type:Type.STRING}, mechanics: {type:Type.STRING} } },
      content: { type: Type.OBJECT, properties: { intro: {type:Type.STRING}, victory_condition: {type:Type.STRING}, defeat_condition: {type:Type.STRING} } },
      title_suggestion: { type: Type.STRING }
    }
  };

  // Adiciona campos específicos dinamicamente ao schema
  const schemaProps = baseSchema.properties as any;
  
  if (isTargetShooting) {
    schemaProps.targetShooting = {
      type: Type.OBJECT,
      properties: {
        timeLimit: { type: Type.STRING },
        difficulty: { type: Type.STRING },
        levelsCount: { type: Type.STRING },
        targets: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type:Type.STRING}, title: {type:Type.STRING}, description: {type:Type.STRING}, points: {type:Type.NUMBER}, type: {type:Type.STRING} } } }
      }
    };
  }
  if (isBoardGame) {
    schemaProps.boardGame = {
      type: Type.OBJECT,
      properties: {
        totalHouses: { type: Type.NUMBER },
        playersConfig: { type: Type.STRING },
        diceConfig: { type: Type.STRING },
        houses: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { number: {type:Type.NUMBER}, type: {type:Type.STRING}, title: {type:Type.STRING}, description: {type:Type.STRING}, action: {type:Type.STRING} } } }
      }
    };
  }
  if (isDragDrop) {
    schemaProps.dragDrop = {
      type: Type.OBJECT,
      properties: {
        levels: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: {type:Type.STRING}, description: {type:Type.STRING}, pairs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { item: {type:Type.STRING}, zone: {type:Type.STRING} } } } } } }
      }
    };
  }
  if (params.includeQuiz) {
    schemaProps.quiz = {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { question: {type:Type.STRING}, options: {type:Type.ARRAY, items:{type:Type.STRING}}, correctAnswer: {type:Type.INTEGER}, explanation: {type:Type.STRING} } }
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: baseSchema,
        temperature: 0.7,
      },
    });

    return JSON.parse(cleanJson(response.text || "{}"));
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};

export const generateQuiz = async (canvasData: GamifiedCanvas, questionsCount: number) => {
    return [];
};

export const generateGameActivity = async (canvasData: GamifiedCanvas, activityType: PedagogicalActivityType) => {
    throw new Error("Not implemented");
};