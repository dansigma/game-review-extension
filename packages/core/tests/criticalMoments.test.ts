import { describe, expect, it } from "vitest";
import {
  countJudgements,
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
    whiteScoreAfter: overrides.whiteScoreAfter ?? { type: "cp", value: 0 },
    whiteScoreBefore: overrides.whiteScoreBefore ?? { type: "cp", value: 0 },
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

  it("never selects Best, Great or other non-critical moves", () => {
    const moves = [
      fakeMove({
        ply: 0,
        color: "white",
        epl: 0.02,
        classification: "best",
        playedIsBest: true,
      }),
      fakeMove({ ply: 1, color: "black", epl: 0.04, classification: "best" }),
      fakeMove({ ply: 2, color: "white", epl: 0.01, classification: "great" }),
      fakeMove({ ply: 3, color: "black", epl: 0.12, classification: "mistake" }),
      fakeMove({ ply: 4, color: "white", epl: 0.14, classification: "miss" }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.ply)).toEqual([3, 4]);
    expect(result.map((m) => m.classification)).toEqual(["mistake", "miss"]);
  });

  it("returns all four white critical moves in ply order (no per-color cap)", () => {
    const whiteMoves = [
      fakeMove({ ply: 0, color: "white", epl: 0.1, classification: "mistake", san: "W0" }),
      fakeMove({ ply: 2, color: "white", epl: 0.15, classification: "mistake", san: "W1" }),
      fakeMove({ ply: 4, color: "white", epl: 0.2, classification: "mistake", san: "W2" }),
      fakeMove({ ply: 6, color: "white", epl: 0.25, classification: "blunder", san: "W3" }),
    ];
    const result = selectCriticalMoments(whiteMoves);
    expect(result).toHaveLength(4);
    expect(result.map((m) => m.ply)).toEqual([0, 2, 4, 6]);
    expect(result.map((m) => m.classification)).toEqual([
      "mistake",
      "mistake",
      "mistake",
      "blunder",
    ]);
    expect(result.every((m) => m.color === "white")).toBe(true);
  });

  it("returns mixed colors sorted by ply ascending", () => {
    const moves = [
      fakeMove({ ply: 5, color: "black", epl: 0.4, classification: "blunder", san: "Nf6" }),
      fakeMove({ ply: 2, color: "white", epl: 0.25, classification: "mistake", san: "d4" }),
      fakeMove({ ply: 8, color: "black", epl: 0.15, classification: "mistake", san: "Qh5" }),
      fakeMove({ ply: 4, color: "white", epl: 0.35, classification: "blunder", san: "Bc4" }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result.map((m) => m.ply)).toEqual([2, 4, 5, 8]);
    expect(result.map((m) => m.color)).toEqual(["white", "white", "black", "black"]);
  });

  it("returns empty list for empty input or all-best games", () => {
    expect(selectCriticalMoments([])).toEqual([]);
    expect(
      selectCriticalMoments([
        fakeMove({ ply: 0, color: "white", epl: 0.01, accuracy: 99, classification: "best" }),
        fakeMove({ ply: 1, color: "black", epl: 0.02, accuracy: 98, classification: "best" }),
      ]),
    ).toEqual([]);
  });

  it("computes winPercentSwing as playerWinPercentBefore - playerWinPercentAfter", () => {
    const moves = [
      fakeMove({
        ply: 3,
        color: "black",
        epl: 0.2,
        classification: "mistake",
        playerWinPercentBefore: 45,
        playerWinPercentAfter: 20,
      }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result[0]?.winPercentSwing).toBe(25);
  });
});

describe("countJudgements", () => {
  it("counts best, mistake and blunder per color", () => {
    const moves = [
      fakeMove({ ply: 0, color: "white", epl: 0.1, classification: "mistake" }),
      fakeMove({ ply: 2, color: "white", epl: 0.12, classification: "mistake" }),
      fakeMove({ ply: 4, color: "white", epl: 0.2, classification: "blunder" }),
      fakeMove({ ply: 1, color: "black", epl: 0.11, classification: "mistake" }),
      fakeMove({ ply: 3, color: "black", epl: 0.16, classification: "mistake" }),
      fakeMove({ ply: 5, color: "black", epl: 0.3, classification: "blunder" }),
      fakeMove({ ply: 6, color: "black", epl: 0.35, classification: "blunder" }),
      fakeMove({ ply: 7, color: "white", epl: 0.01, classification: "best" }),
      fakeMove({ ply: 8, color: "black", epl: 0.5, classification: "forced" }),
      fakeMove({ ply: 9, color: "black", epl: 0.03, classification: "best" }),
    ];
    expect(countJudgements(moves)).toEqual({
      white: {
        brilliant: 0,
        great: 0,
        best: 1,
        mistake: 2,
        miss: 0,
        blunder: 1,
      },
      black: {
        brilliant: 0,
        great: 0,
        best: 1,
        mistake: 2,
        miss: 0,
        blunder: 2,
      },
    });
  });
});
