import {
  ALGO_VERSION,
  type CommentSlice,
  type GameSummarySlice,
  type JudgementCounts,
} from "@game-review/core";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index.ts";
import { buildSummaryPrompt } from "../src/buildSummaryPrompt.ts";
import { LEAKY_SLICE_KEYS } from "../src/parseCommentSlice.ts";
import { parseGameSummarySlice } from "../src/parseGameSummarySlice.ts";
import { requestOpenRouterSummary } from "../src/summaryOpenrouter.ts";

const EMPTY_JUDGEMENTS: JudgementCounts = {
  brilliant: 0,
  great: 0,
  best: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
};

const VALID_SLICE: GameSummarySlice = {
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

describe("parseGameSummarySlice", () => {
  it("accepts a valid GameSummarySlice", () => {
    const result = parseGameSummarySlice(VALID_SLICE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slice).toEqual(VALID_SLICE);
    }
  });

  for (const leaky of LEAKY_SLICE_KEYS) {
    it(`rejects leaky key ${leaky}`, () => {
      const result = parseGameSummarySlice({ ...VALID_SLICE, [leaky]: "leak" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(leaky);
      }
    });
  }

  it("rejects more than five moments", () => {
    const moments = Array.from({ length: 6 }, (_, index) => ({
      ply: index,
      san: "e4",
      color: "white" as const,
      classification: "mistake" as const,
      winPercentSwing: 1,
    }));
    const result = parseGameSummarySlice({ ...VALID_SLICE, moments });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid algoVersion", () => {
    const result = parseGameSummarySlice({ ...VALID_SLICE, algoVersion: "old" });
    expect(result.ok).toBe(false);
  });

  it("accepts slice without endReason and finalStanding (defaults)", () => {
    const { endReason: _e, finalStanding: _f, ...legacySlice } = VALID_SLICE;
    const result = parseGameSummarySlice(legacySlice);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slice.endReason).toBe("unknown");
      expect(result.slice.finalStanding).toBe("equal");
    }
  });

  it("rejects unknown termination key", () => {
    const result = parseGameSummarySlice({ ...VALID_SLICE, termination: "Time forfeit" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("termination");
    }
  });

  it("rejects a moment san longer than 12 chars", () => {
    const moments = [
      {
        ply: 10,
        san: "Qh4xQh4xQh4xQ",
        color: "white",
        classification: "blunder",
        winPercentSwing: 22.5,
      },
    ];
    const result = parseGameSummarySlice({ ...VALID_SLICE, moments });
    expect(result.ok).toBe(false);
  });

  it("rejects a moment winPercentSwing above 100", () => {
    const moments = [
      {
        ply: 10,
        san: "Qh4",
        color: "white",
        classification: "blunder",
        winPercentSwing: 101,
      },
    ];
    const result = parseGameSummarySlice({ ...VALID_SLICE, moments });
    expect(result.ok).toBe(false);
  });
});

describe("buildSummaryPrompt", () => {
  it("uses the kid-coach voice and forbids copying eval numbers in the reply", () => {
    const { system, user } = buildSummaryPrompt(VALID_SLICE);

    expect(system).toContain("10 anos");
    expect(system).toContain("3 a 5 frases");
    expect(system).toContain("Nunca copie");
    expect(system).not.toContain("copie na resposta +1.5");
    expect(user).toContain("Resultado:");
    expect(user).toContain("Qh4??");
    expect(user).toContain("só para você");
    expect(user).not.toMatch(/\be2e4\b/);
  });

  it("includes tempo language for timeout draw with white ahead", () => {
    const slice: GameSummarySlice = {
      ...VALID_SLICE,
      result: "1/2-1/2",
      endReason: "time",
      finalStanding: "white_winning",
    };
    const { system, user } = buildSummaryPrompt(slice);

    expect(user).toMatch(/tempo|relógio/i);
    expect(user).toContain("brancas claramente à frente");
    expect(user).toContain("só para você");
    expect(system).toContain("relógio decidiu");
    expect(system).toContain("Nunca copie");
  });
});

