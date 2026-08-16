import {
  formatMoveEvalAfter,
  formatMoveEvalBefore,
} from "./evalDisplay.ts";
import type { MoveClass, PlayerColor, ReviewedMove } from "./types.ts";

/** First Lichess glyph threshold (inaccuracy and worse). */
export const CRITICAL_EPL_MIN = 0.05;

const CRITICAL_CLASSIFICATIONS = new Set<MoveClass>([
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
]);

const DASHBOARD_CLASSIFICATIONS = new Set<MoveClass>([
  "brilliant",
  "great",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
]);

/** Dashboard row order: positive → negative. Forced is excluded. */
export const DASHBOARD_CLASSES: (keyof JudgementCounts)[] = [
  "brilliant",
  "great",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
];

export interface CriticalMoment {
  ply: number;
  color: PlayerColor;
  san: string;
  epl: number;
  winPercentSwing: number;
  classification: MoveClass;
  evalAfter: string;
  evalBefore?: string;
}

export interface JudgementCounts {
  brilliant: number;
  great: number;
  best: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  miss: number;
  blunder: number;
}

export type JudgementsByColor = Record<PlayerColor, JudgementCounts>;

const EMPTY_JUDGEMENTS: JudgementCounts = {
  brilliant: 0,
  great: 0,
  best: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
};

function isCriticalClassification(
  classification: MoveClass,
): classification is "inaccuracy" | "mistake" | "miss" | "blunder" {
  return CRITICAL_CLASSIFICATIONS.has(classification);
}

function isDashboardClassification(
  classification: MoveClass,
): classification is keyof JudgementCounts {
  return DASHBOARD_CLASSIFICATIONS.has(classification);
}

export function countJudgements(
  moves: readonly ReviewedMove[],
): JudgementsByColor {
  const counts: JudgementsByColor = {
    white: { ...EMPTY_JUDGEMENTS },
    black: { ...EMPTY_JUDGEMENTS },
  };

  for (const move of moves) {
    if (!isDashboardClassification(move.classification)) {
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
    .map((move) => {
      const evalAfter = formatMoveEvalAfter(move);
      const evalBefore = formatMoveEvalBefore(move);
      return {
        ply: move.ply,
        color: move.color,
        san: move.san,
        epl: move.epl,
        winPercentSwing: move.playerWinPercentBefore - move.playerWinPercentAfter,
        classification: move.classification,
        evalAfter,
        evalBefore: evalBefore !== evalAfter ? evalBefore : undefined,
      };
    })
    .sort((a, b) => a.ply - b.ply);
}
