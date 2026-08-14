import { describe, expect, it } from "vitest";
import {
  isOnlyMove,
  ONLY_MOVE_WIN_PERCENT_GAP,
  onlyMoveWinPercentGap,
  selectOnlyMoves,
} from "../src/onlyMove.ts";
import type { MoveClass, ReviewedMove } from "../src/types.ts";

function fakeMove(
  overrides: Partial<ReviewedMove> & Pick<ReviewedMove, "ply" | "color">,
): ReviewedMove {
  const classification: MoveClass = overrides.classification ?? "best";
  return {
    san: overrides.san ?? "e4",
    uci: overrides.uci ?? "e2e4",
    classificationLabel: overrides.classificationLabel ?? "Best",
    epl: overrides.epl ?? 0,
    accuracy: overrides.accuracy ?? 99,
    playerWinPercentBefore: overrides.playerWinPercentBefore ?? 55,
    playerWinPercentAfter: overrides.playerWinPercentAfter ?? 54,
    whiteWinPercentAfter: overrides.whiteWinPercentAfter ?? 55,
    bestUci: overrides.bestUci ?? "e2e4",
    playedIsBest: overrides.playedIsBest ?? true,
    ...overrides,
    classification,
  };
}

describe("onlyMoveWinPercentGap", () => {
  it("returns PV1−PV2 win% when alternative data exists", () => {
    const move = fakeMove({
      ply: 0,
      color: "white",
      playerWinPercentBefore: 62,
      alternativePlayerWinPercent: 48,
    });
    expect(onlyMoveWinPercentGap(move)).toBe(14);
  });

  it("returns null when PV2 win% is missing", () => {
    const move = fakeMove({ ply: 0, color: "white" });
    expect(onlyMoveWinPercentGap(move)).toBeNull();
  });
});

describe("isOnlyMove", () => {
  it("flags large PV1−PV2 gap", () => {
    const move = fakeMove({
      ply: 2,
      color: "white",
      playerWinPercentBefore: 60,
      alternativePlayerWinPercent: 45,
      alternativeUci: "d2d4",
    });
    expect(isOnlyMove(move)).toBe(true);
  });

  it("does not flag small gap", () => {
    const move = fakeMove({
      ply: 2,
      color: "white",
      playerWinPercentBefore: 55,
      alternativePlayerWinPercent: 52,
      alternativeUci: "d2d4",
    });
    expect(isOnlyMove(move)).toBe(false);
  });

  it("does not flag when PV2 data is missing", () => {
    const move = fakeMove({
      ply: 2,
      color: "white",
      playerWinPercentBefore: 70,
    });
    expect(isOnlyMove(move)).toBe(false);
  });

  it("does not flag Forced/hopeless positions", () => {
    const move = fakeMove({
      ply: 0,
      color: "white",
      accuracy: null,
      classification: "forced",
      playerWinPercentBefore: 5,
      alternativePlayerWinPercent: 0,
      alternativeUci: "h1g1",
    });
    expect(isOnlyMove(move)).toBe(false);
  });

  it("accepts mate scores when gap is large enough", () => {
    const move = fakeMove({
      ply: 4,
      color: "black",
      playerWinPercentBefore: 100,
      alternativePlayerWinPercent: 0,
      alternativeUci: "e8e7",
    });
    expect(isOnlyMove(move)).toBe(true);
  });

  it("treats gap at threshold as only-move", () => {
    const move = fakeMove({
      ply: 1,
      color: "black",
      playerWinPercentBefore: 50,
      alternativePlayerWinPercent: 50 - ONLY_MOVE_WIN_PERCENT_GAP,
      alternativeUci: "c7c5",
    });
    expect(isOnlyMove(move)).toBe(true);
  });

  it("rejects gap just below threshold", () => {
    const move = fakeMove({
      ply: 1,
      color: "black",
      playerWinPercentBefore: 50,
      alternativePlayerWinPercent: 50 - ONLY_MOVE_WIN_PERCENT_GAP + 0.01,
      alternativeUci: "c7c5",
    });
    expect(isOnlyMove(move)).toBe(false);
  });
});

describe("selectOnlyMoves", () => {
  it("returns eligible plies sorted by ply", () => {
    const moves = [
      fakeMove({
        ply: 5,
        color: "black",
        san: "Nf6",
        playerWinPercentBefore: 58,
        alternativePlayerWinPercent: 40,
        alternativeUci: "d7d6",
      }),
      fakeMove({
        ply: 1,
        color: "black",
        san: "e5",
        playerWinPercentBefore: 50,
        alternativePlayerWinPercent: 49,
        alternativeUci: "c5",
      }),
      fakeMove({
        ply: 3,
        color: "white",
        san: "Bc4",
        playerWinPercentBefore: 65,
        alternativePlayerWinPercent: 50,
        alternativeUci: "d2d4",
      }),
    ];
    const result = selectOnlyMoves(moves);
    expect(result.map((m) => m.ply)).toEqual([3, 5]);
    expect(result[0]?.winPercentGap).toBe(15);
    expect(result[0]?.alternativeUci).toBe("d2d4");
  });
});
