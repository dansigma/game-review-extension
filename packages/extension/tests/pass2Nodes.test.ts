import { describe, expect, it } from "vitest";
import { nodesForPreset } from "../src/budgetDecision.ts";
import { pass2NodesFor, usesTwoPassCacheKey } from "../src/pass2Nodes.ts";

describe("pass2NodesFor", () => {
  it("maps Fast → Standard", () => {
    expect(pass2NodesFor(nodesForPreset("fast"))).toBe(nodesForPreset("standard"));
  });

  it("maps Standard → Deep", () => {
    expect(pass2NodesFor(nodesForPreset("standard"))).toBe(nodesForPreset("deep"));
  });

  it("skips pass 2 for Deep", () => {
    expect(pass2NodesFor(nodesForPreset("deep"))).toBeNull();
  });

  it("treats unknown pass-1 budgets below Deep as Standard → Deep", () => {
    expect(pass2NodesFor(200_000)).toBe(nodesForPreset("deep"));
  });
});

describe("usesTwoPassCacheKey", () => {
  it("is true for Fast and Standard", () => {
    expect(usesTwoPassCacheKey(nodesForPreset("fast"))).toBe(true);
    expect(usesTwoPassCacheKey(nodesForPreset("standard"))).toBe(true);
  });

  it("is false for Deep", () => {
    expect(usesTwoPassCacheKey(nodesForPreset("deep"))).toBe(false);
  });
});
