import { describe, expect, it } from "vitest";
import { isChesscomTaggedGameId } from "../src/chesscomExport.ts";
import {
  CHESSCOM_GAME_HINT_PT,
  gameCardHint,
  isLichessSessionGameId,
  isPgnDerivedGameId,
  isSessionReloadableGameId,
  LICHESS_GAME_HINT_PT,
  NO_GAME_HINT_PT,
  PGN_LOAD_HINT_PT,
} from "../src/gameCardDisplay.ts";

describe("gameCardDisplay", () => {
  it("maps load source to hint copy", () => {
    expect(gameCardHint(null)).toBe(NO_GAME_HINT_PT);
    expect(gameCardHint("lichess")).toBe(LICHESS_GAME_HINT_PT);
    expect(gameCardHint("chesscom")).toBe(CHESSCOM_GAME_HINT_PT);
    expect(gameCardHint("pgn")).toBe(PGN_LOAD_HINT_PT);
  });

  it("enables reload for Lichess and Chess.com session ids", () => {
    expect(isSessionReloadableGameId(null)).toBe(false);
    expect(isSessionReloadableGameId("pgn:deadbeef")).toBe(false);
    expect(isSessionReloadableGameId("8fuPHGyu")).toBe(true);
    expect(isSessionReloadableGameId("chesscom:live:142074276742")).toBe(true);
    expect(isSessionReloadableGameId("short")).toBe(false);
  });

  it("keeps Lichess-only session detection", () => {
    expect(isLichessSessionGameId("chesscom:live:1")).toBe(false);
    expect(isLichessSessionGameId("8fuPHGyu")).toBe(true);
  });

  it("detects Chess.com tagged ids", () => {
    expect(isChesscomTaggedGameId("chesscom:live:142074276742")).toBe(true);
    expect(isChesscomTaggedGameId("chesscom:daily:999")).toBe(true);
  });

  it("detects hashed PGN game ids", () => {
    expect(isPgnDerivedGameId("pgn:a1b2c3d4")).toBe(true);
    expect(isPgnDerivedGameId("8fuPHGyu")).toBe(false);
  });
});
