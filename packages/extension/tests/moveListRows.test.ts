import { describe, expect, it } from "vitest";
import type { ReviewedMove } from "@game-review/core";
import {
  moveListRows,
  type MoveListFilter,
} from "../src/ui/moveListRows.ts";

function fakeMove(
  overrides: Partial<ReviewedMove> & Pick<ReviewedMove, "ply" | "color">,
): ReviewedMove {
  return {
    san: overrides.san ?? "e4",
    uci: overrides.uci ?? "e2e4",
    classification: overrides.classification ?? "best",
    classificationLabel: overrides.classificationLabel ?? "Best",
    epl: overrides.epl ?? 0,
    accuracy: overrides.accuracy ?? 99,
    playerWinPercentBefore: overrides.playerWinPercentBefore ?? 55,
    playerWinPercentAfter: overrides.playerWinPercentAfter ?? 54,
    whiteWinPercentAfter: overrides.whiteWinPercentAfter ?? 55,
    whiteScoreAfter: overrides.whiteScoreAfter ?? { type: "cp", value: 0 },
    whiteScoreBefore: overrides.whiteScoreBefore ?? { type: "cp", value: 0 },
    bestUci: overrides.bestUci ?? "e2e4",
    playedIsBest: overrides.playedIsBest ?? true,
    ...overrides,
  };
}

describe("moveListRows", () => {
  const fourPlies: ReviewedMove[] = [
    fakeMove({ ply: 0, color: "white", san: "e4", classification: "best" }),
    fakeMove({ ply: 1, color: "black", san: "e5", classification: "good" }),
    fakeMove({ ply: 2, color: "white", san: "Nf3", classification: "good" }),
    fakeMove({
      ply: 3,
      color: "black",
      san: "Nc6",
      classification: "blunder",
    }),
  ];

  it("without filter pairs four plies into two rows", () => {
    const rows = moveListRows(fourPlies, null);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.number).toBe(1);
    expect(rows[0]?.white?.san).toBe("e4");
    expect(rows[0]?.black?.san).toBe("e5");
    expect(rows[1]?.number).toBe(2);
    expect(rows[1]?.white?.san).toBe("Nf3");
    expect(rows[1]?.black?.san).toBe("Nc6");
  });

  it("filters black blunders with empty white cell and preserved move number", () => {
    const moves: ReviewedMove[] = [
      fakeMove({ ply: 0, color: "white", san: "e4", classification: "best" }),
      fakeMove({ ply: 1, color: "black", san: "e5", classification: "good" }),
      fakeMove({
        ply: 2,
        color: "white",
        san: "Nf3",
        classification: "good",
      }),
      fakeMove({
        ply: 3,
        color: "black",
        san: "Nc6",
        classification: "blunder",
      }),
      fakeMove({ ply: 4, color: "white", san: "Bb5", classification: "best" }),
      fakeMove({
        ply: 5,
        color: "black",
        san: "a6",
        classification: "blunder",
      }),
    ];

    const filter: MoveListFilter = { color: "black", classification: "blunder" };
    const rows = moveListRows(moves, filter);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.number).toBe(2);
    expect(rows[0]?.white).toBeNull();
    expect(rows[0]?.black?.san).toBe("Nc6");
    expect(rows[1]?.number).toBe(3);
    expect(rows[1]?.white).toBeNull();
    expect(rows[1]?.black?.san).toBe("a6");
  });

  it("filters white inaccuracies with empty black cell", () => {
    const moves: ReviewedMove[] = [
      fakeMove({
        ply: 0,
        color: "white",
        san: "d4",
        classification: "inaccuracy",
      }),
      fakeMove({ ply: 1, color: "black", san: "d5", classification: "best" }),
      fakeMove({ ply: 2, color: "white", san: "c4", classification: "best" }),
      fakeMove({ ply: 3, color: "black", san: "e6", classification: "good" }),
      fakeMove({
        ply: 4,
        color: "white",
        san: "Nc3",
        classification: "inaccuracy",
      }),
      fakeMove({ ply: 5, color: "black", san: "Nf6", classification: "good" }),
    ];

    const filter: MoveListFilter = {
      color: "white",
      classification: "inaccuracy",
    };
    const rows = moveListRows(moves, filter);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.number).toBe(1);
    expect(rows[0]?.white?.san).toBe("d4");
    expect(rows[0]?.black).toBeNull();
    expect(rows[1]?.number).toBe(3);
    expect(rows[1]?.white?.san).toBe("Nc3");
    expect(rows[1]?.black).toBeNull();
  });

  it("returns empty rows when filter class count is zero", () => {
    const filter: MoveListFilter = { color: "white", classification: "blunder" };
    const rows = moveListRows(fourPlies, filter);
    expect(rows).toEqual([]);
  });

  it("never includes forced moves when filtering dashboard classes", () => {
    const moves: ReviewedMove[] = [
      fakeMove({ ply: 0, color: "white", san: "e4", classification: "best" }),
      fakeMove({
        ply: 1,
        color: "black",
        san: "e5",
        classification: "forced",
      }),
      fakeMove({ ply: 2, color: "white", san: "Nf3", classification: "best" }),
      fakeMove({ ply: 3, color: "black", san: "Nc6", classification: "good" }),
    ];

    const filter: MoveListFilter = { color: "black", classification: "best" };
    const rows = moveListRows(moves, filter);
    expect(rows).toEqual([]);
  });
});
