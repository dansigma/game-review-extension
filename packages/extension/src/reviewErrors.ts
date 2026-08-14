import { PgnParseError } from "@game-review/core";
import { formatLichessExportHttpError } from "./lichessExport.ts";
import { LichessProviderError } from "./lichessProvider.ts";
import { PgnProviderError } from "./pgnProvider.ts";

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

function formatPgnParseError(error: PgnParseError): string {
  if (error.message === "PGN is empty") {
    return "PGN vazio";
  }
  if (error.message === "Only standard chess is supported in the MVP") {
    return "Apenas xadrez padrão é suportado";
  }
  const variantMatch = /^Unsupported variant: (.+)$/.exec(error.message);
  if (variantMatch?.[1]) {
    return `Variante não suportada: ${variantMatch[1]}`;
  }
  return `PGN inválido: ${error.message}`;
}

export function formatReviewError(error: unknown): string {
  if (error instanceof LichessProviderError) {
    return error.message;
  }

  if (error instanceof PgnProviderError) {
    return error.message;
  }

  if (error instanceof PgnParseError) {
    return formatPgnParseError(error);
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
