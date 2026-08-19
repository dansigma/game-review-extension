import { describe, expect, it } from "vitest";
import { buildFallbackGameSummary } from "../src/fallbackGameSummary.ts";
import { buildGameSummarySlice } from "../src/gameSummarySlice.ts";
import { ALGO_VERSION } from "../src/types.ts";
import type { GameReview, NormalizedGame, ReviewedMove } from "../src/types.ts";

const LEAK_KEYS = [
  "uci",
  "bestUci",
  "alternativeUci",
  "fen",
  "lines",
  "score",
  "pv",
] as const;

const UCI_PATTERN = /\b[a-h][1-8][a-h][1-8][qrbn]?\b/i;
const FEN_PATTERN = /\b(?:[rnbqkpRNBQKP1-8]+\/){7}/;
const EVAL_PATTERN = /[+-]\d+(\.\d+)?|#\d+/;

function fakeMove(
  overrides: Partial<ReviewedMove> & Pick<ReviewedMove, "ply" | "color" | "epl">,
): ReviewedMove {
  return {
    san: overrides.san ?? "e4",
    uci: overrides.uci ?? "e2e4",
    classification: overrides.classification ?? "mistake",
    classificationLabel: overrides.classificationLabel ?? "Erro",
    accuracy: overrides.accuracy ?? 80,
    playerWinPercentBefore: overrides.playerWinPercentBefore ?? 55,
    playerWinPercentAfter: overrides.playerWinPercentAfter ?? 40,
    whiteWinPercentAfter: overrides.whiteWinPercentAfter ?? 50,
    whiteScoreAfter: overrides.whiteScoreAfter ?? { type: "cp", value: 0 },
    whiteScoreBefore: overrides.whiteScoreBefore ?? { type: "cp", value: 0 },
    bestUci: overrides.bestUci ?? "d2d4",
    playedIsBest: overrides.playedIsBest ?? false,
    ...overrides,
  };
}

function stubGame(overrides: Partial<NormalizedGame> = {}): NormalizedGame {
  return {
    gameId: "game-1",
    variant: "standard",
    result: "1-0",
    players: {
      white: { name: "Alice" },
      black: { name: "Bob" },
    },
    initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    moves: [],
    ...overrides,
  };
}

function stubReview(moves: ReviewedMove[]): GameReview {
  return {
    gameId: "game-1",
    algoVersion: ALGO_VERSION,
    engineId: "sf_18",
    white: {
      color: "white",
      movesCounted: 1,
      movesExcludedForced: 0,
      accuracy: 91.2,
    },
    black: {
      color: "black",
      movesCounted: 1,
      movesExcludedForced: 0,
      accuracy: 84.7,
    },
    moves,
    graph: [],
  };
}

describe("buildGameSummarySlice", () => {
  it("builds a leak-free slice with at most five moments", () => {
    const moves = [
      fakeMove({ ply: 0, color: "white", epl: 0.1, classification: "mistake", san: "e4" }),
      fakeMove({ ply: 1, color: "black", epl: 0.2, classification: "blunder", san: "e5" }),
      fakeMove({ ply: 2, color: "white", epl: 0.3, classification: "blunder", san: "Qh5" }),
      fakeMove({ ply: 3, color: "black", epl: 0.25, classification: "miss", san: "Nc6" }),
      fakeMove({ ply: 4, color: "white", epl: 0.22, classification: "mistake", san: "Bc4" }),
      fakeMove({ ply: 5, color: "black", epl: 0.18, classification: "mistake", san: "d6" }),
      fakeMove({ ply: 6, color: "white", epl: 0.16, classification: "miss", san: "Nf3" }),
    ];
    const review = stubReview(moves);
    const game = stubGame();
    const slice = buildGameSummarySlice(review, game);

    expect(slice.gameId).toBe("game-1");
    expect(slice.algoVersion).toBe(ALGO_VERSION);
    expect(slice.result).toBe("1-0");
    expect(slice.whiteAccuracy).toBe(91.2);
    expect(slice.blackAccuracy).toBe(84.7);
    expect(slice.judgements.white.blunder).toBe(1);
    expect(slice.moments.length).toBeLessThanOrEqual(5);

    const payload = JSON.stringify(slice);
    for (const key of LEAK_KEYS) {
      expect(payload).not.toContain(`"${key}"`);
    }

    for (const moment of slice.moments) {
      expect(moment).toEqual({
        ply: expect.any(Number),
        san: expect.any(String),
        color: expect.stringMatching(/^(white|black)$/),
        classification: expect.any(String),
        winPercentSwing: expect.any(Number),
      });
      expect(moment).not.toHaveProperty("uci");
      expect(moment).not.toHaveProperty("fen");
      expect(moment).not.toHaveProperty("evalAfter");
    }
  });
});

describe("buildFallbackGameSummary", () => {
  it("produces three to five readable sentences without engine leaks", () => {
    const review = stubReview([
      fakeMove({ ply: 1, color: "black", epl: 0.4, classification: "blunder", san: "Qh4??" }),
    ]);
    const slice = buildGameSummarySlice(review, stubGame({ result: "0-1" }));
    const text = buildFallbackGameSummary(slice);

    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences.length).toBeLessThanOrEqual(5);
    expect(text).toContain("pretas venceram");
    expect(text).toContain("Precisão");
    expect(text).not.toMatch(UCI_PATTERN);
    expect(text).not.toMatch(FEN_PATTERN);
    expect(text).not.toMatch(EVAL_PATTERN);
  });

  it("still reads well with zero critical moments", () => {
    const review = stubReview([
      fakeMove({
        ply: 0,
        color: "white",
        epl: 0.01,
        classification: "best",
        playedIsBest: true,
      }),
      fakeMove({ ply: 1, color: "black", epl: 0.02, classification: "best", playedIsBest: true }),
    ]);
    const slice = buildGameSummarySlice(review, stubGame({ result: "1/2-1/2" }));
    const text = buildFallbackGameSummary(slice);

    expect(slice.moments).toHaveLength(0);
    expect(text).toContain("empate");
    expect(text).toContain("poucos erros graves");
    expect(text).not.toMatch(UCI_PATTERN);
    expect(text).not.toMatch(EVAL_PATTERN);
  });
});
