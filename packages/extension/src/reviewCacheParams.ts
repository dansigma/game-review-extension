import { ALGO_VERSION } from "@game-review/core";
import { MVP_ENGINE_ID } from "./budgetDecision.ts";
import { pass2NodesFor } from "./pass2Nodes.ts";
import type { ReviewCacheKeyParams } from "./reviewCache.ts";

export function reviewCacheParams(
  gameId: string,
  nodesPerPosition: number,
): ReviewCacheKeyParams {
  const pass2Nodes = pass2NodesFor(nodesPerPosition);
  return {
    gameId,
    algoVersion: ALGO_VERSION,
    engineId: MVP_ENGINE_ID,
    nodesPerPosition,
    ...(pass2Nodes !== null ? { pass2Nodes } : {}),
  };
}
