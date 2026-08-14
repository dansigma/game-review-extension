import { describe, expect, it } from "vitest";
import { ALGO_VERSION, type GameReview } from "@game-review/core";
import { MVP_ENGINE_ID, MVP_NODES_PER_POSITION } from "../src/budgetDecision.ts";
import { shouldPutCachedReview } from "../src/analysisCachePolicy.ts";

function sampleReview(): GameReview {
  return {
    gameId: "abcd1234",
    algoVersion: ALGO_VERSION,
    engineId: MVP_ENGINE_ID,
    nodesPerPosition: MVP_NODES_PER_POSITION,
    white: {
      color: "white",
      movesCounted: 1,
      movesExcludedForced: 0,
      accuracy: 90,
    },
    black: {
      color: "black",
      movesCounted: 1,
      movesExcludedForced: 0,
      accuracy: 85,
    },
    moves: [],
    graph: [{ ply: 0, whiteWinPercent: 50 }],
  };
}

describe("shouldPutCachedReview", () => {
  it("allows cache write after a successful run", () => {
    expect(shouldPutCachedReview(false, sampleReview())).toBe(true);
  });

  it("skips cache write when analysis was aborted", () => {
    expect(shouldPutCachedReview(true, sampleReview())).toBe(false);
  });

  it("skips cache write when no review was produced", () => {
    expect(shouldPutCachedReview(false, null)).toBe(false);
  });
});
