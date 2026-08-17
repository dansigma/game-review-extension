import { buildPrompt } from "./buildPrompt.ts";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

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
        max_tokens: 256,
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

    return { ok: true, comment: content };
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Falha ao gerar comentário.",
    };
  }
}
