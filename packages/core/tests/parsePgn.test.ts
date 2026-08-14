import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePgn, PgnParseError, STANDARD_START_FEN } from "../src/parsePgn.ts";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

describe("parsePgn", () => {
  it("parses Scholar's Mate into NormalizedGame", () => {
    const game = parsePgn(fixture("scholars-mate.pgn"));
    expect(game.variant).toBe("standard");
    expect(game.result).toBe("1-0");
    expect(game.gameId).toBe("fixture1");
    expect(game.players.white).toMatchObject({
      name: "Alice",
      rating: 1500,
    });
    expect(game.players.black.name).toBe("Bob");
    expect(game.timeControl).toEqual({
      initialSeconds: 300,
      incrementSeconds: 0,
    });
    expect(game.initialFen).toBe(STANDARD_START_FEN);
    expect(game.moves).toHaveLength(7);
    expect(game.moves[0]).toMatchObject({
      ply: 0,
      san: "e4",
      uci: "e2e4",
      color: "white",
    });
    expect(game.moves[6]).toMatchObject({
      ply: 6,
      san: "Qxf7#",
      uci: "h5f7",
      color: "white",
    });
    expect(game.moves[0]?.fenAfter).toContain("4P3");
  });

  it("parses the Opera Game including castling and mate", () => {
    const game = parsePgn(fixture("opera-game.pgn"));
    expect(game.moves.length).toBeGreaterThan(30);
    expect(game.players.white.name).toContain("Morphy");
    expect(game.moves.some((move) => move.san === "O-O-O")).toBe(true);
    expect(game.moves.at(-1)).toMatchObject({
      san: "Rd8#",
      color: "white",
    });
  });

  it("rejects an empty PGN", () => {
    expect(() => parsePgn("   ")).toThrow(PgnParseError);
  });

  it("rejects non-standard variants", () => {
    const crazyhouse = `
[Variant "Crazyhouse"]
[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5
`;
    expect(() => parsePgn(crazyhouse)).toThrow(/Unsupported variant/i);
  });
});
