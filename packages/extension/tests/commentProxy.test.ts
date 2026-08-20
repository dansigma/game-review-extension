import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCommentSlice } from "@game-review/core";
import { ALGO_VERSION, type CommentSlice, type GameReview, type ReviewedMove } from "@game-review/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommentProxyError,
  COMMENT_PROXY_TIMEOUT_MS,
  getCommentProxyBaseUrl,
  getCommentProxyToken,
  isCommentProxyConfigured,
  isCommentUsable,
  proxyUrlFromEnv,
  requestComment,
  requestGameSummary,
} from "../src/commentProxy.ts";

const SOURCE_PATH = resolve(import.meta.dirname, "../src/commentProxy.ts");

const TEST_TOKEN = "test-shared-token";

/** Stubs chrome.storage.local with the given proxy token. */
function stubStorageToken(token: string): void {
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async () => ({ commentProxyToken: token })),
      },
    },
  });
}

const LEAK_KEYS = [
  "uci",
  "bestUci",
  "alternativeUci",
  "fen",
  "pv",
  "score",
] as const;

const SAMPLE_SLICE: CommentSlice = {
  gameId: "game-1",
  algoVersion: ALGO_VERSION,
  ply: 0,
  san: "e4",
  color: "white",
  classification: "best",
  commentIntent: "why_this_move",
  winPercentDelta: -1,
  suggestedLength: "brief",
  epl: 0,
  accuracy: 99,
  playerWinPercentBefore: 50,
  playerWinPercentAfter: 49,
  playedIsBest: true,
  onlyMove: false,
  evalAfter: "0.0",
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

describe("commentProxy source hygiene", () => {
  it("does not mention openrouter in module source", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    expect(source.toLowerCase()).not.toContain("openrouter");
  });
});

describe("commentProxy configuration", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_COMMENT_PROXY_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports unconfigured when env is empty", () => {
    expect(proxyUrlFromEnv()).toBe("");
    expect(isCommentProxyConfigured()).toBe(false);
    expect(getCommentProxyBaseUrl()).toBeNull();
  });

  it("normalizes trailing slash from base URL", () => {
    vi.stubEnv("VITE_COMMENT_PROXY_URL", "https://proxy.example/");
    expect(getCommentProxyBaseUrl()).toBe("https://proxy.example");
  });
});

describe("getCommentProxyToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the stored token", async () => {
    stubStorageToken(TEST_TOKEN);
    await expect(getCommentProxyToken()).resolves.toBe(TEST_TOKEN);
  });

  it("returns empty string when storage has no token", async () => {
    stubStorageToken("");
    await expect(getCommentProxyToken()).resolves.toBe("");
  });
});

describe("requestComment", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_COMMENT_PROXY_URL", "https://proxy.example");
    stubStorageToken(TEST_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("throws when proxy URL is unset", async () => {
    vi.stubEnv("VITE_COMMENT_PROXY_URL", "");
    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow(CommentProxyError);
    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow("Proxy não configurado");
  });

  it("skips network and throws when token is absent", async () => {
    stubStorageToken("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow(
      "Comentários IA não configurados (token ausente).",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs slice JSON with X-Auth-Token header and returns comment", async () => {
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<{ comment: string }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ comment: "Lance sólido." }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const comment = await requestComment(SAMPLE_SLICE);
    expect(comment).toBe("Lance sólido.");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://proxy.example/comment");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["X-Auth-Token"]).toBe(TEST_TOKEN);
    const body = JSON.parse(String(init?.body));
    expect(body.san).toBe("e4");
    expect(body).not.toHaveProperty("uci");
  });

  it("does not POST engine leak fields from buildCommentSlice", () => {
    const review = stubReview([
      fakeMove({
        ply: 1,
        color: "black",
        san: "e5",
        uci: "e7e5",
        bestUci: "c5",
        alternativeUci: "c7c5",
      }),
    ]);
    const slice = buildCommentSlice(review, 1);
    expect(slice).not.toBeNull();

    const payload = JSON.stringify(slice);
    for (const key of LEAK_KEYS) {
      expect(payload).not.toContain(`"${key}"`);
    }
  });

  it("maps HTTP errors to Portuguese messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Campo proibido: uci." }),
      })),
    );

    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow("Campo proibido: uci.");
  });

  it("throws on whitespace-only comment body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ comment: "   " }),
      })),
    );

    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow("Resposta vazia do proxy.");
  });

  it("throws on truncated unusable comment body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ comment: "ok" }),
      })),
    );

    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow("Resposta vazia do proxy.");
  });

  it("passes AbortSignal with configured timeout", async () => {
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<{ comment: string }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ comment: "Comentário completo do lance." }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await requestComment(SAMPLE_SLICE);

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(COMMENT_PROXY_TIMEOUT_MS).toBe(20_000);
  });
});

describe("requestGameSummary", () => {
  const SAMPLE_SUMMARY = {
    gameId: "game-1",
    algoVersion: "1",
    result: "1-0",
    whiteAccuracy: 91.2,
    blackAccuracy: 84.5,
    judgements: { white: {}, black: {} },
    moments: [],
  };

  beforeEach(() => {
    vi.stubEnv("VITE_COMMENT_PROXY_URL", "https://proxy.example");
    stubStorageToken(TEST_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips network and throws when token is absent", async () => {
    stubStorageToken("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestGameSummary(SAMPLE_SUMMARY as never),
    ).rejects.toThrow("Comentários IA não configurados (token ausente).");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to /summary with X-Auth-Token header and returns summary", async () => {
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<{ summary: string }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ summary: "As brancas venceram no final." }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const summary = await requestGameSummary(SAMPLE_SUMMARY as never);
    expect(summary).toBe("As brancas venceram no final.");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://proxy.example/summary");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["X-Auth-Token"]).toBe(TEST_TOKEN);
  });
});

describe("isCommentUsable", () => {
  it("rejects empty and very short strings", () => {
    expect(isCommentUsable("")).toBe(false);
    expect(isCommentUsable("   ")).toBe(false);
    expect(isCommentUsable("curto")).toBe(false);
  });

  it("accepts a normal comment length", () => {
    expect(isCommentUsable("Lance sólido no centro.")).toBe(true);
  });
});
