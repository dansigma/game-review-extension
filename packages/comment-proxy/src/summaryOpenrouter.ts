import { buildSummaryPrompt } from "./buildSummaryPrompt.ts";
import {
  requestOpenRouterText,
  type OpenRouterEnv,
  type OpenRouterFailure,
  type OpenRouterSuccess,
} from "./openrouter.ts";
import type { GameSummarySlice } from "@game-review/core";

const MIN_SUMMARY_LENGTH = 24;
const SUMMARY_FAILURE_MESSAGE = "Falha ao gerar resumo.";

export async function requestOpenRouterSummary(
  slice: GameSummarySlice,
  env: OpenRouterEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterSuccess | OpenRouterFailure> {
  const prompt = buildSummaryPrompt(slice);
  return requestOpenRouterText(
    prompt,
    env,
    {
      minLength: MIN_SUMMARY_LENGTH,
      failureMessage: SUMMARY_FAILURE_MESSAGE,
    },
    fetchImpl,
  );
}
