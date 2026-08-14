import type { GameReview } from "@game-review/core";

/** Only persist a review after a successful, non-aborted full analysis run. */
export function shouldPutCachedReview(
  aborted: boolean,
  review: GameReview | null | undefined,
): boolean {
  return !aborted && review != null;
}
