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
    whiteScoreAfter: overrides.whiteScoreAfter ?? { type: "cp", value: 0 },
    whiteScoreBefore: overrides.whiteScoreBefore ?? { type: "cp", value: 0 },
    bestUci: overrides.bestUci ?? "e2e4",
    playedIsBest: overrides.playedIsBest ?? true,
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
        classification: "best",
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
      classification: "best",
      epl: 0.03,
      accuracy: 92,
      playerWinPercentBefore: 50,
      playerWinPercentAfter: 49,
      playedIsBest: false,
      bestSan: undefined,
      onlyMove: false,
      evalAfter: "0.0",
    });
  });

  it("includes bestSan when present on the reviewed move", () => {
    const review = stubReview([
      fakeMove({
        ply: 4,
        color: "white",
        san: "Bb5",
        classification: "mistake",
        bestSan: "d4",
        playedIsBest: false,
      }),
    ]);

    expect(buildCommentSlice(review, 4)?.bestSan).toBe("d4");
  });

  it("includes engineLine from bestLineSan when present", () => {
    const review = stubReview([
      fakeMove({
        ply: 0,
        color: "white",
        san: "d4",
        classification: "mistake",
        bestSan: "e4",
        bestLineSan: "e4 e5 Nf3 Nc6 Bb5",
        playedIsBest: false,
      }),
    ]);

    expect(buildCommentSlice(review, 0)?.engineLine).toBe(
      "e4 e5 Nf3 Nc6 Bb5",
    );
  });

  it("omits engineLine when bestLineSan is absent", () => {
    const review = stubReview([fakeMove({ ply: 0, color: "white" })]);
    const slice = buildCommentSlice(review, 0);
    expect(slice).not.toHaveProperty("engineLine");
  });

  it("includes replyLine from replyLineSan, capped at 3 SAN plies", () => {
    const review = stubReview([
      fakeMove({
        ply: 18,
        color: "black",
        san: "Qc7",
        classification: "blunder",
        replyLineSan: "Qxc7+ Kd8 Qxd8+",
        playedIsBest: false,
      }),
    ]);

    expect(buildCommentSlice(review, 18)?.replyLine).toBe("Qxc7+ Kd8 Qxd8+");
  });

  it("falls back to the next ply bestLineSan when replyLineSan is missing", () => {
    const review = stubReview([
      fakeMove({
        ply: 18,
        color: "black",
        san: "Qc7",
        classification: "blunder",
        bestSan: "Rd8",
        playedIsBest: false,
      }),
      fakeMove({
        ply: 19,
        color: "white",
        san: "Qe2",
        bestSan: "Qxc7+",
        bestLineSan: "Qxc7+ Kd8 Nf3",
      }),
    ]);

    expect(buildCommentSlice(review, 18)?.replyLine).toBe("Qxc7+ Kd8 Nf3");
  });

  it("includes fenAfter when present and never a `fen` key", () => {
    const review = stubReview([
      fakeMove({
        ply: 18,
        color: "black",
        san: "Qc7",
        fenAfter: "8/2q5/8/8/8/2Q5/8/8 w - - 0 1",
      }),
    ]);
    const slice = buildCommentSlice(review, 18);
    expect(slice?.fenAfter).toBe("8/2q5/8/8/8/2Q5/8/8 w - - 0 1");
    expect(slice).not.toHaveProperty("fen");
  });

  it("omits replyLine when there is no replyLineSan and no next ply", () => {
    const review = stubReview([fakeMove({ ply: 0, color: "white" })]);
    expect(buildCommentSlice(review, 0)).not.toHaveProperty("replyLine");
  });

  it("caps replyLine at 3 SAN plies", () => {
    const review = stubReview([
      fakeMove({
        ply: 0,
        color: "white",
        replyLineSan: "Qxc7+ Kd8 Qxd8+ Kxd8 Nf3",
      }),
    ]);

    expect(buildCommentSlice(review, 0)?.replyLine).toBe("Qxc7+ Kd8 Qxd8+");
  });

  it("engineLine is SAN-shaped, not UCI", () => {
    const review = stubReview([
      fakeMove({
        ply: 0,
        color: "white",
        bestLineSan: "Ne7 Nf5 Bd3",
      }),
    ]);

    const slice = buildCommentSlice(review, 0);
    expect(slice?.engineLine).toBe("Ne7 Nf5 Bd3");
    expect(slice?.engineLine).not.toMatch(/^[a-h][1-8][a-h][1-8]/);
    expect(slice?.engineLine).not.toMatch(/\be2e4\b/);
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

  it("includes forced moves with accuracy and onlyMove false", () => {
    const review = stubReview([
      fakeMove({
        ply: 2,
        color: "white",
        san: "Kf1",
        accuracy: 85,
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
      accuracy: 85,
      playerWinPercentBefore: 5,
      playerWinPercentAfter: 4,
      playedIsBest: true,
      onlyMove: false,
      evalAfter: "0.0",
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