describe("requestOpenRouterSummary", () => {
  it("returns 503 when API key is missing", async () => {
    const result = await requestOpenRouterSummary(VALID_SLICE, {});
    expect(result).toEqual({
      ok: false,
      status: 503,
      message: "Serviço de comentários indisponível.",
    });
  });

  it("returns summary on success", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "As brancas venceram depois de um erro grave no meio do jogo. As pretas pressionaram bem, mas não seguraram a vantagem.",
            },
          },
        ],
      }),
    }));

    const result = await requestOpenRouterSummary(
      VALID_SLICE,
      { OPENROUTER_API_KEY: "test-key" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comment.length).toBeGreaterThan(24);
    }
  });

  it("returns 502 when model leaks eval numbers", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "As brancas venceram porque a posição virou +2.5 e o adversário não reagiu bem ao ataque.",
            },
          },
        ],
      }),
    }));

    const result = await requestOpenRouterSummary(
      VALID_SLICE,
      { OPENROUTER_API_KEY: "test-key" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({
      ok: false,
      status: 502,
      message: "Falha ao gerar resumo.",
    });
  });
});

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

describe("worker routing", () => {
  const AUTH_ENV = { PROXY_AUTH_TOKEN: "secret-token" };

  function authedRequest(
    path: string,
    body: unknown,
    options: { withToken?: boolean } = {},
  ): Request {
    const headers: Record<string, string> = {
      Origin: "chrome-extension://abc",
      "Content-Type": "application/json",
    };
    if (options.withToken !== false) {
      headers["X-Auth-Token"] = AUTH_ENV.PROXY_AUTH_TOKEN;
    }
    return new Request(`https://worker.test${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  it("routes /summary separately from /comment", async () => {
    const summaryResponse = await worker.fetch(
      authedRequest("/summary", VALID_SLICE),
      AUTH_ENV,
    );
    expect(summaryResponse.status).toBe(503);

    const commentResponse = await worker.fetch(
      authedRequest("/comment", VALID_COMMENT_SLICE),
      AUTH_ENV,
    );
    expect(commentResponse.status).toBe(503);
  });

  it("returns 503 when the auth token is not configured (fail-closed)", async () => {
    const response = await worker.fetch(
      authedRequest("/comment", VALID_COMMENT_SLICE, { withToken: false }),
      {},
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("auth não configurado.");
  });

  it("returns 401 when the auth token is wrong", async () => {
    const response = await worker.fetch(
      authedRequest("/comment", VALID_COMMENT_SLICE, { withToken: false }),
      AUTH_ENV,
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("Não autorizado.");
  });

  it("returns 401 without a token even for a valid body", async () => {
    const response = await worker.fetch(
      authedRequest("/comment", VALID_COMMENT_SLICE, { withToken: false }),
      AUTH_ENV,
    );
    expect(response.status).toBe(401);
  });

  it("rejects oversized bodies with 413 before parsing", async () => {
    const bigSlice = {
      ...VALID_COMMENT_SLICE,
      gameId: "x".repeat(17_000),
    };
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "X-Auth-Token": AUTH_ENV.PROXY_AUTH_TOKEN,
        "Content-Length": String(17_000 + 512),
      },
      body: JSON.stringify(bigSlice),
    });

    const response = await worker.fetch(request, AUTH_ENV);
    expect(response.status).toBe(413);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("Corpo grande demais.");
  });

  it("rejects oversized bodies with 413 when content-length is absent", async () => {
    const bigSlice = {
      ...VALID_COMMENT_SLICE,
      gameId: "x".repeat(17_000),
    };
    const request = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
        "X-Auth-Token": AUTH_ENV.PROXY_AUTH_TOKEN,
      },
      body: JSON.stringify(bigSlice),
    });

    const response = await worker.fetch(request, AUTH_ENV);
    expect(response.status).toBe(413);
  });

  it("returns 400 for per-field caps after auth", async () => {
    const request = authedRequest("/comment", {
      ...VALID_COMMENT_SLICE,
      engineLine: "Nf3 ".repeat(31).trim(),
    });
    const response = await worker.fetch(request, AUTH_ENV);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("Campo acima do limite: engineLine.");
  });

  it("lists X-Auth-Token in preflight Access-Control-Allow-Headers", async () => {
    const preflight = new Request("https://worker.test/comment", {
      method: "OPTIONS",
      headers: {
        Origin: "chrome-extension://abc",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, x-auth-token",
      },
    });

    const response = await worker.fetch(preflight, AUTH_ENV);
    expect(response.status).toBe(204);
    const allowHeaders = response.headers.get("Access-Control-Allow-Headers");
    expect(allowHeaders).toContain("X-Auth-Token");
  });
});
