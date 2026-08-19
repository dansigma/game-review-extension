import { describe, expect, it } from "vitest";
import {
  COMMENT_PLY_MIN_GAP,
  isMandatoryCommentPly,
  selectCommentPlies,
} from "../src/commentPlies.ts";
import { criticalMomentCap } from "../src/criticalMoments.ts";
import type { GameReview, MoveClass, ReviewedMove } from "../src/types.ts";

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

function fakeReview(moves: ReviewedMove[]): GameReview {
  return {
    gameId: "g",
    algoVersion: "lila-v9",
    engineId: "sf",
    white: {
      color: "white",
      movesCounted: moves.filter((m) => m.color === "white").length,
      movesExcludedForced: 0,
      accuracy: 80,
    },
    black: {
      color: "black",
      movesCounted: moves.filter((m) => m.color === "black").length,
      movesExcludedForced: 0,
      accuracy: 80,
    },
    moves,
    graph: [],
  };
}

describe("selectCommentPlies — never auto", () => {
  it("never auto-selects best, opening, or forced even with huge epl/swing", () => {
    const review = fakeReview([
      fakeMove({
        ply: 0,
        color: "white",
        epl: 5,
        classification: "best",
        playerWinPercentBefore: 90,
        playerWinPercentAfter: 10,
      }),
      fakeMove({
        ply: 1,
        color: "black",
        epl: 5,
        classification: "opening",
        playerWinPercentBefore: 90,
        playerWinPercentAfter: 10,
      }),
      fakeMove({
        ply: 2,
        color: "white",
        epl: 5,
        classification: "forced",
        playerWinPercentBefore: 90,
        playerWinPercentAfter: 10,
      }),
    ]);

    expect(selectCommentPlies(review)).toEqual([]);
    expect(
      selectCommentPlies(review, { includeOptional: true }),
    ).toEqual([]);
  });
});

describe("selectCommentPlies — mandatory", () => {
  it("selects blunder, miss, and mistake classifications", () => {
    const review = fakeReview([
      fakeMove({ ply: 0, color: "white", epl: 0.2, classification: "mistake" }),
      fakeMove({ ply: 5, color: "black", epl: 0.25, classification: "miss" }),
      fakeMove({ ply: 10, color: "white", epl: 0.4, classification: "blunder" }),
    ]);

    const result = selectCommentPlies(review);
    expect(result.map((p) => p.ply)).toEqual([0, 5, 10]);
    expect(result.every((p) => p.kind === "mandatory")).toBe(true);
    expect(result.map((p) => p.classification)).toEqual([
      "mistake",
      "miss",
      "blunder",
    ]);
  });

  it("respects SIG-695 cap for miss and mistake in long games", () => {
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
    const review = fakeReview(moves);
    const result = selectCommentPlies(review);
    const cap = criticalMomentCap(40);

    expect(cap).toBe(10);
    expect(result.length).toBeLessThanOrEqual(cap);
    expect(result.length).toBeLessThan(moves.length);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.kind === "mandatory")).toBe(true);
  });

  it("still selects a blunder dropped by the SIG-695 cap", () => {
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
    moves.push(
      fakeMove({
        ply: 80,
        color: "white",
        epl: 0.05,
        classification: "blunder",
        playerWinPercentBefore: 55,
        playerWinPercentAfter: 54,
      }),
    );
    const review = fakeReview(moves);
    const result = selectCommentPlies(review);

    expect(result.some((p) => p.ply === 80 && p.classification === "blunder")).toBe(
      true,
    );
  });
});

describe("selectCommentPlies — min ply gap", () => {
  it("drops a mistake 2 plies after a selected blunder", () => {
    const review = fakeReview([
      fakeMove({
        ply: 10,
        color: "white",
        epl: 0.5,
        classification: "blunder",
        playerWinPercentBefore: 60,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 12,
        color: "black",
        epl: 0.3,
        classification: "mistake",
        playerWinPercentBefore: 55,
        playerWinPercentAfter: 45,
      }),
    ]);

    const result = selectCommentPlies(review);
    expect(result.map((p) => p.ply)).toEqual([10]);
  });

  it("keeps a mistake 4+ plies away from a selected blunder", () => {
    const review = fakeReview([
      fakeMove({
        ply: 10,
        color: "white",
        epl: 0.5,
        classification: "blunder",
        playerWinPercentBefore: 60,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 14,
        color: "black",
        epl: 0.3,
        classification: "mistake",
        playerWinPercentBefore: 55,
        playerWinPercentAfter: 45,
      }),
    ]);

    const result = selectCommentPlies(review);
    expect(result.map((p) => p.ply)).toEqual([10, 14]);
  });

  it("keeps two nearby blunders within the min gap", () => {
    const review = fakeReview([
      fakeMove({
        ply: 10,
        color: "white",
        epl: 0.5,
        classification: "blunder",
        playerWinPercentBefore: 60,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 11,
        color: "black",
        epl: 0.45,
        classification: "blunder",
        playerWinPercentBefore: 58,
        playerWinPercentAfter: 28,
      }),
    ]);

    const result = selectCommentPlies(review);
    expect(result.map((p) => p.ply)).toEqual([10, 11]);
  });

  it("uses COMMENT_PLY_MIN_GAP of 4 by default", () => {
    expect(COMMENT_PLY_MIN_GAP).toBe(4);
  });
});

