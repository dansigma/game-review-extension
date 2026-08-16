import type { EngineScore, PlayerColor } from "./types.ts";

/** Lichess winning-chances slope (cp → [-1, 1]). Physics of Win%, not their accuracy formula. */
const CP_TO_WIN_SLOPE = 0.00368208;
const CP_CAP = 1000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Mate score → centipawns (Lichess `winningChances` / scalachess).
 * mate 0 → 0 cp (checkmated side to move).
 */
export function mateToCentipawns(mate: number): number {
  if (mate === 0) {
    return 0;
  }
  const sign = mate > 0 ? 1 : -1;
  return (21 - Math.min(10, Math.abs(mate))) * 100 * sign;
}

/**
 * Winning chances in [-1, 1] from a centipawn eval (side-to-move).
 * Same logistic curve Lichess uses for Win%.
 */
export function winningChancesFromCp(cp: number): number {
  const capped = clamp(cp, -CP_CAP, CP_CAP);
  return 2 / (1 + Math.exp(-CP_TO_WIN_SLOPE * capped)) - 1;
}

/** Side-to-move win percent in [0, 100]. */
export function playerWinPercent(score: EngineScore): number {
  if (score.type === "mate") {
    if (score.value === 0) {
      return 0;
    }
    return 50 + 50 * winningChancesFromCp(mateToCentipawns(score.value));
  }
  return 50 + 50 * winningChancesFromCp(score.value);
}

export function whiteWinPercent(
  score: EngineScore,
  sideToMove: PlayerColor,
): number {
  const stm = playerWinPercent(score);
  return sideToMove === "white" ? stm : 100 - stm;
}

export function expectedPointsLost(
  winPercentBefore: number,
  winPercentAfter: number,
): number {
  return clamp((winPercentBefore - winPercentAfter) / 100, 0, 1);
}
