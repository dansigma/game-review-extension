import { describe, expect, it } from "vitest";
import {
  finalStandingFromWinPercent,
  gameEndReasonFromTermination,
} from "../src/gameEndReason.ts";

describe("gameEndReasonFromTermination", () => {
  it.each([
    ["Time forfeit", "time"],
    ["Game drawn by timeout", "time"],
    ["White won on time", "time"],
    ["won on time", "time"],
    ["Game drawn by timeout versus insufficient material", "time"],
    ["Skillfulness ganhou no tempo", "time"],
    ["tempo esgotado", "time"],
    ["Resignation", "resign"],
    ["Checkmate", "mate"],
    ["Stalemate", "stalemate"],
  ] as const)("maps %j to %s", (termination, expected) => {
    expect(gameEndReasonFromTermination(termination)).toBe(expected);
  });

  it("returns unknown when termination is missing", () => {
    expect(gameEndReasonFromTermination(undefined)).toBe("unknown");
    expect(gameEndReasonFromTermination("")).toBe("unknown");
  });
});

describe("finalStandingFromWinPercent", () => {
  it.each([
    [95, "white_winning"],
    [70, "white_winning"],
    [30, "black_winning"],
    [5, "black_winning"],
    [50, "equal"],
  ] as const)("maps %i to %s", (winPercent, expected) => {
    expect(finalStandingFromWinPercent(winPercent)).toBe(expected);
  });
});
