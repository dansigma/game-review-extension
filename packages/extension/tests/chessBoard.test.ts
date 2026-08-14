import { describe, expect, it } from "vitest";
import { fenAtPly } from "../src/ui/chessBoard.ts";

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
