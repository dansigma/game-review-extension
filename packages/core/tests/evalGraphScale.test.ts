import { describe, expect, it } from "vitest";
import {
  clampGraphPawns,
  graphPawns,
  graphYFraction,
  pawnsFromWhiteScore,
} from "../src/evalGraphScale.ts";
import type { EvalGraphPoint } from "../src/types.ts";

describe("pawnsFromWhiteScore", () => {
  it("converts centipawns to pawn decimals", () => {
    expect(pawnsFromWhiteScore({ type: "cp", value: 220 })).toBe(2.2);
    expect(pawnsFromWhiteScore({ type: "cp", value: -350 })).toBe(-3.5);
    expect(pawnsFromWhiteScore({ type: "cp", value: 0 })).toBe(0);
  });

  it("maps mates to the graph cap with sign", () => {
    expect(pawnsFromWhiteScore({ type: "mate", value: 3 })).toBe(4);
    expect(pawnsFromWhiteScore({ type: "mate", value: -2 })).toBe(-4);
    expect(pawnsFromWhiteScore({ type: "mate", value: 0 })).toBe(0);
  });
});

describe("graphPawns", () => {
  it("uses whiteScore when present", () => {
    const point: EvalGraphPoint = {
      ply: 0,
      whiteWinPercent: 50,
      whiteScore: { type: "cp", value: 220 },
    };
    expect(graphPawns(point)).toBe(2.2);
  });

  it("falls back to whiteWinPercent when whiteScore is missing", () => {
    const neutral: EvalGraphPoint = { ply: 0, whiteWinPercent: 50 };
    expect(graphPawns(neutral)).toBeCloseTo(0, 1);

    const whiteBetter: EvalGraphPoint = { ply: 1, whiteWinPercent: 55 };
    expect(graphPawns(whiteBetter)).toBeGreaterThan(0);
  });
});

describe("graphYFraction", () => {
  it("maps cap and midline to chart fractions", () => {
    expect(graphYFraction(4)).toBe(1);
    expect(graphYFraction(0)).toBe(0.5);
    expect(graphYFraction(-4)).toBe(0);
  });
});

describe("clampGraphPawns", () => {
  it("clamps to ±4", () => {
    expect(clampGraphPawns(8)).toBe(4);
    expect(clampGraphPawns(-10)).toBe(-4);
    expect(clampGraphPawns(2.2)).toBe(2.2);
  });
});
