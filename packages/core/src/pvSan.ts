import { Chess } from "chess.js";

export const ENGINE_PV_SAN_MAX = 5;

function uciToSanOnBoard(chess: Chess, uci: string): string | undefined {
  try {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion });
    return move?.san;
  } catch {
    return undefined;
  }
}

/**
 * Walk engine PV UCI from `fenBefore`, converting up to ENGINE_PV_SAN_MAX plies.
 * Stops at the first UCI that fails to convert; never emits raw UCI.
 */
export function uciPvToSan(
  fenBefore: string,
  pv: readonly string[],
): string | undefined {
  if (pv.length === 0) {
    return undefined;
  }

  try {
    const chess = new Chess(fenBefore);
    const sans: string[] = [];

    for (const uci of pv.slice(0, ENGINE_PV_SAN_MAX)) {
      const san = uciToSanOnBoard(chess, uci);
      if (san === undefined) {
        break;
      }
      sans.push(san);
    }

    return sans.length > 0 ? sans.join(" ") : undefined;
  } catch {
    return undefined;
  }
}
