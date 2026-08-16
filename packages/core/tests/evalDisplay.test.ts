import { describe, expect, it } from "vitest";
import {
  formatEvalPawns,
  formatMoveEvalAfter,
  whiteScore,
} from "../src/evalDisplay.ts";
import type { ReviewedMove } from "../src/types.ts";

describe("formatEvalPawns", () => {
  it("formats centipawns as signed pawn decimals", () => {
    expect(formatEvalPawns({ type: "cp", value: 220 })).toBe("+2.2");
    expect(formatEvalPawns({ type: "cp", value: -350 })).toBe("-3.5");
    expect(formatEvalPawns({ type: "cp", value: 0 })).toBe("0.0");
    expect(formatEvalPawns({ type: "cp", value: 30 })).toBe("+0.3");
  });

  it("formats mate scores in Lichess style", () => {
    expect(formatEvalPawns({ type: "mate", value: 3 })).toBe("#3");
    expect(formatEvalPawns({ type: "mate", value: -2 })).toBe("-#2");
    expect(formatEvalPawns({ type: "mate", value: 0 })).toBe("#0");
  });
});

describe("whiteScore", () => {
  it("keeps score when White is to move", () => {
    expect(whiteScore({ type: "cp", value: 150 }, "white")).toEqual({
      type: "cp",
      value: 150,
    });
    expect(whiteScore({ type: "mate", value: 2 }, "white")).toEqual({
      type: "mate",
      value: 2,
    });
  });

  it("inverts score when Black is to move", () => {
    expect(whiteScore({ type: "cp", value: 220 }, "black")).toEqual({
      type: "cp",
      value: -220,
    });
    expect(whiteScore({ type: "mate", value: 3 }, "black")).toEqual({
      type: "mate",
      value: -3,
    });
  });
});

describe("formatMoveEvalAfter", () => {
  it("uses whiteScoreAfter when present", () => {
    const move = {
      ply: 0,
      color: "white",
      whiteWinPercentAfter: 55,
      whiteScoreAfter: { type: "cp", value: -220 },
    } as ReviewedMove;

    expect(formatMoveEvalAfter(move)).toBe("-2.2");
  });

  it("falls back to whiteWinPercentAfter when score is missing", () => {
    const move = {
      ply: 1,
      color: "black",
      whiteWinPercentAfter: 55,
    } as ReviewedMove;

    const label = formatMoveEvalAfter(move);
    expect(label).toMatch(/^\+/);
  });
});
