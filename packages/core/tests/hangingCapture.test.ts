import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  isNewlyHangingCapture,
  isTrivialHangingCapture,
  squareSee,
  wasWinningCaptureOnSquare,
} from "../src/hangingCapture.ts";
import { isCapture } from "../src/recapture.ts";

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

function isUciMove(move: string): boolean {
  return /^[a-h][1-8][a-h][1-8][nbrq]?$/i.test(move.trim());
}

function playFromFen(
  fen: string,
  moves: string[],
): {
  fensBefore: string[];
  ucis: string[];
} {
  const chess = new Chess(fen);
  const fensBefore: string[] = [];
  const ucis: string[] = [];
  for (const san of moves) {
    fensBefore.push(chess.fen());
    const move = isUciMove(san)
      ? chess.move({
          from: san.slice(0, 2),
          to: san.slice(2, 4),
          promotion: san.length > 4 ? san[4] : undefined,
        })
      : chess.move(san);
    if (!move) {
      throw new Error(`Illegal move: ${san}`);
    }
    ucis.push(move.from + move.to + (move.promotion ?? ""));
  }
  return { fensBefore, ucis };
}

describe("squareSee", () => {
  it("returns net gain when a hung piece has no recapture on the square", () => {
    const fenBefore =
      "rnbqkb1r/pppp1ppp/5n2/8/8/5B2/PPPP1PPP/RNBQK1NR b KQkq - 0 5";
    const { fensBefore, ucis } = playFromFen(fenBefore, ["Ne4", "Bxe4"]);
    const see = squareSee(fensBefore[1]!, ucis[1]!);
    expect(see).not.toBeNull();
    expect(see!).toBeGreaterThan(100);
  });

  it("returns null for quiet moves", () => {
    const { fensBefore, ucis } = playLine(["e4", "e5"]);
    expect(squareSee(fensBefore[0]!, ucis[0]!)).toBeNull();
  });
});

describe("wasWinningCaptureOnSquare", () => {
  it("is false before a defender protects an equal exchange on the square", () => {
    const fen =
      "rnb1kb1r/ppnppppp/1b6/1N6/8/8/PPPP1PPP/RNBQK1NR b KQkq - 0 8";
    expect(wasWinningCaptureOnSquare(fen, "w", "c7")).toBe(false);
  });

  it("is true when a capture on the square already wins material", () => {
    const fen =
      "rnb1kb1r/ppnppppp/8/1N6/8/8/PPPP1PPP/RNBQK1NR b KQkq - 0 8";
    expect(wasWinningCaptureOnSquare(fen, "w", "c7")).toBe(true);
  });
});

describe("isNewlyHangingCapture", () => {
  it("detects a piece that just moved to an attacked square", () => {
    const fenBefore =
      "rnbqkb1r/pppp1ppp/5n2/8/8/5B2/PPPP1PPP/RNBQK1NR b KQkq - 0 5";
    const { fensBefore, ucis } = playFromFen(fenBefore, ["Ne4", "Bxe4"]);
    const previous = { fenBefore: fensBefore[0]!, uci: ucis[0]! };
    const current = { fenBefore: fensBefore[1]!, uci: ucis[1]! };
    expect(isNewlyHangingCapture(previous, current)).toBe(true);
    expect(isTrivialHangingCapture(previous, current, "c2c3")).toBe(true);
  });

  it("detects material that became hanging when a defender moved away", () => {
    const fenBefore =
      "rnb1kb1r/ppnppppp/1b6/1N6/8/8/PPPP1PPP/RNBQK1NR b KQkq - 0 8";
    const { fensBefore, ucis } = playFromFen(fenBefore, ["b6c5", "b5c7"]);
    const previous = { fenBefore: fensBefore[0]!, uci: ucis[0]! };
    const current = { fenBefore: fensBefore[1]!, uci: ucis[1]! };
    expect(wasWinningCaptureOnSquare(fenBefore, "w", "c7")).toBe(false);
    expect(isNewlyHangingCapture(previous, current)).toBe(true);
  });

  it("is false when the capture was already winning before the opponent moved", () => {
    const fenBefore =
      "rnb1kb1r/ppnppppp/8/1N6/8/8/PPPP1PPP/RNBQK1NR b KQkq - 0 8";
    expect(wasWinningCaptureOnSquare(fenBefore, "w", "c7")).toBe(true);
    const { fensBefore, ucis } = playFromFen(fenBefore, ["h6", "b5c7"]);
    const previous = { fenBefore: fensBefore[0]!, uci: ucis[0]! };
    const current = { fenBefore: fensBefore[1]!, uci: ucis[1]! };
    expect(isNewlyHangingCapture(previous, current)).toBe(false);
  });

  it("is false for protected equal exchanges", () => {
    const fenBefore =
      "rnbqkb1r/pppp1ppp/5n2/3p4/8/5B2/PPPP1PPP/RNBQK1NR b KQkq - 0 5";
    const { fensBefore, ucis } = playFromFen(fenBefore, ["Ne4", "Bxe4"]);
    const previous = { fenBefore: fensBefore[0]!, uci: ucis[0]! };
    const current = { fenBefore: fensBefore[1]!, uci: ucis[1]! };
    expect(squareSee(fensBefore[1]!, ucis[1]!)).toBe(0);
    expect(isNewlyHangingCapture(previous, current)).toBe(false);
  });

  it("is false without a previous ply", () => {
    const fenBefore =
      "rnbqkb1r/pppp1ppp/5n2/8/8/5B2/PPPP1PPP/RNBQK1NR b KQkq - 0 5";
    const { fensBefore, ucis } = playFromFen(fenBefore, ["Ne4", "Bxe4"]);
    expect(
      isNewlyHangingCapture(undefined, {
        fenBefore: fensBefore[1]!,
        uci: ucis[1]!,
      }),
    ).toBe(false);
  });

  it("is false for quiet moves", () => {
    const { fensBefore, ucis } = playLine(["e4", "e5", "Nf3"]);
    const previous = { fenBefore: fensBefore[1]!, uci: ucis[1]! };
    const current = { fenBefore: fensBefore[2]!, uci: ucis[2]! };
    expect(isCapture(current.fenBefore, current.uci)).toBe(false);
    expect(isNewlyHangingCapture(previous, current)).toBe(false);
  });
});

describe("isTrivialHangingCapture", () => {
  it("is false when PV2 captures the same square from another square", () => {
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
    expect(isTrivialHangingCapture(previous, current, "d8d5")).toBe(false);
  });
});
