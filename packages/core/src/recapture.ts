import { Chess } from "chess.js";

export interface RecapturePly {
  fenBefore: string;
  uci: string;
}

function uciToSquare(uci: string): string | undefined {
  const trimmed = uci.trim().toLowerCase();
  if (trimmed.length < 4) {
    return undefined;
  }
  const to = trimmed.slice(2, 4);
  if (!/^[a-h][1-8]$/.test(to)) {
    return undefined;
  }
  return to;
}

export function isCapture(fenBefore: string, uci: string): boolean {
  try {
    const trimmed = uci.trim().toLowerCase();
    if (trimmed.length < 4) {
      return false;
    }
    const from = trimmed.slice(0, 2);
    const to = trimmed.slice(2, 4);
    const promotion = trimmed.length > 4 ? trimmed[4] : undefined;
    const chess = new Chess(fenBefore);
    const move = chess.move({ from, to, promotion });
    if (!move) {
      return false;
    }
    return move.captured !== undefined || move.flags.includes("e");
  } catch {
    return false;
  }
}

export function isRecapture(
  previous: RecapturePly | undefined,
  current: RecapturePly,
): boolean {
  if (!previous) {
    return false;
  }
  const currentTo = uciToSquare(current.uci);
  const previousTo = uciToSquare(previous.uci);
  if (!currentTo || !previousTo || currentTo !== previousTo) {
    return false;
  }
  if (!isCapture(previous.fenBefore, previous.uci)) {
    return false;
  }
  return isCapture(current.fenBefore, current.uci);
}

export function isTrivialRecapture(
  previous: RecapturePly | undefined,
  current: RecapturePly,
  alternativeUci?: string,
): boolean {
  if (!isRecapture(previous, current)) {
    return false;
  }
  const captureSquare = uciToSquare(current.uci);
  if (!captureSquare) {
    return false;
  }
  const currentFrom = current.uci.trim().toLowerCase().slice(0, 2);

  if (!alternativeUci) {
    return true;
  }

  const alt = alternativeUci.trim().toLowerCase();
  if (alt.length < 4) {
    return true;
  }
  const altFrom = alt.slice(0, 2);
  const altTo = alt.slice(2, 4);

  if (
    altTo === captureSquare &&
    altFrom !== currentFrom &&
    isCapture(current.fenBefore, alternativeUci)
  ) {
    return false;
  }

  return true;
}
