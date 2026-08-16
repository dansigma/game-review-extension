import { describe, expect, it } from "vitest";
import {
  CRITICAL_EPL_MIN,
  CRITICAL_MAX_PER_COLOR,
  selectCriticalMoments,
} from "../src/criticalMoments.ts";
import type { MoveClass, ReviewedMove } from "../src/types.ts";

function fakeMove(
  overrides: Partial<ReviewedMove> & Pick<ReviewedMove, "ply" | "color" | "epl">,
): ReviewedMove {
  const classification: MoveClass = overrides.classification ?? "mistake";
  return {
    san: overrides.san ?? "e4",
    uci: overrides.uci ?? "e2e4",
    classificationLabel: overrides.classificationLabel ?? "Erro",
    accuracy: overrides.accuracy ?? 80,
    playerWinPercentBefore: overrides.playerWinPercentBefore ?? 50,
    playerWinPercentAfter: overrides.playerWinPercentAfter ?? 40,
    whiteWinPercentAfter: overrides.whiteWinPercentAfter ?? 50,
    bestUci: overrides.bestUci ?? "d2d4",
    playedIsBest: overrides.playedIsBest ?? false,
    ...overrides,
    classification,
  };
}

describe("selectCriticalMoments", () => {
  it("never selects Forced/hopeless moves", () => {
    const moves = [
      fakeMove({ ply: 0, color: "white", epl: 0.5, classification: "forced" }),
      fakeMove({ ply: 1, color: "black", epl: 0.3, accuracy: 70 }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result).toHaveLength(1);
    expect(result[0]?.ply).toBe(1);
  });

  it("never selects moves below the EPL floor", () => {
    const moves = [
      fakeMove({ ply: 0, color: "white", epl: CRITICAL_EPL_MIN - 0.001 }),
      fakeMove({ ply: 1, color: "black", epl: CRITICAL_EPL_MIN }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result).toHaveLength(1);
    expect(result[0]?.ply).toBe(1);
  });

  it("caps at CRITICAL_MAX_PER_COLOR per color and drops the 4th highest EPL", () => {
    const whiteMoves = [
      fakeMove({ ply: 0, color: "white", epl: 0.1, san: "W0" }),
      fakeMove({ ply: 2, color: "white", epl: 0.15, san: "W1" }),
      fakeMove({ ply: 4, color: "white", epl: 0.2, san: "W2" }),
      fakeMove({ ply: 6, color: "white", epl: 0.25, san: "W3" }),
    ];
    const result = selectCriticalMoments(whiteMoves);
    expect(result).toHaveLength(CRITICAL_MAX_PER_COLOR);
    expect(result.map((m) => m.ply)).toEqual([2, 4, 6]);
    expect(result.map((m) => m.epl)).toEqual([0.15, 0.2, 0.25]);
    expect(result.every((m) => m.color === "white")).toBe(true);
  });

  it("returns mixed colors sorted by ply ascending", () => {
    const moves = [
      fakeMove({ ply: 5, color: "black", epl: 0.4, san: "Nf6" }),
      fakeMove({ ply: 2, color: "white", epl: 0.25, san: "d4" }),
      fakeMove({ ply: 8, color: "black", epl: 0.15, san: "Qh5" }),
      fakeMove({ ply: 4, color: "white", epl: 0.35, san: "Bc4" }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result.map((m) => m.ply)).toEqual([2, 4, 5, 8]);
    expect(result.map((m) => m.color)).toEqual(["white", "white", "black", "black"]);
  });

  it("returns empty list for empty input or all-best games", () => {
    expect(selectCriticalMoments([])).toEqual([]);
    expect(
      selectCriticalMoments([
        fakeMove({ ply: 0, color: "white", epl: 0.01, accuracy: 99 }),
        fakeMove({ ply: 1, color: "black", epl: 0.02, accuracy: 98 }),
      ]),
    ).toEqual([]);
  });

  it("tie-breaks equal EPL by earlier ply when filling per-color slots", () => {
    const moves = [
      fakeMove({ ply: 10, color: "white", epl: 0.3, san: "late" }),
      fakeMove({ ply: 2, color: "white", epl: 0.3, san: "early" }),
      fakeMove({ ply: 6, color: "white", epl: 0.3, san: "mid" }),
      fakeMove({ ply: 8, color: "white", epl: 0.25, san: "lower" }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result.map((m) => m.ply)).toEqual([2, 6, 10]);
  });

  it("computes winPercentSwing as playerWinPercentBefore - playerWinPercentAfter", () => {
    const moves = [
      fakeMove({
        ply: 3,
        color: "black",
        epl: 0.2,
        playerWinPercentBefore: 45,
        playerWinPercentAfter: 20,
      }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result[0]?.winPercentSwing).toBe(25);
  });
});
