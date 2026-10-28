/**
 * Jogo Quiz tradicional.
 *
 * Lista de perguntas com enunciado + 3 alternativas (1 correta + 2 distratores).
 * Reaproveita o componente `HouseQuizTargets` que é compartilhado com outros
 * jogos baseados em pergunta de múltipla escolha.
 *
 * Limite: 10 questões por canvas.
 */
import React from "react";
import { HouseQuizTargets } from "../shared/HouseQuizTargets";

interface QuizGameProps {
  targets: any[];
  onEdit: (field: string, value: any) => void;
  onRemove: (path: string, index: number) => void;
}

export const QuizGame: React.FC<QuizGameProps> = ({
  targets,
  onEdit,
  onRemove,
}) => (
  <HouseQuizTargets
    targets={targets}
    gameType="Quiz"
    onEdit={onEdit}
    onRemove={onRemove}
  />
);
