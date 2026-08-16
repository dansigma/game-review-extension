import { describe, expect, it } from "vitest";
import { isSacrifice } from "../src/sacrifice.ts";

describe("isSacrifice", () => {
  it("returns false for e4 from the starting position", () => {
    const start =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(isSacrifice(start, "e2e4")).toBe(false);
  });

  it("detects a hanging knight with net material 3", () => {
    const fen = "7k/8/8/3q4/8/2N5/8/K7 w - - 0 1";
    expect(isSacrifice(fen, "c3b5")).toBe(true);
  });

  it("rejects Greek gift Bxh7 with net material 2", () => {
    const fen = "rnbqkb1r/pppp1ppp/5n2/8/6B1/8/PPPPPPPP/RN1QKBNR w KQkq - 0 5";
    expect(isSacrifice(fen, "g4h7")).toBe(false);
  });

  it("returns false when the destination is not attacked", () => {
    const fen = "7k/8/8/8/8/7B/1p6/K7 w - - 0 1";
    expect(isSacrifice(fen, "h3h2")).toBe(false);
  });

  it("returns false for illegal UCI", () => {
    const start =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(isSacrifice(start, "e2e5")).toBe(false);
  });
});
