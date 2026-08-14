import { EPL_THRESHOLDS, type PlayerColor, type ReviewedMove } from "./types.ts";

/** Win% gap PV1−PV2 (same side to move); same floor as inaccuracy EPL (0.1). */
export const ONLY_MOVE_WIN_PERCENT_GAP = EPL_THRESHOLDS.inaccuracy * 100;

export interface OnlyMove {
  ply: number;
  color: PlayerColor;
  san: string;
  winPercentGap: number;
  bestUci: string;
  alternativeUci: string;
}

export function onlyMoveWinPercentGap(move: ReviewedMove): number | null {
  if (move.alternativePlayerWinPercent === undefined) {
    return null;
  }
  return move.playerWinPercentBefore - move.alternativePlayerWinPercent;
}

export function isOnlyMove(move: ReviewedMove): boolean {
  if (move.accuracy === null || move.classification === "forced") {
    return false;
  }
  const gap = onlyMoveWinPercentGap(move);
  if (gap === null) {
    return false;
  }
  return gap >= ONLY_MOVE_WIN_PERCENT_GAP;
}

export function selectOnlyMoves(moves: readonly ReviewedMove[]): OnlyMove[] {
  return moves
    .filter(isOnlyMove)
    .map((move) => ({
      ply: move.ply,
      color: move.color,
      san: move.san,
      winPercentGap: onlyMoveWinPercentGap(move) ?? 0,
      bestUci: move.bestUci,
      alternativeUci: move.alternativeUci ?? "",
    }))
    .sort((a, b) => a.ply - b.ply);
}
