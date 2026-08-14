import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PgnParseError, STANDARD_START_FEN } from "@game-review/core";
import {
  containsMultipleGames,
  EMPTY_PGN_MESSAGE_PT,
  loadPgnGame,
  MULTI_GAME_MESSAGE_PT,
  NO_MOVES_MESSAGE_PT,
  PgnProviderError,
} from "../src/pgnProvider.ts";

function coreFixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../core/fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

const MULTI_GAME_PGN = `[Event "Game 1"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 1-0

[Event "Game 2"]
[White "C"]
[Black "D"]
[Result "0-1"]

1. d4 d5 0-1`;

describe("pgnProvider", () => {
  it("maps a valid PGN into NormalizedGame", () => {
    const game = loadPgnGame(coreFixture("scholars-mate.pgn"));

    expect(game.variant).toBe("standard");
    expect(game.result).toBe("1-0");
    expect(game.players.white.name).toBe("Alice");
    expect(game.players.black.name).toBe("Bob");
    expect(game.initialFen).toBe(STANDARD_START_FEN);
    expect(game.moves).toHaveLength(7);
    expect(game.moves[0]).toMatchObject({ san: "e4", uci: "e2e4" });
  });

  it("assigns the same gameId for the same trimmed PGN", () => {
    const pgn = coreFixture("opera-game.pgn");
    const first = loadPgnGame(pgn);
    const second = loadPgnGame(`  ${pgn}  `);

    expect(first.gameId).toBe(second.gameId);
    expect(first.gameId).toMatch(/^pgn:[0-9a-f]{8}$/);
  });

  it("assigns different gameIds for different PGNs", () => {
    const scholars = loadPgnGame(coreFixture("scholars-mate.pgn"));
    const opera = loadPgnGame(coreFixture("opera-game.pgn"));

    expect(scholars.gameId).not.toBe(opera.gameId);
  });

  it("preserves Lichess GameId from headers", () => {
    const game = loadPgnGame(coreFixture("scholars-mate.pgn"));
    expect(game.gameId).toBe("fixture1");
  });

  it("preserves Lichess id from GameId header even without Site", () => {
    const pgn = `[GameId "8fuPHGyu"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 1-0`;
    expect(loadPgnGame(pgn).gameId).toBe("8fuPHGyu");
  });

  it("rejects empty PGN", () => {
    expect(() => loadPgnGame("   ")).toThrow(PgnProviderError);
    expect(() => loadPgnGame("   ")).toThrow(EMPTY_PGN_MESSAGE_PT);
  });

  it("rejects PGN without moves", () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "*"]`;
    expect(() => loadPgnGame(pgn)).toThrow(PgnProviderError);
    expect(() => loadPgnGame(pgn)).toThrow(NO_MOVES_MESSAGE_PT);
  });

  it("rejects multi-game PGN", () => {
    expect(containsMultipleGames(MULTI_GAME_PGN)).toBe(true);
    expect(() => loadPgnGame(MULTI_GAME_PGN)).toThrow(PgnProviderError);
    expect(() => loadPgnGame(MULTI_GAME_PGN)).toThrow(MULTI_GAME_MESSAGE_PT);
  });

  it("rejects crazyhouse via parsePgn", () => {
    const crazyhouse = `[Variant "Crazyhouse"]
[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5`;
    expect(() => loadPgnGame(crazyhouse)).toThrow(PgnParseError);
  });
});
