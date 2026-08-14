import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildChesscomTaggedGameId,
  chesscomArchiveUrl,
  chesscomCallbackUrl,
  extractChesscomGameRef,
  findArchiveGame,
  gameUrlMatchesRef,
  isChesscomTaggedGameId,
  parseArchiveDate,
  parseChesscomTaggedGameId,
  type ChesscomArchiveJson,
  type ChesscomCallbackJson,
} from "../src/chesscomExport.ts";

function fixture<T>(name: string): T {
  const raw = readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
  return JSON.parse(raw) as T;
}

describe("chesscomExport", () => {
  it("builds callback and archive URLs", () => {
    expect(chesscomCallbackUrl("live", "142074276742")).toBe(
      "https://www.chess.com/callback/live/game/142074276742",
    );
    expect(chesscomArchiveUrl("AliceChess", 2024, 3)).toBe(
      "https://api.chess.com/pub/player/AliceChess/games/2024/03",
    );
  });

  it("parses live, daily, analysis, tagged, and junk URLs", () => {
    expect(extractChesscomGameRef("https://www.chess.com/game/live/142074276742")).toEqual({
      kind: "live",
      id: "142074276742",
    });
    expect(extractChesscomGameRef("https://www.chess.com/game/daily/999")).toEqual({
      kind: "daily",
      id: "999",
    });
    expect(
      extractChesscomGameRef("https://www.chess.com/analysis/game/live/142074276742?move=10"),
    ).toEqual({
      kind: "live",
      id: "142074276742",
    });
    expect(extractChesscomGameRef("chesscom:live:142074276742")).toEqual({
      kind: "live",
      id: "142074276742",
    });
    expect(extractChesscomGameRef("https://www.chess.com/home")).toBeUndefined();
    expect(extractChesscomGameRef("https://lichess.org/abcdefgh")).toBeUndefined();
  });

  it("builds and parses stable tagged game ids", () => {
    const tagged = buildChesscomTaggedGameId("live", "142074276742");
    expect(tagged).toBe("chesscom:live:142074276742");
    expect(isChesscomTaggedGameId(tagged)).toBe(true);
    expect(parseChesscomTaggedGameId(tagged)).toEqual({
      kind: "live",
      id: "142074276742",
    });
    expect(isChesscomTaggedGameId("8fuPHGyu")).toBe(false);
  });

  it("parses archive dates from callback headers", () => {
    expect(parseArchiveDate("2024.03.15")).toEqual({ year: 2024, month: 3 });
    expect(parseArchiveDate("bad-date")).toBeUndefined();
  });

  it("finds archive games by url/id", () => {
    const archive = fixture<ChesscomArchiveJson>("chesscom-finished-archive.json");
    const found = findArchiveGame(archive, "live", "142074276742");
    expect(found?.rules).toBe("chess");
    expect(found?.pgn).toContain("1. e4 e5");
    expect(gameUrlMatchesRef(found!.url, "live", "142074276742")).toBe(true);
  });

  it("loads minimized callback fixture shape", () => {
    const callback = fixture<ChesscomCallbackJson>("chesscom-finished-callback.json");
    expect(callback.game?.isFinished).toBe(true);
    expect(callback.game?.pgnHeaders?.White).toBe("AliceChess");
    expect(callback.game?.moveList).toBe("ignored-proprietary-blob");
  });
});
