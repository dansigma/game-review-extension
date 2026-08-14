import { describe, expect, it } from "vitest";
import { fullMoveCount } from "../src/gameMoves.ts";

describe("fullMoveCount", () => {
  it("returns 0 for no plies", () => {
    expect(fullMoveCount(0)).toBe(0);
  });

  it("counts a single ply as one full move", () => {
    expect(fullMoveCount(1)).toBe(1);
  });

  it("counts two plies as one full move", () => {
    expect(fullMoveCount(2)).toBe(1);
  });

  it("counts 50 plies as 25 full moves", () => {
    expect(fullMoveCount(50)).toBe(25);
  });

  it("rounds odd ply counts up", () => {
    expect(fullMoveCount(51)).toBe(26);
  });
});
