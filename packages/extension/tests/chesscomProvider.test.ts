import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STANDARD_START_FEN } from "@game-review/core";
import type {
  ChesscomArchiveJson,
  ChesscomCallbackJson,
} from "../src/chesscomExport.ts";
import { ARCHIVE_NOT_READY_MESSAGE_PT } from "../src/chesscomExport.ts";
import {
  archiveGameToNormalizedGame,
  assertReviewableChesscomCallback,
  ChesscomProviderError,
  isLiveChesscomCallback,
  loadChesscomGameFromSources,
  LIVE_GAME_MESSAGE_PT,
} from "../src/chesscomProvider.ts";

function fixture<T>(name: string): T {
  const raw = readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
  return JSON.parse(raw) as T;
}

describe("chesscomProvider", () => {
  it("maps callback + archive into NormalizedGame", async () => {
    const callback = fixture<ChesscomCallbackJson>("chesscom-finished-callback.json");
    const archive = fixture<ChesscomArchiveJson>("chesscom-finished-archive.json");

    const game = await loadChesscomGameFromSources(
      { kind: "live", id: "142074276742" },
      async () => callback,
      async () => archive,
    );

    expect(game.gameId).toBe("chesscom:live:142074276742");
    expect(game.variant).toBe("standard");
    expect(game.result).toBe("1-0");
    expect(game.players.white).toMatchObject({ name: "AliceChess", rating: 1500 });
    expect(game.players.black).toMatchObject({ name: "BobChess", rating: 1400 });
    expect(game.initialFen).toBe(STANDARD_START_FEN);
    expect(game.moves).toHaveLength(7);
    expect(game.moves[0]).toMatchObject({ san: "e4", color: "white" });
    expect(game.moves[6]).toMatchObject({ san: "Qxf7#", color: "white" });
  });

  it("rejects live callback games", () => {
    const callback = fixture<ChesscomCallbackJson>("chesscom-live-callback.json");
    expect(isLiveChesscomCallback(callback)).toBe(true);
    expect(() => assertReviewableChesscomCallback(callback)).toThrow(ChesscomProviderError);
    expect(() => assertReviewableChesscomCallback(callback)).toThrow(LIVE_GAME_MESSAGE_PT);
  });

  it("rejects non-standard variants", () => {
    const callback = fixture<ChesscomCallbackJson>("chesscom-variant-callback.json");
    expect(() => assertReviewableChesscomCallback(callback)).toThrow(/Variante não suportada/i);
  });

  it("rejects archive games with non-chess rules", () => {
    const archiveGame = fixture<ChesscomArchiveJson>("chesscom-finished-archive.json").games![0]!;
    expect(() =>
      archiveGameToNormalizedGame({ ...archiveGame, rules: "chess960" }, "chesscom:live:1"),
    ).toThrow(/Variante não suportada/i);
  });

  it("tries black archive when white archive misses", async () => {
    const callback = fixture<ChesscomCallbackJson>("chesscom-finished-callback.json");
    const archive = fixture<ChesscomArchiveJson>("chesscom-finished-archive.json");
    const empty = fixture<ChesscomArchiveJson>("chesscom-empty-archive.json");
    const calls: string[] = [];

    const game = await loadChesscomGameFromSources(
      { kind: "live", id: "142074276742" },
      async () => callback,
      async (username) => {
        calls.push(username);
        return username === "AliceChess" ? empty : archive;
      },
    );

    expect(calls).toEqual(["AliceChess", "BobChess"]);
    expect(game.gameId).toBe("chesscom:live:142074276742");
  });

  it("reports archive miss with PT guidance", async () => {
    const callback = fixture<ChesscomCallbackJson>("chesscom-finished-callback.json");
    const empty = fixture<ChesscomArchiveJson>("chesscom-empty-archive.json");

    await expect(
      loadChesscomGameFromSources(
        { kind: "live", id: "142074276742" },
        async () => callback,
        async () => empty,
      ),
    ).rejects.toThrow(ARCHIVE_NOT_READY_MESSAGE_PT);
  });
});
