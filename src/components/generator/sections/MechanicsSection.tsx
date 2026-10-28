/**
 * Seção 4 — Mecânicas e Tarefas.
 *
 * Mostra os campos de regras técnicas, controle de tempo, desafios por fase
 * e sistema de pontuação. Caso o projeto antigo tenha esses campos vazios
 * ou marcados como "[GERE: ...]", aplica um conjunto de fallbacks específico
 * por tipo de jogo, para que o usuário sempre veja algo útil na tela.
 *
 * Quando o jogo é Plataforma 2D, exibe também o campo "Itens Coletáveis".
 */
import React from "react";
import { Award, Cog, Gem, LayoutList, Timer } from "lucide-react";
import { Field } from "../shared/Field";
import { SectionCard } from "../shared/SectionCard";

// ─── Fallbacks por tipo de jogo (texto exibido quando IA não preencheu) ──────
const FALLBACKS: Record<string, Record<string, string>> = {
  Roleta: {
    technicalRules: "Girar a roleta e responder à pergunta da casa correspondente.",
    timeControl: "30 segundos por pergunta.",
    challengesPerPhase: "Desafios de múltipla escolha e casas de dica/penalidade.",
    scoringSystem: "+15 pontos por acerto e -10 por penalidade.",
  },
  Quiz: {
    technicalRules: "Responder às perguntas de múltipla escolha em sequência.",
    timeControl: "30 segundos por pergunta.",
    challengesPerPhase: "Desafios de dificuldade progressiva.",
    scoringSystem: "+15 pontos por acerto.",
  },
  Tabuleiro: {
    technicalRules: "Lançar dados, avançar casas e responder a perguntas para permanecer na casa.",
    timeControl: "20 segundos por pergunta.",
    challengesPerPhase: "Casas comuns, de azar (armadilha) e casas bônus.",
    scoringSystem: "+15 por acerto e -10 por armadilha.",
  },
  Memoria: {
    technicalRules: "Encontrar os pares corretos de cartas virando duas por vez.",
    timeControl: "15 segundos por tentativa.",
    challengesPerPhase: "Encontrar todos os pares temáticos na tela.",
    scoringSystem: "+10 pontos por par correto e -2 por erro.",
  },
  "Jogo de Tiro ao Alvo": {
    technicalRules: "Atingir os alvos corretos e evitar alvos inimigos.",
    timeControl: "45 segundos por fase.",
    challengesPerPhase: "Fases com alvos mais rápidos e em maior quantidade.",
    scoringSystem: "+15 por acerto e -10 por erro.",
  },
  "Jogo de Plataforma 2D": {
    technicalRules: "Controlar o personagem, desviar de obstáculos e responder desafios nos checkpoints.",
    timeControl: "3 minutos por fase.",
    challengesPerPhase: "3 fases com inimigos e perguntas pedagógicas.",
    scoringSystem: "+10 por item, +20 por inimigo e +50 por chefe.",
  },
  "Jogo da Velha": {
    technicalRules: "Responder corretamente para poder marcar a casa no tabuleiro 3x3.",
    timeControl: "30 segundos por jogada.",
    challengesPerPhase: "Desafios distribuídos pelas 9 casas do tabuleiro.",
    scoringSystem: "+15 por acerto e +30 por completar linha.",
  },
  "Esmaga Palavras": {
    technicalRules: "Selecionar as palavras corretas relacionadas à definição exibida.",
    timeControl: "60 segundos por rodada.",
    challengesPerPhase: "Palavras de complexidade crescente.",
    scoringSystem: "+10 por palavra correta e -5 por erro.",
  },
  "Enigmas Movimento": {
    technicalRules: "Responder para mover o personagem na direção correta e desvendar o enigma.",
    timeControl: "60 segundos por enigma.",
    challengesPerPhase: "Sequência de caminhos e enigmas direcionais.",
    scoringSystem: "+15 por enigma solucionado.",
  },
};

