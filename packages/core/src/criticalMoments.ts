import { EPL_THRESHOLDS, type MoveClass, type PlayerColor, type ReviewedMove } from "./types.ts";

export const CRITICAL_EPL_MIN = EPL_THRESHOLDS.inaccuracy;
export const CRITICAL_MAX_PER_COLOR = 3;

export interface CriticalMoment {
  ply: number;
  color: PlayerColor;
  san: string;
  epl: number;
  winPercentSwing: number;
  classification: MoveClass;
}

function compareForSelection(a: ReviewedMove, b: ReviewedMove): number {
  if (b.epl !== a.epl) {
    return b.epl - a.epl;
  }
  return a.ply - b.ply;
}

function selectTopPerColor(
  moves: readonly ReviewedMove[],
  color: PlayerColor,
): CriticalMoment[] {
  const eligible = moves
    .filter(
      (move) =>
        move.color === color &&
        move.accuracy !== null &&
        move.epl >= CRITICAL_EPL_MIN,
    )
    .sort(compareForSelection)
    .slice(0, CRITICAL_MAX_PER_COLOR);

  return eligible.map((move) => ({
    ply: move.ply,
    color: move.color,
    san: move.san,
    epl: move.epl,
    winPercentSwing: move.playerWinPercentBefore - move.playerWinPercentAfter,
    classification: move.classification,
  }));
}

export function selectCriticalMoments(
  moves: readonly ReviewedMove[],
): CriticalMoment[] {
  return [
    ...selectTopPerColor(moves, "white"),
    ...selectTopPerColor(moves, "black"),
  ].sort((a, b) => a.ply - b.ply);
}
