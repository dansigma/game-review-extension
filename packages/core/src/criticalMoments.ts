import type { MoveClass, PlayerColor, ReviewedMove } from "./types.ts";

/** First Lichess glyph threshold (inaccuracy and worse). */
export const CRITICAL_EPL_MIN = 0.05;

const CRITICAL_CLASSIFICATIONS = new Set<MoveClass>([
  "inaccuracy",
  "mistake",
  "blunder",
]);

export interface CriticalMoment {
  ply: number;
  color: PlayerColor;
  san: string;
  epl: number;
  winPercentSwing: number;
  classification: MoveClass;
}

export interface JudgementCounts {
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export type JudgementsByColor = Record<PlayerColor, JudgementCounts>;

const EMPTY_JUDGEMENTS: JudgementCounts = {
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
};

function isCriticalClassification(
  classification: MoveClass,
): classification is "inaccuracy" | "mistake" | "blunder" {
  return CRITICAL_CLASSIFICATIONS.has(classification);
}

export function countJudgements(
  moves: readonly ReviewedMove[],
): JudgementsByColor {
  const counts: JudgementsByColor = {
    white: { ...EMPTY_JUDGEMENTS },
    black: { ...EMPTY_JUDGEMENTS },
  };

  for (const move of moves) {
    if (!isCriticalClassification(move.classification)) {
      continue;
    }
    counts[move.color][move.classification] += 1;
  }

  return counts;
}

export function selectCriticalMoments(
  moves: readonly ReviewedMove[],
): CriticalMoment[] {
  return moves
    .filter((move) => isCriticalClassification(move.classification))
    .map((move) => ({
      ply: move.ply,
      color: move.color,
      san: move.san,
      epl: move.epl,
      winPercentSwing: move.playerWinPercentBefore - move.playerWinPercentAfter,
      classification: move.classification,
    }))
    .sort((a, b) => a.ply - b.ply);
}
