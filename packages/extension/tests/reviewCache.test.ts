import "fake-indexeddb/auto";
import { indexedDB } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { ALGO_VERSION, type GameReview } from "@game-review/core";
import { MVP_ENGINE_ID, MVP_NODES_PER_POSITION } from "../src/budgetDecision.ts";
import {
  getCachedReview,
  putCachedReview,
  reviewCacheKey,
} from "../src/reviewCache.ts";

function sampleReview(overrides: Partial<GameReview> = {}): GameReview {
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
    ...overrides,
  };
}

describe("reviewCacheKey", () => {
  it("joins gameId, algoVersion, engineId and nodesPerPosition", () => {
    expect(
      reviewCacheKey({
        gameId: "abcd1234",
        algoVersion: ALGO_VERSION,
        engineId: MVP_ENGINE_ID,
        nodesPerPosition: MVP_NODES_PER_POSITION,
      }),
    ).toBe(`abcd1234|${ALGO_VERSION}|${MVP_ENGINE_ID}|${MVP_NODES_PER_POSITION}`);
  });
});

describe("reviewCache", () => {
  const deps = { indexedDB };

  it("returns null on cache miss", async () => {
    const result = await getCachedReview(
      {
        gameId: "missing1",
        algoVersion: ALGO_VERSION,
        engineId: MVP_ENGINE_ID,
        nodesPerPosition: MVP_NODES_PER_POSITION,
      },
      deps,
    );
    expect(result).toBeNull();
  });

  it("stores and retrieves a review on cache hit", async () => {
    const review = sampleReview();
    await putCachedReview(review, deps);

    const cached = await getCachedReview(
      {
        gameId: review.gameId,
        algoVersion: ALGO_VERSION,
        engineId: MVP_ENGINE_ID,
        nodesPerPosition: MVP_NODES_PER_POSITION,
      },
      deps,
    );

    expect(cached).toEqual(review);
  });

  it("misses when algoVersion differs", async () => {
    const review = sampleReview();
    await putCachedReview(review, deps);

    const cached = await getCachedReview(
      {
        gameId: review.gameId,
        algoVersion: "other-v2",
        engineId: MVP_ENGINE_ID,
        nodesPerPosition: MVP_NODES_PER_POSITION,
      },
      deps,
    );

    expect(cached).toBeNull();
  });

  it("misses when engineId differs", async () => {
    const review = sampleReview();
    await putCachedReview(review, deps);

    const cached = await getCachedReview(
      {
        gameId: review.gameId,
        algoVersion: ALGO_VERSION,
        engineId: "other-engine",
        nodesPerPosition: MVP_NODES_PER_POSITION,
      },
      deps,
    );

    expect(cached).toBeNull();
  });

  it("misses when nodesPerPosition differs", async () => {
    const review = sampleReview();
    await putCachedReview(review, deps);

    const cached = await getCachedReview(
      {
        gameId: review.gameId,
        algoVersion: ALGO_VERSION,
        engineId: MVP_ENGINE_ID,
        nodesPerPosition: 40_000,
      },
      deps,
    );

    expect(cached).toBeNull();
  });

  it("misses when gameId differs", async () => {
    const review = sampleReview();
    await putCachedReview(review, deps);

    const cached = await getCachedReview(
      {
        gameId: "otherid1",
        algoVersion: ALGO_VERSION,
        engineId: MVP_ENGINE_ID,
        nodesPerPosition: MVP_NODES_PER_POSITION,
      },
      deps,
    );

    expect(cached).toBeNull();
  });
});