describe("selectCommentPlies — optional", () => {
  it("does not select inaccuracy, brilliant, or great by default", () => {
    const review = fakeReview([
      fakeMove({ ply: 0, color: "white", epl: 0.08, classification: "inaccuracy" }),
      fakeMove({ ply: 20, color: "black", epl: 0.15, classification: "brilliant" }),
      fakeMove({ ply: 40, color: "white", epl: 0.12, classification: "great" }),
    ]);

    expect(selectCommentPlies(review)).toEqual([]);
  });

  it("can select optional classes when includeOptional is true", () => {
    const review = fakeReview([
      fakeMove({
        ply: 0,
        color: "white",
        epl: 0.08,
        classification: "inaccuracy",
        playerWinPercentBefore: 55,
        playerWinPercentAfter: 50,
      }),
      fakeMove({
        ply: 20,
        color: "black",
        epl: 0.15,
        classification: "brilliant",
        playerWinPercentBefore: 52,
        playerWinPercentAfter: 48,
      }),
      fakeMove({
        ply: 40,
        color: "white",
        epl: 0.12,
        classification: "great",
        playerWinPercentBefore: 51,
        playerWinPercentAfter: 49,
      }),
      fakeMove({
        ply: 60,
        color: "black",
        epl: 5,
        classification: "best",
        playerWinPercentBefore: 90,
        playerWinPercentAfter: 10,
      }),
    ]);

    const result = selectCommentPlies(review, { includeOptional: true });
    expect(result.map((p) => p.ply)).toEqual([0, 20, 40]);
    expect(result.every((p) => p.kind === "optional")).toBe(true);
    expect(result.some((p) => p.classification === "best")).toBe(false);
  });

  it("respects min gap for optional plies against mandatory selections", () => {
    const review = fakeReview([
      fakeMove({
        ply: 10,
        color: "white",
        epl: 0.5,
        classification: "blunder",
        playerWinPercentBefore: 60,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 12,
        color: "black",
        epl: 0.2,
        classification: "brilliant",
        playerWinPercentBefore: 55,
        playerWinPercentAfter: 45,
      }),
      fakeMove({
        ply: 20,
        color: "white",
        epl: 0.15,
        classification: "great",
        playerWinPercentBefore: 52,
        playerWinPercentAfter: 48,
      }),
    ]);

    const result = selectCommentPlies(review, { includeOptional: true });
    expect(result.map((p) => p.ply)).toEqual([10, 20]);
    expect(result.find((p) => p.ply === 10)?.kind).toBe("mandatory");
    expect(result.find((p) => p.ply === 20)?.kind).toBe("optional");
  });
});

describe("selectCommentPlies — empty", () => {
  it("returns empty for empty review or no errors", () => {
    expect(selectCommentPlies(fakeReview([]))).toEqual([]);
    expect(
      selectCommentPlies(
        fakeReview([
          fakeMove({ ply: 0, color: "white", epl: 0.01, classification: "best" }),
          fakeMove({ ply: 1, color: "black", epl: 0.02, classification: "best" }),
        ]),
      ),
    ).toEqual([]);
  });
});

describe("isMandatoryCommentPly", () => {
  it("is true for a selected blunder and false for a best ply", () => {
    const review = fakeReview([
      fakeMove({
        ply: 10,
        color: "white",
        epl: 0.5,
        classification: "blunder",
        playerWinPercentBefore: 60,
        playerWinPercentAfter: 30,
      }),
      fakeMove({
        ply: 20,
        color: "black",
        epl: 0.01,
        classification: "best",
        playerWinPercentBefore: 50,
        playerWinPercentAfter: 49,
      }),
    ]);

    expect(isMandatoryCommentPly(review, 10)).toBe(true);
    expect(isMandatoryCommentPly(review, 20)).toBe(false);
  });
});
