import { ALGO_VERSION, type CommentSlice } from "@game-review/core";
import { describe, expect, it, vi } from "vitest";
import {
  buildPrompt,
  buildPromptText,
  isFailureClassification,
  isFailureIntent,
  isPositiveClassification,
} from "../src/buildPrompt.ts";
import { LEAKY_SLICE_KEYS, parseCommentSlice } from "../src/parseCommentSlice.ts";
import { requestOpenRouterComment } from "../src/openrouter.ts";

const VALID_SLICE: CommentSlice = {
  gameId: "game-1",
  algoVersion: ALGO_VERSION,
  ply: 4,
  san: "Bb5",
  color: "white",
  classification: "mistake",
  commentIntent: "what_was_missed",
  winPercentDelta: 48.1 - 52.3,
  suggestedLength: "standard",
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
  replyLine: "Qxd4 Nf3",
  fenAfter: "8/2q5/8/8/8/2Q5/8/8 w - - 0 1",
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

  it("rejects invalid commentIntent", () => {
    const result = parseCommentSlice({ ...VALID_SLICE, commentIntent: "praise_blunder" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid suggestedLength", () => {
    const result = parseCommentSlice({ ...VALID_SLICE, suggestedLength: "long" });
    expect(result.ok).toBe(false);
  });

  it("rejects non-finite winPercentDelta", () => {
    const result = parseCommentSlice({ ...VALID_SLICE, winPercentDelta: Number.NaN });
    expect(result.ok).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("includes the fact card and a shorter system prompt", () => {
    const { system, user } = buildPrompt(VALID_SLICE);
    expect(system).toContain("10 anos");
    expect(system).toContain("cartão de fatos");
    expect(system).toContain("Não use diminutivos");
    expect(system).not.toContain("nunca diga torre");
    expect(system).not.toContain("não invente Bxc7");
    expect(user).toContain("Cartão de fatos");
    expect(user).toContain("Gravidade:");
    expect(user).toContain("Bb5");
    expect(user).toContain("Qxd4");
    expect(user).toContain("MOTIVO");
    expect(user).toContain("Tarefa:");
    expect(user).toContain("Comprimento:");
    expect(user).toContain("FEN de backup");
    expect(user).toContain("8/2q5/8/8/8/2Q5/8/8");
    expect(user).not.toMatch(/\be2e4\b/);
    expect(buildPromptText(VALID_SLICE)).not.toContain("uci");
  });

  it("puts bishop on c8 in the fact card for Nxc8, not a rook", () => {
    const slice: CommentSlice = {
      ...VALID_SLICE,
      fenAfter: "2b1k3/8/3N4/8/8/8/8/4K3 w - - 0 1",
      replyLine: "Nxc8",
    };
    const { system, user } = buildPrompt(slice);

    expect(user).toContain("Tabuleiro em português:");
    expect(user).toContain("c8 bispo preto");
    expect(user).toContain("Filme do MOTIVO:");
    expect(user).toContain("Nxc8 toma bispo");
    expect(user).toContain("Material em palavras:");
    expect(user).toMatch(/\+peça|dama de graça/);
    expect(user).not.toContain("torre");
    expect(system).toContain("Não adivinhe qual peça");
    expect(system).not.toContain("SAN de captura não diz");
  });

  it("marks recapture trades in the fact card", () => {
    const slice: CommentSlice = {
      ...VALID_SLICE,
      fenAfter: "2bqk3/8/3N4/8/8/8/8/4K3 w - - 0 1",
      replyLine: "Nxc8",
    };
    const { system, user } = buildPrompt(slice);

    expect(user).toContain("Material em palavras: igual");
    expect(user).toMatch(/recaptura|material igual/);
    expect(system).toContain("Não diga ganho de material se o cartão disser igual");
  });

  const HONESTY_RULE =
    "Nunca descreva o lance jogado como boa ideia, sacrifício interessante ou plano positivo";

  it("blunder_explanation intent uses honesty block and Primeiro o ERRO", () => {
    const slice: CommentSlice = {
      ...VALID_SLICE,
      classification: "blunder",
      commentIntent: "blunder_explanation",
      suggestedLength: "standard",
    };
    const { system, user } = buildPrompt(slice);

    expect(isFailureIntent(slice.commentIntent)).toBe(true);
    expect(system).toContain("Primeiro o ERRO");
    expect(system).toContain(HONESTY_RULE);
    expect(user).toContain("MOTIVO");
    expect(user).toContain("Cartão de fatos");
    expect(user).toContain("por que o lance jogado é ruim");
    expect(user).toContain("por que o melhor lance é melhor");
  });

  it("what_was_missed intent uses missed-opportunity task without Primeiro o ERRO", () => {
    const slice: CommentSlice = {
      ...VALID_SLICE,
      classification: "mistake",
      commentIntent: "what_was_missed",
      suggestedLength: "standard",
    };
    const { system, user } = buildPrompt(slice);

    expect(isFailureIntent(slice.commentIntent)).toBe(true);
    expect(system).not.toContain("Primeiro o ERRO");
    expect(system).toContain(HONESTY_RULE);
    expect(system).toContain("o que foi perdido");
    expect(user).toContain("o que foi perdido ou deixado de fazer");
    expect(user).toContain("por que o melhor lance é melhor");
  });

  it.each(["best", "great", "brilliant"] as const)(
    "why_this_move intent for classification %s omits failure honesty block",
    (classification) => {
      const slice: CommentSlice = {
        ...VALID_SLICE,
        classification,
        commentIntent: "why_this_move",
        suggestedLength: "brief",
        playedIsBest: true,
      };
      const { system, user } = buildPrompt(slice);

      expect(isPositiveClassification(classification)).toBe(true);
      expect(system).not.toContain("Primeiro o ERRO");
      expect(system).not.toContain(HONESTY_RULE);
      expect(system).toContain("por que o lance jogado é forte");
      expect(user).not.toContain("por que o lance jogado é ruim");
      expect(user).toContain("Cartão de fatos");
      expect(user).toContain("Comprimento: breve");
    },
  );

  it.each(["opening", "forced"] as const)(
    "neutral intent for classification %s uses shared base without failure or praise blocks",
    (classification) => {
      const slice: CommentSlice = {
        ...VALID_SLICE,
        classification,
        commentIntent: "neutral",
        suggestedLength: "brief",
      };
      const { system, user } = buildPrompt(slice);

      expect(system).not.toContain("Primeiro o ERRO");
      expect(system).not.toContain(HONESTY_RULE);
      expect(system).not.toContain("por que o lance jogado é forte");
      expect(user).not.toContain("por que o lance jogado é ruim");
      expect(user).toContain("Cartão de fatos");
      expect(user).toContain("comentar o lance de forma neutra");
    },
  );

  it("inaccuracy uses what_was_missed intent even though classification is not failure", () => {
    const slice: CommentSlice = {
      ...VALID_SLICE,
      classification: "inaccuracy",
      commentIntent: "what_was_missed",
      suggestedLength: "standard",
    };
    const { system } = buildPrompt(slice);

    expect(isFailureClassification("inaccuracy")).toBe(false);
    expect(system).toContain(HONESTY_RULE);
    expect(system).not.toContain("Primeiro o ERRO");
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
      { OPENROUTER_API_KEY: "test-key", OPENROUTER_MODEL: "openai/gpt-5.6-luna" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({ ok: true, comment: "Bom lance, mas impreciso." });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("openrouter.ai");
    const payload = JSON.parse(String(init?.body));
    expect(payload.max_tokens).toBe(2048);
    expect(payload.reasoning).toEqual({ effort: "low", exclude: true });
    expect(payload.messages[1].content).toContain("Cartão de fatos");
    expect(JSON.stringify(payload)).not.toContain("uci");
  });

  it("returns 502 when model leaks UCI notation", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "O cavalo deveria ir para e2e4 em vez de perder o peão no centro.",
            },
          },
        ],
      }),
    }));

    const result = await requestOpenRouterComment(
      VALID_SLICE,
      { OPENROUTER_API_KEY: "test-key" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({
      ok: false,
      status: 502,
      message: "Falha ao gerar comentário.",
    });
  });

  it("returns 502 when model leaks a FEN string", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "Depois do lance o tabuleiro fica 8/8/8/8/8/8/8/8 w - - 0 1 e as brancas perdem o centro.",
            },
          },
        ],
      }),
    }));

    const result = await requestOpenRouterComment(
      VALID_SLICE,
      { OPENROUTER_API_KEY: "test-key" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({
      ok: false,
      status: 502,
      message: "Falha ao gerar comentário.",
    });
  });

  it("returns 502 when model returns only the played SAN", async () => {
    const slice: CommentSlice = { ...VALID_SLICE, san: "Qc7" };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Qc7" } }],
      }),
    }));

    const result = await requestOpenRouterComment(
      slice,
      { OPENROUTER_API_KEY: "test-key" },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({
      ok: false,
      status: 502,
      message: "Falha ao gerar comentário.",
    });
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
