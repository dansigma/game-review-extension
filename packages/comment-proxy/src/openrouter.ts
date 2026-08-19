import { buildPrompt } from "./buildPrompt.ts";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.6-luna";

export interface OpenRouterEnv {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
}

export interface OpenRouterPrompt {
  system: string;
  user: string;
}

export interface OpenRouterTextOptions {
  minLength?: number;
  truncateAgainst?: string;
  failureMessage?: string;
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

const DEFAULT_MIN_COMMENT_LENGTH = 12;
const DEFAULT_FAILURE_MESSAGE = "Falha ao gerar comentário.";

/** UCI coordinate move (e2e4, g7g8q) — must not appear in coach comments. */
const UCI_MOVE_PATTERN = /\b[a-h][1-8][a-h][1-8][qrbn]?\b/i;

/** Full FEN position string — must not appear in coach comments. */
const FEN_PATTERN =
  /\b(?:[rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+\s+[wb]\s+[-KQkq]+\s+[-a-hA-H0-9]+\s+\d+\s+\d+\b/;

/** Centipawn or mate eval tokens — must not appear in kid-facing text. */
const EVAL_NUMBER_PATTERN = /[+-]\d+(\.\d+)?|#\d+/;

function normalizeSan(san: string): string {
  return san.trim().replace(/[+#!?]+$/, "");
}

function isTruncatedText(content: string, reference: string): boolean {
  return normalizeSan(content) === normalizeSan(reference);
}

function leaksEngineNotation(content: string): boolean {
  return (
    UCI_MOVE_PATTERN.test(content) ||
    FEN_PATTERN.test(content) ||
    EVAL_NUMBER_PATTERN.test(content)
  );
}

export async function requestOpenRouterText(
  prompt: OpenRouterPrompt,
  env: OpenRouterEnv,
  options: OpenRouterTextOptions = {},
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

  const minLength = options.minLength ?? DEFAULT_MIN_COMMENT_LENGTH;
  const failureMessage = options.failureMessage ?? DEFAULT_FAILURE_MESSAGE;
  const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;

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
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
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
        message: failureMessage,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content.length < minLength) {
      return {
        ok: false,
        status: 502,
        message: content ? failureMessage : "Resposta vazia do modelo.",
      };
    }

    if (
      options.truncateAgainst !== undefined &&
      isTruncatedText(content, options.truncateAgainst)
    ) {
      return {
        ok: false,
        status: 502,
        message: failureMessage,
      };
    }

    if (leaksEngineNotation(content)) {
      return {
        ok: false,
        status: 502,
        message: failureMessage,
      };
    }

    return { ok: true, comment: content };
  } catch {
    return {
      ok: false,
      status: 502,
      message: failureMessage,
    };
  }
}

export async function requestOpenRouterComment(
  slice: Parameters<typeof buildPrompt>[0],
  env: OpenRouterEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterSuccess | OpenRouterFailure> {
  const { system, user } = buildPrompt(slice);
  return requestOpenRouterText(
    { system, user },
    env,
    {
      minLength: DEFAULT_MIN_COMMENT_LENGTH,
      truncateAgainst: slice.san,
      failureMessage: DEFAULT_FAILURE_MESSAGE,
    },
    fetchImpl,
  );
}
