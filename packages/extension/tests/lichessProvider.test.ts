import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STANDARD_START_FEN } from "@game-review/core";
import type { LichessExportJson } from "../src/lichessExport.ts";
import {
  buildPgnFromLichessExport,
  lichessExportToNormalizedGame,
  LichessProviderError,
  LIVE_GAME_MESSAGE_PT,
} from "../src/lichessProvider.ts";

function fixture(name: string): LichessExportJson {
  const raw = readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
  return JSON.parse(raw) as LichessExportJson;
}

describe("lichessProvider", () => {
  it("maps Scholar's Mate export JSON into NormalizedGame", () => {
    const json = fixture("scholars-mate-export.json");
    const game = lichessExportToNormalizedGame(json);

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
  });

  it("builds PGN with GameId header from export JSON", () => {
    const pgn = buildPgnFromLichessExport(fixture("scholars-mate-export.json"));
    expect(pgn).toContain('[GameId "fixture1"]');
    expect(pgn).toContain('[Variant "Standard"]');
    expect(pgn).toContain("1-0");
  });

  it("maps SAN movetext from the real Lichess JSON shape", () => {
    const json = fixture("scholars-mate-export.json");
    expect(json.moves).toBe("e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#");
    const game = lichessExportToNormalizedGame(json);
    expect(game.moves.map((move) => move.san)).toEqual([
      "e4",
      "e5",
      "Qh5",
      "Nc6",
      "Bc4",
      "Nf6",
      "Qxf7#",
    ]);
  });

  it("still accepts UCI tokens if a fixture uses them", () => {
    const json = fixture("scholars-mate-export.json");
    const uciJson: LichessExportJson = {
      ...json,
      moves: "e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7",
    };
    const game = lichessExportToNormalizedGame(uciJson);
    expect(game.moves[6]?.uci).toBe("h5f7");
  });

  it("prefers the pgn field when pgnInJson is present", () => {
    const json = fixture("scholars-mate-export.json");
    const withPgn: LichessExportJson = {
      ...json,
      moves: "this is not chess",
      pgn: `[GameId "fixture1"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[Variant "Standard"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`,
    };
    const game = lichessExportToNormalizedGame(withPgn);
    expect(game.gameId).toBe("fixture1");
    expect(game.moves).toHaveLength(7);
  });

  it("rejects live games (status started)", () => {
    const json = fixture("live-game-export.json");
    expect(() => lichessExportToNormalizedGame(json)).toThrow(LichessProviderError);
    expect(() => lichessExportToNormalizedGame(json)).toThrow(LIVE_GAME_MESSAGE_PT);
  });

  it("rejects non-standard variants", () => {
    const json = fixture("crazyhouse-export.json");
    expect(() => lichessExportToNormalizedGame(json)).toThrow(/Variante não suportada/i);
  });
});
