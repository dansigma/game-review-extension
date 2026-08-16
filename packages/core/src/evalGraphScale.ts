import {
  approximateCpScoreFromWhiteWinPercent,
} from "./evalDisplay.ts";
import type { EngineScore, EvalGraphPoint } from "./types.ts";

export const GRAPH_PAWN_CAP = 4;

/** White-POV pawn value for graph plotting (uncapped). */
export function pawnsFromWhiteScore(score: EngineScore): number {
  if (score.type === "mate") {
    if (score.value > 0) {
      return GRAPH_PAWN_CAP;
    }
    if (score.value < 0) {
      return -GRAPH_PAWN_CAP;
    }
    return 0;
  }
  return score.value / 100;
}

export function graphPawns(point: EvalGraphPoint): number {
  if (point.whiteScore) {
    return pawnsFromWhiteScore(point.whiteScore);
  }
  return pawnsFromWhiteScore(
    approximateCpScoreFromWhiteWinPercent(point.whiteWinPercent),
  );
}

export function clampGraphPawns(pawns: number): number {
  return Math.max(-GRAPH_PAWN_CAP, Math.min(GRAPH_PAWN_CAP, pawns));
}

/** 1 at +cap (top), 0.5 at 0, 0 at -cap (bottom). */
export function graphYFraction(pawns: number): number {
  return (pawns + GRAPH_PAWN_CAP) / (2 * GRAPH_PAWN_CAP);
}
