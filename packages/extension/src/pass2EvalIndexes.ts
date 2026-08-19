import type { CriticalMoment } from "@game-review/core";

/**
 * Eval indexes to re-search in pass 2 for each critical moment: position before
 * the move (ply) and after (ply + 1). Eval ply 0 is the initial FEN.
 */
export function pass2EvalIndexes(
  criticalMoments: readonly CriticalMoment[],
): number[] {
  if (criticalMoments.length === 0) {
    return [];
  }
  const indexes = new Set<number>();
  for (const moment of criticalMoments) {
    indexes.add(moment.ply);
    indexes.add(moment.ply + 1);
  }
  return [...indexes].sort((a, b) => a - b);
}
