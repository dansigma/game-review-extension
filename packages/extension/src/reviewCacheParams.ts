import { ALGO_VERSION } from "@game-review/core";
import { MVP_ENGINE_ID } from "./budgetDecision.ts";
import type { ReviewCacheKeyParams } from "./reviewCache.ts";

export function reviewCacheParams(
  gameId: string,
  nodesPerPosition: number,
): ReviewCacheKeyParams {
  return {
    gameId,
    algoVersion: ALGO_VERSION,
    engineId: MVP_ENGINE_ID,
    nodesPerPosition,
  };
}
