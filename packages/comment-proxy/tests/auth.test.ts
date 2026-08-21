import { ALGO_VERSION, type CommentSlice, type GameSummarySlice, type JudgementCounts } from "@game-review/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.ts";

const AUTH_TOKEN = "secret-token-123";

const VALID_COMMENT_SLICE: CommentSlice = {
  gameId: "game-1",
  algoVersion: ALGO_VERSION,
  ply: 4,
  san: "Bb5",
  color: "white",
  classification: "mistake",
  commentIntent: "what_was_missed",
  winPercentDelta: -4.2,
  suggestedLength: "standard",
  epl: 0.12,
  accuracy: 78.5,
  playerWinPercentBefore: 52.3,
  playerWinPercentAfter: 48.1,
  playedIsBest: false,
  onlyMove: false,
  evalAfter: "-0.3",
};

const EMPTY_JUDGEMENTS: JudgementCounts = {
  brilliant: 0,
  great: 0,
  best: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
};

const VALID_SUMMARY_SLICE: GameSummarySlice = {
  gameId: "game-1",
  algoVersion: ALGO_VERSION,
  result: "1-0",
  endReason: "mate",
  finalStanding: "white_winning",
  whiteAccuracy: 91.2,
  blackAccuracy: 84.5,
  judgements: {
    white: { ...EMPTY_JUDGEMENTS, best: 3, blunder: 1 },
    black: { ...EMPTY_JUDGEMENTS, mistake: 2 },
  },
  moments: [
    {
      ply: 10,
      san: "Qh4??",
      color: "white",
      classification: "blunder",
      winPercentSwing: 22.5,
    },
  ],
};

function mockRateLimiter(success = true) {
  return {
    limit: vi.fn(async () => ({ success })),
  };
}

describe("auth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST without X-Auth-Token → 401 on /comment", async () => {
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: mockRateLimiter(true),
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Não autorizado.");
  });

  it("POST without X-Auth-Token → 401 on /summary", async () => {
    const request = new Request("https://worker.test/summary", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
      },
      body: JSON.stringify(VALID_SUMMARY_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: mockRateLimiter(true),
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Não autorizado.");
  });

  it("POST with wrong token → 401", async () => {
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
        "X-Auth-Token": "wrong-token",
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: mockRateLimiter(true),
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Não autorizado.");
  });

  it("POST with correct token + valid payload → 200 (mock OpenRouter)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Bom lance, bem calculado no centro do tabuleiro." } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
        "X-Auth-Token": AUTH_TOKEN,
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: mockRateLimiter(true),
      OPENROUTER_API_KEY: "test-key",
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { comment: string };
    expect(data.comment.length).toBeGreaterThan(8);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("env.AUTH_TOKEN undefined + valid token in request → still 401 (fail-closed)", async () => {
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
        "X-Auth-Token": AUTH_TOKEN,
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      RATE_LIMITER: mockRateLimiter(true),
      OPENROUTER_API_KEY: "test-key",
    };
    const response = await worker.fetch(request, env as never);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Não autorizado.");
  });

  it("POST with correct token on /summary + valid payload → 200", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "As brancas venceram depois de um erro grave no meio do jogo. As pretas pressionaram bem, mas não seguraram a vantagem.",
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.test/summary", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
        "X-Auth-Token": AUTH_TOKEN,
      },
      body: JSON.stringify(VALID_SUMMARY_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: mockRateLimiter(true),
      OPENROUTER_API_KEY: "test-key",
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { summary: string };
    expect(data.summary.length).toBeGreaterThan(24);
  });
});
