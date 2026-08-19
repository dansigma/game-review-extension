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
  it("routes /summary separately from /comment", async () => {
    const summaryRequest = new Request("https://worker.test/summary", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(VALID_SLICE),
    });

    const summaryResponse = await worker.fetch(summaryRequest, {});
    expect(summaryResponse.status).toBe(503);

    const commentRequest = new Request("https://worker.test/comment", {
      method: "POST",
      headers: {
        Origin: "chrome-extension://abc",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(VALID_COMMENT_SLICE),
    });

    const commentResponse = await worker.fetch(commentRequest, {});
    expect(commentResponse.status).toBe(503);
  });
});
