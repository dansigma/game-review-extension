import { describe, expect, it } from "vitest";
import { LIVE_GAME_MESSAGE_PT } from "../src/lichessProvider.ts";
import {
  ENGINE_LOAD_ERROR_PT,
  formatLichessExportHttpError,
  formatReviewError,
} from "../src/reviewErrors.ts";

describe("formatLichessExportHttpError", () => {
  it("maps 404 to partida não encontrada", () => {
    expect(formatLichessExportHttpError(404)).toBe("Partida não encontrada");
  });

  it("maps 429 to rate limit message", () => {
    expect(formatLichessExportHttpError(429)).toBe(
      "Muitas requisições — tente novamente mais tarde",
    );
  });
});

describe("formatReviewError", () => {
  it("maps legacy background HTTP errors", () => {
    expect(formatReviewError(new Error("Lichess export HTTP 404"))).toBe(
      "Partida não encontrada",
    );
    expect(formatReviewError(new Error("Lichess export HTTP 429"))).toBe(
      "Muitas requisições — tente novamente mais tarde",
    );
  });

  it("maps network failures", () => {
    expect(formatReviewError(new Error("Failed to fetch"))).toBe("Falha de rede");
    expect(formatReviewError(new Error("Background request failed"))).toBe(
      "Falha de rede",
    );
  });

  it("keeps live game message", () => {
    expect(formatReviewError(new Error(LIVE_GAME_MESSAGE_PT))).toBe(
      LIVE_GAME_MESSAGE_PT,
    );
  });

  it("maps engine load failures", () => {
    expect(formatReviewError(new Error("WASM instantiate failed"))).toBe(
      ENGINE_LOAD_ERROR_PT,
    );
    expect(formatReviewError(new Error("NNUE file missing"))).toBe(
      ENGINE_LOAD_ERROR_PT,
    );
  });
});
