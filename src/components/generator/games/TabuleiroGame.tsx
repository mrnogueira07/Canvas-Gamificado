/**
 * Jogo de Tabuleiro pedagógico.
 *
 * Casas com perguntas e penalidades — o aluno avança pelo tabuleiro
 * respondendo questões. Reaproveita `HouseQuizTargets` para o estilo de
 * "casa de pergunta" (com indicadores de Dica/Pergunta/Penalidade).
 */
import React from "react";
import { HouseQuizTargets } from "../shared/HouseQuizTargets";

interface TabuleiroGameProps {
  targets: any[];
  onEdit: (field: string, value: any) => void;
  onRemove: (path: string, index: number) => void;
}

export const TabuleiroGame: React.FC<TabuleiroGameProps> = ({
  targets,
  onEdit,
  onRemove,
}) => (
  <HouseQuizTargets
    targets={targets}
    gameType="Tabuleiro"
    onEdit={onEdit}
    onRemove={onRemove}
  />
);
