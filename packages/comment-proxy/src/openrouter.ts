import { buildPrompt } from "./buildPrompt.ts";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.6-luna";

export interface OpenRouterEnv {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
}

export interface OpenRouterSuccess {
  ok: true;
  comment: string;
}

export interface OpenRouterFailure {
  ok: false;
  status: number;
  message: string;
}

const MIN_COMMENT_LENGTH = 12;

/** UCI coordinate move (e2e4, g7g8q) — must not appear in coach comments. */
const UCI_MOVE_PATTERN = /\b[a-h][1-8][a-h][1-8][qrbn]?\b/i;

/** Full FEN position string — must not appear in coach comments. */
const FEN_PATTERN =
  /\b(?:[rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+\s+[wb]\s+[-KQkq]+\s+[-a-hA-H0-9]+\s+\d+\s+\d+\b/;

function normalizeSan(san: string): string {
  return san.trim().replace(/[+#!?]+$/, "");
}

function isTruncatedComment(content: string, san: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH) {
    return true;
  }
  return normalizeSan(trimmed) === normalizeSan(san);
}

function leaksEngineNotation(content: string): boolean {
  return UCI_MOVE_PATTERN.test(content) || FEN_PATTERN.test(content);
}

export async function requestOpenRouterComment(
  slice: Parameters<typeof buildPrompt>[0],
  env: OpenRouterEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterSuccess | OpenRouterFailure> {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      message: "Serviço de comentários indisponível.",
    };
  }

  const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const { system, user } = buildPrompt(slice);

  try {
    const response = await fetchImpl(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 2048,
        reasoning: {
          effort: "low",
          exclude: true,
        },
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        message: "Falha ao gerar comentário.",
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        ok: false,
        status: 502,
        message: "Resposta vazia do modelo.",
      };
    }

    if (isTruncatedComment(content, slice.san)) {
      return {
        ok: false,
        status: 502,
        message: "Falha ao gerar comentário.",
      };
    }

    if (leaksEngineNotation(content)) {
      return {
        ok: false,
        status: 502,
        message: "Falha ao gerar comentário.",
      };
    }

    return { ok: true, comment: content };
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Falha ao gerar comentário.",
    };
  }
}
