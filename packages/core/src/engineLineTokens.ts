import type { PlayerColor } from "./types.ts";

export type EngineLineToken =
  | { kind: "num"; text: string }
  | { kind: "san"; san: string; index: number };

/**
 * Tokenize engine PV SANs into compact PGN move numbers plus clickable SAN tokens.
 * First SAN is the alternative at `ply` for `color`.
 */
export function tokenizeEngineLine(
  sans: readonly string[],
  ply: number,
  color: PlayerColor,
): EngineLineToken[] {
  if (sans.length === 0) {
    return [];
  }

  const tokens: EngineLineToken[] = [];
  let moveNum = Math.floor(ply / 2) + 1;
  let currentColor: PlayerColor = color;

  for (let i = 0; i < sans.length; i++) {
    const san = sans[i];
    if (san === undefined) {
      break;
    }

    if (currentColor === "white") {
      tokens.push({ kind: "num", text: `${moveNum}.` });
      tokens.push({ kind: "san", san, index: i });
    } else {
      if (i === 0 && color === "black") {
        tokens.push({ kind: "num", text: `${moveNum}...` });
      }
      tokens.push({ kind: "san", san, index: i });
    }

    if (currentColor === "black") {
      moveNum += 1;
    }
    currentColor = currentColor === "white" ? "black" : "white";
  }

  return tokens;
}
