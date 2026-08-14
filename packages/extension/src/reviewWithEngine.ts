import {
  reviewGame,
  type GameReview,
  type NormalizedGame,
} from "@game-review/core";
import { MVP_ENGINE_ID, MVP_NODES_PER_POSITION } from "./budgetDecision.ts";
import type { EnginePort } from "./enginePort.ts";

export interface ReviewWithEngineArgs {
  game: NormalizedGame;
  nodesPerPosition?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export async function reviewGameWithEngine(
  engine: EnginePort,
  args: ReviewWithEngineArgs,
): Promise<GameReview> {
  const nodesPerPosition = args.nodesPerPosition ?? MVP_NODES_PER_POSITION;
  const evals = await engine.analyzeGame({
    game: args.game,
    nodesPerPosition,
    signal: args.signal,
    onProgress: args.onProgress,
  });
  return reviewGame({
    game: args.game,
    evals,
    engineId: MVP_ENGINE_ID,
    nodesPerPosition,
  });
}
