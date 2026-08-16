import { describe, expect, it } from "vitest";
import { buildCommentSlice } from "../src/commentSlice.ts";
import { ONLY_MOVE_WIN_PERCENT_GAP } from "../src/onlyMove.ts";
import { ALGO_VERSION, type GameReview, type ReviewedMove } from "../src/types.ts";

function fakeMove(
  overrides: Partial<ReviewedMove> & Pick<ReviewedMove, "ply" | "color">,
): ReviewedMove {
  return {
    san: overrides.san ?? "e4",
    uci: overrides.uci ?? "e2e4",
    classification: overrides.classification ?? "best",
    classificationLabel: overrides.classificationLabel ?? "Best",
    epl: overrides.epl ?? 0,
    accuracy: overrides.accuracy ?? 99,
    playerWinPercentBefore: overrides.playerWinPercentBefore ?? 55,
    playerWinPercentAfter: overrides.playerWinPercentAfter ?? 54,
    whiteWinPercentAfter: overrides.whiteWinPercentAfter ?? 55,
    bestUci: overrides.bestUci ?? "e2e4",
    playedIsBest: overrides.playedIsBest ?? true,
    ...overrides,
  };
}

function stubReview(moves: ReviewedMove[]): GameReview {
  return {
    gameId: "game-1",
    algoVersion: ALGO_VERSION,
    engineId: "sf_18_smallnet",
    white: {
      color: "white",
      movesCounted: 1,
      movesExcludedForced: 0,
      accuracy: 90,
    },
    black: {
      color: "black",
      movesCounted: 1,
      movesExcludedForced: 0,
      accuracy: 88,
    },
    moves,
    graph: [],
  };
}

const ENGINE_LEAK_KEYS = [
  "uci",
  "bestUci",
  "alternativeUci",
  "fen",
  "lines",
  "score",
  "pv",
] as const;

describe("buildCommentSlice", () => {
  it("returns the listed fields for a valid ply", () => {
    const review = stubReview([
      fakeMove({
        ply: 0,
        color: "white",
        san: "e4",
        classification: "good",
        epl: 0.03,
        accuracy: 92,
        playerWinPercentBefore: 50,
        playerWinPercentAfter: 49,
        playedIsBest: false,
        alternativePlayerWinPercent: 48,
        alternativeUci: "d2d4",
      }),
    ]);

    const slice = buildCommentSlice(review, 0);

    expect(slice).toEqual({
      gameId: "game-1",
      algoVersion: ALGO_VERSION,
      ply: 0,
      san: "e4",
      color: "white",
      classification: "good",
      epl: 0.03,
      accuracy: 92,
      playerWinPercentBefore: 50,
      playerWinPercentAfter: 49,
      playedIsBest: false,
      onlyMove: false,
    });
  });

  it("does not leak engine or UCI fields", () => {
    const review = stubReview([
      fakeMove({
        ply: 1,
        color: "black",
        san: "e5",
        uci: "e7e5",
        bestUci: "c5",
        alternativeUci: "c7c5",
        playerWinPercentBefore: 60,
        alternativePlayerWinPercent: 40,
      }),
    ]);

    const slice = buildCommentSlice(review, 1);
    expect(slice).not.toBeNull();

    const keys = Object.keys(slice ?? {});
    for (const banned of ENGINE_LEAK_KEYS) {
      expect(keys, `must not include ${banned}`).not.toContain(banned);
    }
    expect(slice).not.toHaveProperty("whiteWinPercentAfter");
    expect(slice).not.toHaveProperty("alternativePlayerWinPercent");
  });

  it("returns null for ply -1", () => {
    const review = stubReview([fakeMove({ ply: 0, color: "white" })]);
    expect(buildCommentSlice(review, -1)).toBeNull();
  });

  it("returns null for an unknown ply", () => {
    const review = stubReview([fakeMove({ ply: 0, color: "white" })]);
    expect(buildCommentSlice(review, 99)).toBeNull();
  });

  it("includes forced moves with accuracy null and onlyMove false", () => {
    const review = stubReview([
      fakeMove({
        ply: 2,
        color: "white",
        san: "Kf1",
        accuracy: null,
        classification: "forced",
        classificationLabel: "Forced",
        playerWinPercentBefore: 5,
        playerWinPercentAfter: 4,
        alternativePlayerWinPercent: 0,
        alternativeUci: "h1g1",
      }),
    ]);

    const slice = buildCommentSlice(review, 2);

    expect(slice).toEqual({
      gameId: "game-1",
      algoVersion: ALGO_VERSION,
      ply: 2,
      san: "Kf1",
      color: "white",
      classification: "forced",
      epl: 0,
      accuracy: null,
      playerWinPercentBefore: 5,
      playerWinPercentAfter: 4,
      playedIsBest: true,
      onlyMove: false,
    });
  });

  it("sets onlyMove when the gap is large enough", () => {
    const review = stubReview([
      fakeMove({
        ply: 3,
        color: "black",
        san: "Nf6",
        playerWinPercentBefore: 58,
        alternativePlayerWinPercent: 58 - ONLY_MOVE_WIN_PERCENT_GAP,
        alternativeUci: "d7d6",
      }),
    ]);

    expect(buildCommentSlice(review, 3)?.onlyMove).toBe(true);
  });
});
