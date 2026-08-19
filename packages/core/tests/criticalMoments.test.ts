import { describe, expect, it } from "vitest";
import {
  countJudgements,
  criticalMomentCap,
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

describe("criticalMomentCap", () => {
  it("returns max(3, ceil(nPlies * 0.25))", () => {
    expect(criticalMomentCap(4)).toBe(3);
    expect(criticalMomentCap(40)).toBe(10);
    expect(criticalMomentCap(1)).toBe(3);
  });
});

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

  it("never selects Best, Great, Imprecisão or other non-critical moves", () => {
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
      fakeMove({
        ply: 6,
        color: "white",
        epl: 0.08,
        classification: "inaccuracy",
      }),
      fakeMove({ ply: 3, color: "black", epl: 0.12, classification: "mistake" }),
      fakeMove({ ply: 4, color: "white", epl: 0.14, classification: "miss" }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.ply)).toEqual([4, 3]);
    expect(result.map((m) => m.classification)).toEqual(["miss", "mistake"]);
  });

  it("caps four critical moves to top three by score (not ply order)", () => {
    const whiteMoves = [
      fakeMove({ ply: 0, color: "white", epl: 0.1, classification: "mistake", san: "W0" }),
      fakeMove({ ply: 2, color: "white", epl: 0.15, classification: "mistake", san: "W1" }),
      fakeMove({ ply: 4, color: "white", epl: 0.2, classification: "mistake", san: "W2" }),
      fakeMove({ ply: 6, color: "white", epl: 0.25, classification: "blunder", san: "W3" }),
    ];
    const result = selectCriticalMoments(whiteMoves);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.ply)).toEqual([6, 4, 2]);
    expect(result.map((m) => m.classification)).toEqual([
      "blunder",
      "mistake",
      "mistake",
    ]);
    expect(result.every((m) => m.color === "white")).toBe(true);
  });

  it("returns mixed colors ranked by score, capped when needed", () => {
    const moves = [
      fakeMove({ ply: 5, color: "black", epl: 0.4, classification: "blunder", san: "Nf6" }),
      fakeMove({ ply: 2, color: "white", epl: 0.25, classification: "mistake", san: "d4" }),
      fakeMove({ ply: 8, color: "black", epl: 0.15, classification: "mistake", san: "Qh5" }),
      fakeMove({ ply: 4, color: "white", epl: 0.35, classification: "blunder", san: "Bc4" }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.ply)).toEqual([5, 4, 2]);
    expect(result.map((m) => m.color)).toEqual(["black", "white", "white"]);
  });

  it("ranks higher winPercentSwing first even when later in the game", () => {
    const moves = [
      fakeMove({
        ply: 2,
        color: "white",
        epl: 0.5,
        classification: "mistake",
        playerWinPercentBefore: 55,
        playerWinPercentAfter: 50,
      }),
      fakeMove({
        ply: 10,
        color: "black",
        epl: 0.1,
        classification: "blunder",
        playerWinPercentBefore: 60,
        playerWinPercentAfter: 30,
      }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result.map((m) => m.ply)).toEqual([10, 2]);
    expect(result[0]?.winPercentSwing).toBe(30);
    expect(result[1]?.winPercentSwing).toBe(5);
  });

  it("tie-breaks equal swing by higher EPL, then lower ply", () => {
    const moves: ReviewedMove[] = [];
    for (let ply = 0; ply < 12; ply += 1) {
      moves.push(
        fakeMove({ ply, color: ply % 2 === 0 ? "white" : "black", epl: 0.01, classification: "best" }),
      );
    }
    moves.push(
      fakeMove({
        ply: 12,
        color: "white",
        epl: 0.1,
        classification: "mistake",
        playerWinPercentBefore: 50,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 13,
        color: "black",
        epl: 0.3,
        classification: "blunder",
        playerWinPercentBefore: 50,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 14,
        color: "white",
        epl: 0.2,
        classification: "miss",
        playerWinPercentBefore: 50,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 15,
        color: "black",
        epl: 0.2,
        classification: "mistake",
        playerWinPercentBefore: 50,
        playerWinPercentAfter: 30,
      }),
    );
    const result = selectCriticalMoments(moves);
    expect(result.map((m) => m.ply)).toEqual([13, 14, 15, 12]);
  });

  it("caps long games at max(3, ceil(nPlies * 0.25))", () => {
    const moves: ReviewedMove[] = [];
    for (let ply = 0; ply < 40; ply += 1) {
      moves.push(
        fakeMove({
          ply,
          color: ply % 2 === 0 ? "white" : "black",
          epl: 0.1 + ply * 0.01,
          classification: "mistake",
          playerWinPercentBefore: 50 + ply * 0.1,
          playerWinPercentAfter: 40,
        }),
      );
    }
    const result = selectCriticalMoments(moves);
    expect(criticalMomentCap(40)).toBe(10);
    expect(result).toHaveLength(10);
    for (let i = 1; i < result.length; i += 1) {
      const prev = result[i - 1]!;
      const curr = result[i]!;
      expect(prev.winPercentSwing).toBeGreaterThanOrEqual(curr.winPercentSwing);
      if (prev.winPercentSwing === curr.winPercentSwing) {
        expect(prev.epl).toBeGreaterThanOrEqual(curr.epl);
      }
    }
  });

  it("keeps a single critical moment on short games (cap never empties list)", () => {
    const moves = [
      fakeMove({ ply: 0, color: "white", epl: 0.01, classification: "best" }),
      fakeMove({ ply: 1, color: "black", epl: 0.02, classification: "best" }),
      fakeMove({ ply: 2, color: "white", epl: 0.12, classification: "mistake" }),
      fakeMove({ ply: 3, color: "black", epl: 0.01, classification: "best" }),
    ];
    const result = selectCriticalMoments(moves);
    expect(result).toHaveLength(1);
    expect(result[0]?.ply).toBe(2);
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
  it("counts best, inaccuracy, mistake and blunder per color", () => {
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
      fakeMove({
        ply: 10,
        color: "white",
        epl: 0.08,
        classification: "inaccuracy",
      }),
      fakeMove({
        ply: 11,
        color: "black",
        epl: 0.07,
        classification: "inaccuracy",
      }),
    ];
    expect(countJudgements(moves)).toEqual({
      white: {
        brilliant: 0,
        great: 0,
        best: 1,
        inaccuracy: 1,
        mistake: 2,
        miss: 0,
        blunder: 1,
      },
      black: {
        brilliant: 0,
        great: 0,
        best: 1,
        inaccuracy: 1,
        mistake: 2,
        miss: 0,
        blunder: 2,
      },
    });
  });
});
