import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  isCapture,
  isRecapture,
  isTrivialRecapture,
} from "../src/recapture.ts";

function playLine(moves: string[]): {
  fensBefore: string[];
  ucis: string[];
} {
  const chess = new Chess();
  const fensBefore: string[] = [];
  const ucis: string[] = [];
  for (const san of moves) {
    fensBefore.push(chess.fen());
    const move = chess.move(san);
    if (!move) {
      throw new Error(`Illegal move: ${san}`);
    }
    ucis.push(move.from + move.to + (move.promotion ?? ""));
  }
  return { fensBefore, ucis };
}

describe("isCapture", () => {
  it("returns true for captures and en passant", () => {
    const { fensBefore, ucis } = playLine(["e4", "e5", "d4", "exd4"]);
    expect(isCapture(fensBefore[3]!, ucis[3]!)).toBe(true);
  });

  it("returns false for quiet moves and illegal UCI", () => {
    const { fensBefore, ucis } = playLine(["e4", "e5"]);
    expect(isCapture(fensBefore[0]!, ucis[0]!)).toBe(false);
    expect(isCapture(fensBefore[0]!, "z9z9")).toBe(false);
    expect(isCapture("not-a-fen", "e2e4")).toBe(false);
  });
});

describe("isRecapture", () => {
  it("detects recapture on the square the opponent just captured on", () => {
    const { fensBefore, ucis } = playLine([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "d4",
      "exd4",
      "Nxd4",
    ]);
    const previous = { fenBefore: fensBefore[5]!, uci: ucis[5]! };
    const current = { fenBefore: fensBefore[6]!, uci: ucis[6]! };
    expect(isRecapture(previous, current)).toBe(true);
  });

  it("is false when capture is on a different square", () => {
    const { fensBefore, ucis } = playLine(["e4", "d5", "exd5", "Nf6"]);
    const previous = { fenBefore: fensBefore[2]!, uci: ucis[2]! };
    const current = { fenBefore: fensBefore[3]!, uci: ucis[3]! };
    expect(isRecapture(previous, current)).toBe(false);
  });

  it("is false without a previous ply", () => {
    const { fensBefore, ucis } = playLine(["e4"]);
    expect(
      isRecapture(undefined, {
        fenBefore: fensBefore[0]!,
        uci: ucis[0]!,
      }),
    ).toBe(false);
  });
});

describe("isTrivialRecapture", () => {
  it("is trivial when PV2 is not another recapture on the same square", () => {
    const { fensBefore, ucis } = playLine([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "d4",
      "exd4",
      "Nxd4",
    ]);
    const previous = { fenBefore: fensBefore[5]!, uci: ucis[5]! };
    const current = { fenBefore: fensBefore[6]!, uci: ucis[6]! };
    expect(isTrivialRecapture(previous, current, "c2c3")).toBe(true);
    expect(isTrivialRecapture(previous, current)).toBe(true);
  });

  it("is not trivial when PV2 recaptures with a different piece on the same square", () => {
    const { fensBefore, ucis } = playLine([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bc4",
      "Nf6",
      "Ng5",
      "d5",
      "exd5",
      "Nxd5",
    ]);
    const previous = { fenBefore: fensBefore[8]!, uci: ucis[8]! };
    const current = { fenBefore: fensBefore[9]!, uci: ucis[9]! };
    expect(isTrivialRecapture(previous, current, "d8d5")).toBe(false);
  });

  it("is false when the current ply is not a recapture", () => {
    const { fensBefore, ucis } = playLine(["e4", "e5", "Nf3"]);
    const previous = { fenBefore: fensBefore[1]!, uci: ucis[1]! };
    const current = { fenBefore: fensBefore[2]!, uci: ucis[2]! };
    expect(isTrivialRecapture(previous, current, "d2d4")).toBe(false);
  });
});
