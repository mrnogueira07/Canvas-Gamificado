/**
 * Índice central dos componentes de jogo.
 *
 * Reexporta cada jogo para que o `DocumentView` possa importá-los todos a
 * partir de um único caminho. Manter os jogos isolados em arquivos próprios
 * facilita manutenção, mas o roteador consome o índice por conveniência.
 */
export { PlataformaGame } from "./PlataformaGame";
export { TiroAlvoGame } from "./TiroAlvoGame";
export { RoletaPreview } from "./RoletaGame";
export { MemoriaGame } from "./MemoriaGame";
export { QuebraCabecaGame } from "./QuebraCabecaGame";
export { SlidingPuzzlePreview } from "./SlidingPuzzleGame";
export { TabuleiroGame } from "./TabuleiroGame";
export {

  EsmagaPalavrasGame,
  EsmagaPalavrasPreview,
} from "./EsmagaPalavrasGame";
export { QuizGame } from "./QuizGame";
export { JogoDaVelhaPreview } from "./JogoDaVelhaGame";
