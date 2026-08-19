import { describe, expect, it } from "vitest";
import { ALGO_VERSION } from "@game-review/core";
import { nodesForPreset } from "../src/budgetDecision.ts";
import { reviewCacheKey } from "../src/reviewCache.ts";
import { reviewCacheParams } from "../src/reviewCacheParams.ts";

describe("reviewCacheParams", () => {
  it("builds lookup params from game id and selected nodes", () => {
    const params = reviewCacheParams("abcd1234", nodesForPreset("standard"));
    expect(params.gameId).toBe("abcd1234");
    expect(params.nodesPerPosition).toBe(400_000);
    expect(params.engineId).toBe("sf_18");
    expect(params.algoVersion.length).toBeGreaterThan(0);
    expect(params.pass2Nodes).toBe(nodesForPreset("deep"));
  });

  it("omits pass2Nodes for Deep preset", () => {
    const params = reviewCacheParams("abcd1234", nodesForPreset("deep"));
    expect(params.pass2Nodes).toBeUndefined();
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
    expect(fastKey).toContain("|80000");
    expect(fastKey).toContain("|tp2:400000");
    expect(deepKey).toContain("|1500000");
    expect(deepKey).not.toContain("tp2:");
  });

  it("two-pass Fast key differs from legacy uniform Fast key", () => {
    const legacy = reviewCacheKey({
      gameId: "abcd1234",
      algoVersion: ALGO_VERSION,
      engineId: "sf_18",
      nodesPerPosition: nodesForPreset("fast"),
    });
    const twoPass = reviewCacheKey(
      reviewCacheParams("abcd1234", nodesForPreset("fast")),
    );
    expect(twoPass).not.toBe(legacy);
  });
});