interface MechanicsSectionProps {
  mechanics?: {
    technicalRules: string;
    timeControl: string;
    challengesPerPhase: string;
    feedbackSystem: string;
    scoringSystem: string;
    collectibleItems: string;
  };
  gameType: string;
  onEdit: (field: string, value: any) => void;
}

export const MechanicsSection: React.FC<MechanicsSectionProps> = ({
  mechanics,
  gameType,
  onEdit,
}) => {
  const isPlatformer = gameType.toLowerCase().includes("plataforma");

  /** Procura o fallback correspondente ao gameType atual */
  const getFallback = (field: string): string => {
    const gameKey =
      Object.keys(FALLBACKS).find((k) => gameType.includes(k)) || "";
    return FALLBACKS[gameKey]?.[field] || "";
  };

  /** Lê o valor real do campo ou retorna fallback se vazio/placeholder */
  const getFieldValue = (field: string): string => {
    const val = (mechanics as any)?.[field] || "";
    if (!val || val.startsWith("[GERE:")) return getFallback(field);
    return val;
  };

  const fields: {
    icon: React.ReactNode;
    label: string;
    field: string;
    description: string;
  }[] = [
    {
      icon: <Cog className="w-4 h-4 text-orange-500" />,
      label: "REGRAS TÉCNICAS",
      field: "technicalRules",
      description: "Ações repetitivas e regras estruturais do jogo",
    },
    {
      icon: <Timer className="w-4 h-4 text-orange-500" />,
      label: "CONTROLE DE TEMPO",
      field: "timeControl",
      description: "Tempo por rodada, fase ou duração total",
    },
    {
      icon: <LayoutList className="w-4 h-4 text-orange-500" />,
      label: "DESAFIOS POR FASE",
      field: "challengesPerPhase",
      description: "Quantidade e organização dos desafios em cada fase",
    },
    {
      icon: <Award className="w-4 h-4 text-orange-500" />,
      label: "SISTEMA DE PONTUAÇÃO",
      field: "scoringSystem",
      description: "Regras de pontuação, bônus e penalidades",
    },
  ];

  const renderField = (f: typeof fields[0]) => (
    <div key={f.field} className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        {f.icon}
        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest leading-none">
          {f.label}
        </span>
      </div>
      <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 transition-all focus-within:bg-white focus-within:shadow-md group">
        <Field
          label=""
          value={getFieldValue(f.field)}
          onChange={(val: string) => onEdit(f.field, val)}
        />
        <p className="text-xs text-slate-400 mt-2 opacity-0 group-focus-within:opacity-100 transition-opacity italic">
          {f.description}
        </p>
      </div>
    </div>
  );

  return (
    <SectionCard
      number="4"
      title="Mecânicas e Tarefas"
      icon={<Cog className="w-5 h-5 text-orange-500" />}
      headerColor="bg-orange-50/60 border-orange-100/60"
    >
      <p className="text-xs text-slate-400 font-medium leading-relaxed mb-8 px-1">
        Estipula as regras técnicas e as ações repetitivas do jogo. Define
        controles de tempo, desafios e feedback.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          {fields.slice(0, 2).map(renderField)}
        </div>
        <div className="flex flex-col gap-6">
          {fields.slice(2, 4).map(renderField)}
        </div>

        {/* Itens coletáveis — exclusivo do modo Plataforma */}
        {isPlatformer && (
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2 px-1">
              <Gem className="w-4 h-4 text-amber-500" />
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest leading-none">
                ITENS COLETÁVEIS
              </span>
            </div>
            <div className="canvas-collectibles p-4 rounded-2xl border border-amber-100/50 transition-all focus-within:bg-white focus-within:shadow-md group">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-0.5 canvas-mode-badge rounded text-[8.8px] font-bold uppercase tracking-wider">
                  Modo Plataforma
                </span>
              </div>
              <Field
                label=""
                value={mechanics?.collectibleItems || ""}
                onChange={(val: string) => onEdit("collectibleItems", val)}
              />
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
};
