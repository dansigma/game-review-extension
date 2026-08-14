import { describe, expect, it } from "vitest";
import {
  boardRowForRank,
  displayYForRank,
  fenAtPly,
  isDarkSquare,
} from "../src/ui/chessBoard.ts";

describe("fenAtPly", () => {
  const initial =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const afterE4 =
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

  it("returns initial FEN for ply -1", () => {
    expect(fenAtPly(initial, [afterE4], -1)).toBe(initial);
  });

  it("returns fen after move at ply 0", () => {
    expect(fenAtPly(initial, [afterE4], 0)).toBe(afterE4);
  });
});

describe("boardRowForRank", () => {
  it("maps 8th rank to chess.js row 0", () => {
    expect(boardRowForRank(7)).toBe(0);
  });

  it("maps 1st rank to chess.js row 7", () => {
    expect(boardRowForRank(0)).toBe(7);
  });
});

describe("isDarkSquare", () => {
  it("a1 is dark", () => {
    expect(isDarkSquare(0, 0)).toBe(true);
  });

  it("b1 is light", () => {
    expect(isDarkSquare(1, 0)).toBe(false);
  });

  it("a2 is light", () => {
    expect(isDarkSquare(0, 1)).toBe(false);
  });
});

describe("displayYForRank", () => {
  it("places 1st rank at the bottom", () => {
    expect(displayYForRank(0, 35)).toBe(245);
  });

  it("places 8th rank at the top", () => {
    expect(displayYForRank(7, 35)).toBe(0);
  });
});
