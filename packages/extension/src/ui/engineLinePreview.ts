import { Chess } from "chess.js";

export interface EngineLinePreviewResult {
  fen: string;
  highlight: { from: string; to: string };
}

/**
 * Replay engine PV SANs from `fenBefore` through `index` inclusive.
 * Returns null when the SAN list is invalid or a move fails.
 */
export function previewEngineLineMove(
  fenBefore: string,
  sans: readonly string[],
  index: number,
): EngineLinePreviewResult | null {
  if (index < 0 || index >= sans.length) {
    return null;
  }

  try {
    const chess = new Chess(fenBefore);
    let lastFrom: string | undefined;
    let lastTo: string | undefined;

    for (let i = 0; i <= index; i++) {
      const san = sans[i];
      if (!san) {
        return null;
      }
      const move = chess.move(san);
      if (!move) {
        return null;
      }
      lastFrom = move.from;
      lastTo = move.to;
    }

    if (lastFrom === undefined || lastTo === undefined) {
      return null;
    }

    return {
      fen: chess.fen(),
      highlight: { from: lastFrom, to: lastTo },
    };
  } catch {
    return null;
  }
}
