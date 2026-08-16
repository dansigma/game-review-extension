import type { EngineScore, PlayerColor, ReviewedMove } from "./types.ts";

const CP_TO_WIN_SLOPE = 0.00368208;

/** Flip side-to-move engine score to White's point of view. */
export function whiteScore(
  score: EngineScore,
  sideToMove: PlayerColor,
): EngineScore {
  if (sideToMove === "white") {
    return score;
  }
  if (score.type === "cp") {
    return { type: "cp", value: -score.value };
  }
  return { type: "mate", value: -score.value };
}

/** Lichess-style pawn eval from a White-POV score. */
export function formatEvalPawns(score: EngineScore): string {
  if (score.type === "mate") {
    if (score.value === 0) {
      return "#0";
    }
    if (score.value > 0) {
      return `#${score.value}`;
    }
    return `-#${-score.value}`;
  }

  const pawns = score.value / 100;
  if (pawns === 0) {
    return "0.0";
  }
  const abs = Math.abs(pawns).toFixed(1);
  return pawns > 0 ? `+${abs}` : `-${abs}`;
}

/** Approximate White-POV centipawn score from White win% (cached reviews without scores). */
export function approximateCpScoreFromWhiteWinPercent(
  whiteWinPercent: number,
): EngineScore {
  const clamped = Math.min(99.5, Math.max(0.5, whiteWinPercent)) / 100;
  const cp = Math.round(-Math.log(1 / clamped - 1) / CP_TO_WIN_SLOPE);
  return { type: "cp", value: cp };
}

export function formatMoveEvalAfter(move: ReviewedMove): string {
  if (move.whiteScoreAfter) {
    return formatEvalPawns(move.whiteScoreAfter);
  }
  return formatEvalPawns(
    approximateCpScoreFromWhiteWinPercent(move.whiteWinPercentAfter),
  );
}

export function formatMoveEvalBefore(move: ReviewedMove): string {
  if (move.whiteScoreBefore) {
    return formatEvalPawns(move.whiteScoreBefore);
  }
  const whiteWinBefore =
    move.color === "white"
      ? move.playerWinPercentBefore
      : 100 - move.playerWinPercentBefore;
  return formatEvalPawns(
    approximateCpScoreFromWhiteWinPercent(whiteWinBefore),
  );
}

export function formatMoveEvalRange(move: ReviewedMove): string {
  const after = formatMoveEvalAfter(move);
  const before = formatMoveEvalBefore(move);
  if (before === after) {
    return after;
  }
  return `${before} → ${after}`;
}
