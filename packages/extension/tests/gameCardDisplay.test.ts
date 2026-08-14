import { describe, expect, it } from "vitest";
import {
  gameCardHint,
  isLichessSessionGameId,
  isPgnDerivedGameId,
  LICHESS_GAME_HINT_PT,
  NO_GAME_HINT_PT,
  PGN_LOAD_HINT_PT,
} from "../src/gameCardDisplay.ts";

describe("gameCardDisplay", () => {
  it("maps load source to hint copy", () => {
    expect(gameCardHint(null)).toBe(NO_GAME_HINT_PT);
    expect(gameCardHint("lichess")).toBe(LICHESS_GAME_HINT_PT);
    expect(gameCardHint("pgn")).toBe(PGN_LOAD_HINT_PT);
  });

  it("enables Lichess reload only for session 8-char ids", () => {
    expect(isLichessSessionGameId(null)).toBe(false);
    expect(isLichessSessionGameId("pgn:deadbeef")).toBe(false);
    expect(isLichessSessionGameId("8fuPHGyu")).toBe(true);
    expect(isLichessSessionGameId("fixture1")).toBe(true);
    expect(isLichessSessionGameId("short")).toBe(false);
    expect(isLichessSessionGameId("waytoolong")).toBe(false);
  });

  it("detects hashed PGN game ids", () => {
    expect(isPgnDerivedGameId("pgn:a1b2c3d4")).toBe(true);
    expect(isPgnDerivedGameId("8fuPHGyu")).toBe(false);
  });
});
