import { describe, expect, it } from "vitest";
import { ALGO_VERSION } from "../src/types.ts";
import { buildFallbackComment } from "../src/fallbackComment.ts";
import type { CommentSlice } from "../src/commentSlice.ts";

const FEN_START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function blunderSlice(overrides: Partial<CommentSlice> = {}): CommentSlice {
  return {
    gameId: "game-1",
    algoVersion: ALGO_VERSION,
    ply: 10,
    san: "Qh4??",
    color: "white",
    classification: "blunder",
    commentIntent: "blunder_explanation",
    winPercentDelta: -25,
    suggestedLength: "standard",
    epl: 0.4,
    accuracy: 20,
    playerWinPercentBefore: 60,
    playerWinPercentAfter: 35,
    playedIsBest: false,
    bestSan: "Nf3",
    engineLine: "Nf3 d5",
    onlyMove: false,
    evalAfter: "-2.5",
    evalBefore: "+0.5",
    fenAfter: FEN_START,
    ...overrides,
  };
}

const UCI_PATTERN = /\b[a-h][1-8][a-h][1-8][qrbn]?\b/i;

describe("buildFallbackComment", () => {
  it("mentions class, played SAN, and best SAN for a blunder", () => {
    const text = buildFallbackComment(blunderSlice());

    expect(text).toContain("Blunder");
    expect(text).toContain("Qh4??");
    expect(text).toContain("Nf3");
    expect(text).toMatch(/melhor lance era Nf3/i);
  });

  it("always returns two sentences", () => {
    const text = buildFallbackComment(blunderSlice());
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
  });

  it("does not leak UCI-like tokens or FEN", () => {
    const text = buildFallbackComment(
      blunderSlice({
        san: "e4",
        bestSan: "d4",
        engineLine: "d4 Nf6 c4",
        fenAfter: FEN_START,
      }),
    );

    expect(text).not.toMatch(UCI_PATTERN);
    expect(text).not.toContain(FEN_START);
    expect(text).not.toContain("fenAfter");
    expect(text.toLowerCase()).not.toContain("fen");
  });

  it("uses eval when played move is best and no better SAN", () => {
    const text = buildFallbackComment(
      blunderSlice({
        san: "Nf3",
        classification: "best",
        playedIsBest: true,
        bestSan: undefined,
        engineLine: undefined,
        evalAfter: "+1.2",
        evalBefore: "+0.8",
      }),
    );

    expect(text).toContain("Best");
    expect(text).toContain("Nf3");
    expect(text).toContain("+0.8");
    expect(text).toContain("+1.2");
    expect(text).not.toContain("melhor lance era");
  });
});
