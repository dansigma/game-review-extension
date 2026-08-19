/** Scale node counts so progress totals stay in a reasonable integer range. */
export const ANALYSIS_PROGRESS_NODE_SCALE = 1000;

export function nodeWeightedUnits(nodes: number, count = 1): number {
  return (nodes / ANALYSIS_PROGRESS_NODE_SCALE) * count;
}
