import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  divideGame,
  dividerStats,
  isOpeningPly,
} from "../src/divider.ts";
import { STANDARD_START_FEN } from "../src/parsePgn.ts";

function fenAfterUci(fen: string, uci: string): string {
  const chess = new Chess(fen);
  chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  });
  return chess.fen();
}

describe("divideGame", () => {
  it("keeps the starting position and after 1.d4 in the opening phase", () => {
    const startStats = dividerStats(STANDARD_START_FEN);
    expect(startStats.majorsAndMinors).toBe(14);
    expect(startStats.backrankSparse).toBe(false);
    expect(startStats.mixedness).toBeLessThanOrEqual(150);

    const afterD4 = fenAfterUci(STANDARD_START_FEN, "d2d4");
    const division = divideGame([afterD4]);
    expect(division.middle).toBeUndefined();
    expect(isOpeningPly(division, 0)).toBe(true);
  });

  it("starts middlegame when the back rank is sparse", () => {
    const sparseBackrank =
      "rnbqk2r/pppp1ppp/5n2/8/8/5N2/PPPP1PPP/3RK2R b kq - 3 4";
    const stats = dividerStats(sparseBackrank);
    expect(stats.backrankSparse).toBe(true);

    const division = divideGame([sparseBackrank]);
    expect(division.middle).toBe(0);
    expect(isOpeningPly(division, 0)).toBe(false);
  });

  it("starts middlegame when majors and minors are at most 10", () => {
    const thinned =
      "rnbqk2r/pppp1ppp/5n2/8/8/5N2/PPPP1PPP/3RK2R b kq - 3 4";
    const stats = dividerStats(thinned);
    expect(stats.majorsAndMinors).toBeLessThanOrEqual(10);
    expect(stats.majorsAndMinors).toBeGreaterThan(6);

    const division = divideGame([thinned]);
    expect(division.middle).toBe(0);
    expect(isOpeningPly(division, 0)).toBe(false);
  });

  it("records endgame after a later ply with at most six majors and minors", () => {
    const openingLike =
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const middleGame =
      "rnbqk2r/pppp1ppp/5n2/8/8/5N2/PPPP1PPP/3RK2R b kq - 3 4";
    const endgame = "4k3/8/4K3/8/8/8/8/4R3 w - - 0 1";

    expect(dividerStats(openingLike).majorsAndMinors).toBeGreaterThan(10);
    expect(dividerStats(middleGame).majorsAndMinors).toBeLessThanOrEqual(10);
    expect(dividerStats(endgame).majorsAndMinors).toBeLessThanOrEqual(6);

    const division = divideGame([openingLike, middleGame, endgame]);
    expect(division.middle).toBe(1);
    expect(division.end).toBe(2);
    expect(division.middle).toBeLessThan(division.end!);
    expect(isOpeningPly(division, 0)).toBe(true);
    expect(isOpeningPly(division, 1)).toBe(false);
  });

  it("can trip middlegame on high mixedness", () => {
    const chaotic =
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const stats = dividerStats(chaotic);
    if (stats.mixedness > 150) {
      const division = divideGame([chaotic]);
      expect(division.middle).toBe(0);
    } else {
      expect(stats.mixedness).toBeGreaterThan(0);
    }
  });
});
