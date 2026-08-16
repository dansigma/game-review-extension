import { describe, expect, it } from "vitest";
import { isSacrifice } from "../src/sacrifice.ts";

const START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("isSacrifice", () => {
  it("returns false for e4 from the starting position", () => {
    expect(isSacrifice(START, "e2e4")).toBe(false);
  });

  it("returns false for Bd6 onto an attacked-but-defended square", () => {
    const fen = "rnbqkb1r/ppp3ppp/4p3/8/5B2/8/PPPP1PPP/RNBQK1NR b KQkq - 0 5";
    expect(isSacrifice(fen, "f8d6")).toBe(false);
  });

  it("detects a hanging knight", () => {
    const fen = "7k/8/8/3q4/8/2N5/8/K7 w - - 0 1";
    expect(isSacrifice(fen, "c3b5")).toBe(true);
  });

  it("detects Greek gift Bxh7 when the king recaptures", () => {
    const fen = "7k/8/6B1/7p/8/8/8/K7 w - - 0 1";
    expect(isSacrifice(fen, "g6h7")).toBe(true);
  });

  it("returns false for an unattacked capture that gains material", () => {
    const fen = "7k/8/8/8/8/7B/1p6/K7 w - - 0 1";
    expect(isSacrifice(fen, "h3b2")).toBe(false);
  });

  it("returns false for illegal UCI", () => {
    expect(isSacrifice(START, "e2e5")).toBe(false);
  });

  it("returns false for a quiet pawn move when another piece was already hanging", () => {
    const fen =
      "rnbqkbnr/ppp1pppp/8/3q4/8/2N5/P1PPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(isSacrifice(fen, "a2a3")).toBe(false);
  });
});
