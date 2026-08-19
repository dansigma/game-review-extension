import { describe, expect, it } from "vitest";
import type { CriticalMoment } from "@game-review/core";
import { pass2EvalIndexes } from "../src/pass2EvalIndexes.ts";

function moment(ply: number): CriticalMoment {
  return {
    ply,
    color: "white",
    san: "e4",
    epl: 0.2,
    winPercentSwing: 10,
    classification: "mistake",
    evalAfter: "+0.5",
  };
}

describe("pass2EvalIndexes", () => {
  it("returns empty for no critical moments", () => {
    expect(pass2EvalIndexes([])).toEqual([]);
  });

  it("includes before and after eval indexes for each critical ply", () => {
    expect(pass2EvalIndexes([moment(2), moment(5)])).toEqual([2, 3, 5, 6]);
  });

  it("deduplicates overlapping indexes", () => {
    expect(pass2EvalIndexes([moment(2), moment(3)])).toEqual([2, 3, 4]);
  });

  it("respects cap from selectCriticalMoments via caller-provided list", () => {
    const capped = [moment(0), moment(4), moment(8)];
    expect(pass2EvalIndexes(capped)).toEqual([0, 1, 4, 5, 8, 9]);
    expect(pass2EvalIndexes(capped).length).toBe(6);
  });
});
