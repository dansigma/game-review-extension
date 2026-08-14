import { LICHESS_GAME_ID_RE } from "./lichessExport.ts";

export const LICHESS_GAME_HINT_PT = "Partida selecionada na página do Lichess.";
export const PGN_LOAD_HINT_PT = "PGN colado.";
export const NO_GAME_HINT_PT =
  "Abra uma partida no Lichess e use o botão na página.";

export type GameLoadSource = "lichess" | "pgn";

export function gameCardHint(source: GameLoadSource | null): string {
  if (source === "pgn") {
    return PGN_LOAD_HINT_PT;
  }
  if (source === "lichess") {
    return LICHESS_GAME_HINT_PT;
  }
  return NO_GAME_HINT_PT;
}

/** Session/tab id only — not a pasted PGN hash or export target. */
export function isLichessSessionGameId(gameId: string | null): boolean {
  return gameId !== null && LICHESS_GAME_ID_RE.test(gameId);
}

export function isPgnDerivedGameId(gameId: string): boolean {
  return gameId.startsWith("pgn:");
}
