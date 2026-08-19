import { ALGO_VERSION } from "@game-review/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommentProxyError,
  isSummaryUsable,
  requestGameSummary,
  summaryEndpoint,
} from "../src/commentProxy.ts";
import { summaryCacheKey } from "../src/summaryCache.ts";
import { buildGameSummarySlice, buildFallbackGameSummary } from "@game-review/core";
import type { GameReview, NormalizedGame, ReviewedMove } from "@game-review/core";

const SAMPLE_SUMMARY_SLICE = {
  gameId: "game-1",
  algoVersion: ALGO_VERSION,
  result: "1-0" as const,
  whiteAccuracy: 90,
  blackAccuracy: 85,
  judgements: {
    white: {
      brilliant: 0,
      great: 0,
      best: 2,
      inaccuracy: 1,
      mistake: 0,
      miss: 0,
      blunder: 1,
    },
    black: {
      brilliant: 0,
      great: 0,
      best: 1,
      inaccuracy: 0,
      mistake: 1,
      miss: 0,
      blunder: 0,
    },
  },
  moments: [],
};

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

function stubGame(): NormalizedGame {
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
  };
}

describe("summaryEndpoint", () => {
  it("appends /summary to the proxy base URL", () => {
    expect(summaryEndpoint("https://proxy.example")).toBe(
      "https://proxy.example/summary",
    );
    expect(summaryEndpoint("https://proxy.example/summary")).toBe(
      "https://proxy.example/summary",
    );
  });
});

describe("summaryCacheKey", () => {
  it("uses only gameId and algoVersion", () => {
    expect(summaryCacheKey("abc", ALGO_VERSION)).toBe(`abc|${ALGO_VERSION}`);
  });
});

describe("requestGameSummary", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_COMMENT_PROXY_URL", "https://proxy.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POSTs to /summary and returns summary text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        summary:
          "As brancas venceram com mais precisão. Houve um blunder que mudou o rumo da partida no meio do jogo.",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const summary = await requestGameSummary(SAMPLE_SUMMARY_SLICE);
    expect(summary).toContain("brancas venceram");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://proxy.example/summary",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to template text on network error via caller", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network");
    }));

    const review = stubReview([fakeMove({ ply: 0, color: "white" })]);
    const slice = buildGameSummarySlice(review, stubGame());

    await expect(requestGameSummary(slice)).rejects.toThrow(CommentProxyError);
    expect(buildFallbackGameSummary(slice).length).toBeGreaterThan(20);
  });
});

describe("isSummaryUsable", () => {
  it("requires a longer minimum than per-move comments", () => {
    expect(isSummaryUsable("curto")).toBe(false);
    expect(
      isSummaryUsable(
        "As brancas venceram depois de um erro grave no meio do jogo.",
      ),
    ).toBe(true);
  });
});
