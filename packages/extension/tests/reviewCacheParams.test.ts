import { describe, expect, it } from "vitest";
import { nodesForPreset } from "../src/budgetDecision.ts";
import { reviewCacheKey } from "../src/reviewCache.ts";
import { reviewCacheParams } from "../src/reviewCacheParams.ts";

describe("reviewCacheParams", () => {
  it("builds lookup params from game id and selected nodes", () => {
    const params = reviewCacheParams("abcd1234", nodesForPreset("standard"));
    expect(params.gameId).toBe("abcd1234");
    expect(params.nodesPerPosition).toBe(80_000);
    expect(params.engineId).toBe("sf_18_smallnet");
    expect(params.algoVersion.length).toBeGreaterThan(0);
  });

  it("produces distinct cache keys for different presets", () => {
    const gameId = "abcd1234";
    const fastKey = reviewCacheKey(
      reviewCacheParams(gameId, nodesForPreset("fast")),
    );
    const deepKey = reviewCacheKey(
      reviewCacheParams(gameId, nodesForPreset("deep")),
    );

    expect(fastKey).not.toBe(deepKey);
    expect(fastKey).toContain("|20000");
    expect(deepKey).toContain("|200000");
  });
});
