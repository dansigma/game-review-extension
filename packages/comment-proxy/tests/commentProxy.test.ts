import { ALGO_VERSION, type CommentSlice } from "@game-review/core";
import { describe, expect, it, vi } from "vitest";
import { buildPrompt, buildPromptText } from "../src/buildPrompt.ts";
import { LEAKY_SLICE_KEYS, parseCommentSlice } from "../src/parseCommentSlice.ts";
import { requestOpenRouterComment } from "../src/openrouter.ts";

const VALID_SLICE: CommentSlice = {
  gameId: "game-1",
  algoVersion: ALGO_VERSION,
  ply: 4,
  san: "Bb5",
  color: "white",
  classification: "mistake",
  epl: 0.12,
  accuracy: 78.5,
  playerWinPercentBefore: 52.3,
  playerWinPercentAfter: 48.1,
  playedIsBest: false,
  onlyMove: false,
  evalAfter: "-0.3",
  evalBefore: "0.2",
  bestSan: "d4",
  engineLine: "d4 d5 c4",
};

describe("parseCommentSlice", () => {
  it("accepts the current CommentSlice shape", () => {
    const result = parseCommentSlice(VALID_SLICE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slice).toEqual(VALID_SLICE);
    }
  });

  it("accepts optional fields omitted", () => {
    const minimal = {
      gameId: "g",
      algoVersion: ALGO_VERSION,
      ply: 0,
      san: "e4",
      color: "white",
      classification: "best",
      epl: 0,
      accuracy: 99,
      playerWinPercentBefore: 50,
      playerWinPercentAfter: 49,
      playedIsBest: true,
      onlyMove: false,
      evalAfter: "0.0",
    };
    const result = parseCommentSlice(minimal);
    expect(result.ok).toBe(true);
  });

  for (const leaky of LEAKY_SLICE_KEYS) {
    it(`rejects leaky key ${leaky}`, () => {
      const body = { ...VALID_SLICE, [leaky]: "leak" };
      const result = parseCommentSlice(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(leaky);
      }
    });
  }

  it("rejects unknown extra keys", () => {
    const result = parseCommentSlice({ ...VALID_SLICE, whiteScoreAfter: { type: "cp" } });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid algoVersion", () => {
    const result = parseCommentSlice({ ...VALID_SLICE, algoVersion: "old" });
    expect(result.ok).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("includes SAN and eval but not UCI", () => {
    const { system, user } = buildPrompt(VALID_SLICE);
    expect(system).toContain("português");
    expect(user).toContain("Bb5");
    expect(user).toContain("d4");
    expect(user).toContain("0.2 → -0.3");
    expect(user).not.toMatch(/\be2e4\b/);
    expect(buildPromptText(VALID_SLICE)).not.toContain("uci");
  });
});

describe("requestOpenRouterComment", () => {
  it("returns 503 when API key is missing", async () => {
    const result = await requestOpenRouterComment(VALID_SLICE, {});
    expect(result).toEqual({
      ok: false,
      status: 503,
      message: "Serviço de comentários indisponível.",
    });
  });

  it("returns comment on success", async () => {
    const fetchImpl = vi.fn<
      (input: string, init?: RequestInit) => Promise<{
        ok: boolean;
        json: () => Promise<{
          choices: Array<{ message: { content: string } }>;
        }>;
      }>
    >(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Bom lance, mas impreciso." } }],
      }),
    }));

    const result = await requestOpenRouterComment(
      VALID_SLICE,
      { OPENROUTER_API_KEY: "test-key", OPENROUTER_MODEL: "openai/gpt-4o-mini" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({ ok: true, comment: "Bom lance, mas impreciso." });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("openrouter.ai");
    const payload = JSON.parse(String(init?.body));
    expect(payload.messages[1].content).toContain("Bb5");
    expect(JSON.stringify(payload)).not.toContain("uci");
  });

  it("returns 502 on upstream failure", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }));
    const result = await requestOpenRouterComment(
      VALID_SLICE,
      { OPENROUTER_API_KEY: "test-key" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
    }
  });
});
