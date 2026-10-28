/**
 * Tipos compartilhados pelos componentes de jogo.
 *
 * Todos os arquivos em `games/` aceitam o mesmo conjunto base de props para
 * que o roteador `DocumentView` possa instanciá-los de forma uniforme.
 */
import type { GeneratedContent } from "../../../types";

/**
 * Props base recebidas por todos os componentes de jogo específico.
 *
 * - `targets`: lista de itens/desafios (perguntas, alvos, palavras, pares...)
 * - `gameLogic`: objeto bruto de lógica do jogo, usado por jogos que precisam
 *   de campos extras (puzzles, roletaSegments, thematicHints, etc.)
 * - `onEdit/onAdd/onRemove`: helpers de edição enviados pelo `GeneratorPage`.
 */
export interface GameSectionProps {
  targets: any[];
  gameLogic: GeneratedContent["gameLogic"];
  gameType: string;
  subject: string;
  theme: string;
  onEdit: (field: string, value: any) => void;
  onAdd: (path: string, item: any) => void;
  onRemove: (path: string, index: number) => void;
}

/**
 * Props mínimas para componentes que apenas exibem o preview interativo do
 * jogo (geralmente embaixo da seção de Conteúdo Programático).
 */
export interface GamePreviewProps {
  targets: any[];
}
