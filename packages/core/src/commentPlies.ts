import { selectCriticalMoments } from "./criticalMoments.ts";
import type { GameReview, MoveClass, ReviewedMove } from "./types.ts";

export const COMMENT_PLY_MIN_GAP = 4;

export type CommentPlyKind = "mandatory" | "optional";

export interface CommentPly {
  ply: number;
  classification: MoveClass;
  kind: CommentPlyKind;
}

export interface SelectCommentPliesOptions {
  includeOptional?: boolean;
  minPlyGap?: number;
}

const MANDATORY_CLASSIFICATIONS = new Set<MoveClass>([
  "mistake",
  "miss",
  "blunder",
]);

const OPTIONAL_CLASSIFICATIONS = new Set<MoveClass>([
  "inaccuracy",
  "brilliant",
  "great",
]);

const NEVER_AUTO_CLASSIFICATIONS = new Set<MoveClass>([
  "best",
  "opening",
  "forced",
]);

function winPercentSwing(move: ReviewedMove): number {
  return move.playerWinPercentBefore - move.playerWinPercentAfter;
}

function compareMandatoryRank(a: ReviewedMove, b: ReviewedMove): number {
  const swingA = winPercentSwing(a);
  const swingB = winPercentSwing(b);
  if (swingB !== swingA) {
    return swingB - swingA;
  }
  if (b.epl !== a.epl) {
    return b.epl - a.epl;
  }
  return a.ply - b.ply;
}

function compareOptionalRank(a: ReviewedMove, b: ReviewedMove): number {
  const swingA = Math.abs(winPercentSwing(a));
  const swingB = Math.abs(winPercentSwing(b));
  if (swingB !== swingA) {
    return swingB - swingA;
  }
  if (b.epl !== a.epl) {
    return b.epl - a.epl;
  }
  return a.ply - b.ply;
}

function isBlunder(classification: MoveClass): boolean {
  return classification === "blunder";
}

function applyMinPlyGap(
  candidates: readonly ReviewedMove[],
  minPlyGap: number,
): ReviewedMove[] {
  const selected: ReviewedMove[] = [];

  for (const candidate of candidates) {
    const conflicts = selected.filter(
      (existing) => Math.abs(existing.ply - candidate.ply) < minPlyGap,
    );

    if (conflicts.length === 0) {
      selected.push(candidate);
      continue;
    }

    if (isBlunder(candidate.classification)) {
      for (const conflict of conflicts) {
        if (!isBlunder(conflict.classification)) {
          const index = selected.indexOf(conflict);
          if (index >= 0) {
            selected.splice(index, 1);
          }
        }
      }
      selected.push(candidate);
      continue;
    }

    const blockedByBlunder = conflicts.some((existing) =>
      isBlunder(existing.classification),
    );
    if (blockedByBlunder) {
      continue;
    }

    // Non-blunder vs non-blunder: keep earlier-in-rank (already selected).
  }

  return selected;
}

function buildMandatoryCandidates(moves: readonly ReviewedMove[]): ReviewedMove[] {
  const critical = selectCriticalMoments(moves);
  const criticalPlies = new Set(critical.map((moment) => moment.ply));

  const mandatoryMoves = moves.filter((move) =>
    MANDATORY_CLASSIFICATIONS.has(move.classification),
  );

  const extraBlunders = mandatoryMoves.filter(
    (move) =>
      move.classification === "blunder" && !criticalPlies.has(move.ply),
  );

  const byPly = new Map<number, ReviewedMove>();
  for (const move of mandatoryMoves) {
    if (criticalPlies.has(move.ply)) {
      byPly.set(move.ply, move);
    }
  }
  for (const move of extraBlunders) {
    byPly.set(move.ply, move);
  }

  return [...byPly.values()].sort(compareMandatoryRank);
}

function buildOptionalCandidates(moves: readonly ReviewedMove[]): ReviewedMove[] {
  return moves
    .filter((move) => OPTIONAL_CLASSIFICATIONS.has(move.classification))
    .sort(compareOptionalRank);
}

function respectsGapAgainstSelected(
  candidate: ReviewedMove,
  selected: readonly CommentPly[],
  minPlyGap: number,
): boolean {
  return selected.every(
    (existing) => Math.abs(existing.ply - candidate.ply) >= minPlyGap,
  );
}

function toCommentPly(move: ReviewedMove, kind: CommentPlyKind): CommentPly {
  return {
    ply: move.ply,
    classification: move.classification,
    kind,
  };
}

export function selectCommentPlies(
  review: GameReview,
  options?: SelectCommentPliesOptions,
): CommentPly[] {
  const minPlyGap = options?.minPlyGap ?? COMMENT_PLY_MIN_GAP;
  const includeOptional = options?.includeOptional ?? false;
  const { moves } = review;

  if (moves.length === 0) {
    return [];
  }

  const mandatoryRanked = buildMandatoryCandidates(moves);
  if (mandatoryRanked.length === 0 && !includeOptional) {
    return [];
  }

  const mandatorySelected = applyMinPlyGap(mandatoryRanked, minPlyGap);
  const result: CommentPly[] = mandatorySelected.map((move) =>
    toCommentPly(move, "mandatory"),
  );

  if (includeOptional) {
    for (const move of buildOptionalCandidates(moves)) {
      if (NEVER_AUTO_CLASSIFICATIONS.has(move.classification)) {
        continue;
      }
      if (respectsGapAgainstSelected(move, result, minPlyGap)) {
        result.push(toCommentPly(move, "optional"));
      }
    }
  }

  result.sort((a, b) => a.ply - b.ply);
  return result;
}

export function isMandatoryCommentPly(review: GameReview, ply: number): boolean {
  return selectCommentPlies(review).some(
    (commentPly) => commentPly.ply === ply && commentPly.kind === "mandatory",
  );
}
