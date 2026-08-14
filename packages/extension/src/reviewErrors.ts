import { formatLichessExportHttpError } from "./lichessExport.ts";
import { LichessProviderError } from "./lichessProvider.ts";

export { formatLichessExportHttpError };

export const ENGINE_LOAD_ERROR_PT =
  "Motor de análise não carregou — feche e reabra o painel";

function isEngineLoadFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("wasm") ||
    lower.includes("nnue") ||
    lower.includes("sharedarraybuffer") ||
    lower.includes("engine session") ||
    lower.includes("stockfish")
  );
}

export function formatReviewError(error: unknown): string {
  if (error instanceof LichessProviderError) {
    return error.message;
  }

  const text = error instanceof Error ? error.message : String(error);

  const httpMatch = /Lichess export HTTP (\d+)/.exec(text);
  if (httpMatch) {
    return formatLichessExportHttpError(Number(httpMatch[1]));
  }

  if (
    text.includes("Failed to fetch") ||
    text.includes("NetworkError") ||
    text === "Background request failed"
  ) {
    return "Falha de rede";
  }

  if (isEngineLoadFailure(text)) {
    return ENGINE_LOAD_ERROR_PT;
  }

  return text;
}
