import { ALGO_VERSION, type CommentSlice } from "@game-review/core";
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

describe("rateLimit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("RATE_LIMITER.limit returns { success: false } → 429, OpenRouter NOT called", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Bom lance, bem calculado." } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const rateLimiter = {
      limit: vi.fn(async () => ({ success: false })),
    };

    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "9.9.9.9",
        "X-Auth-Token": AUTH_TOKEN,
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: rateLimiter,
      OPENROUTER_API_KEY: "test-key",
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(429);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Muitas requisições. Tente novamente mais tarde.");
    expect(rateLimiter.limit).toHaveBeenCalledWith({ key: "9.9.9.9" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("RATE_LIMITER.limit returns { success: true } → flow continues to auth", async () => {
    const rateLimiter = {
      limit: vi.fn(async () => ({ success: true })),
    };
    // Wrong token should then give 401, proving rate limit passed
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
        "X-Auth-Token": "wrong",
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: rateLimiter,
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
    expect(rateLimiter.limit).toHaveBeenCalledOnce();
  });

  it("RATE_LIMITER.limit success true + correct auth → reaches handler (200 with mock)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Bom lance, bem calculado no centro." } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const rateLimiter = {
      limit: vi.fn(async () => ({ success: true })),
    };
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "5.6.7.8",
        "X-Auth-Token": AUTH_TOKEN,
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: rateLimiter,
      OPENROUTER_API_KEY: "test-key",
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(rateLimiter.limit).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("env.RATE_LIMITER undefined → 500", async () => {
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
    };
    const response = await worker.fetch(request, env as never);
    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("Rate limiter não configurado.");
  });

  it("uses CF-Connecting-IP fallback when header missing", async () => {
    const rateLimiter = {
      limit: vi.fn(async () => ({ success: false })),
    };
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "X-Auth-Token": AUTH_TOKEN,
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });
    const env = {
      AUTH_TOKEN: AUTH_TOKEN,
      RATE_LIMITER: rateLimiter,
    };
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(429);
    expect(rateLimiter.limit).toHaveBeenCalledWith({ key: "unknown" });
  });
});
