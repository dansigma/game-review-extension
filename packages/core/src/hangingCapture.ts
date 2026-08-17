import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { PIECE_VALUE } from "./sacrifice.ts";
import { isCapture, type RecapturePly } from "./recapture.ts";

const SEE_MAX_DEPTH = 32;

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

function flipSideToMove(fen: string): string | null {
  const parts = fen.split(" ");
  if (parts.length < 2) {
    return null;
  }
  const stm = parts[1];
  if (stm !== "w" && stm !== "b") {
    return null;
  }
  parts[1] = stm === "w" ? "b" : "w";
  if (parts.length >= 4) {
    parts[3] = "-";
  }
  const flipped = parts.join(" ");
  try {
    new Chess(flipped);
    return flipped;
  } catch {
    return null;
  }
}

function capturesToSquare(fen: string, square: string) {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).filter(
    (move) =>
      move.to === square &&
      (move.captured !== undefined || move.flags.includes("e")),
  );
}

function captureMovesToSquare(fen: string, square: string) {
  return capturesToSquare(fen, square).sort((a, b) => {
    const victimA = a.captured ? PIECE_VALUE[a.captured] : PIECE_VALUE.p;
    const victimB = b.captured ? PIECE_VALUE[b.captured] : PIECE_VALUE.p;
    const aggressorA = PIECE_VALUE[a.piece];
    const aggressorB = PIECE_VALUE[b.piece];
    return victimB - victimA || aggressorA - aggressorB;
  });
}

function seeOnSquare(fen: string, square: string, depth = 0): number {
  if (depth >= SEE_MAX_DEPTH) {
    return 0;
  }

  const captures = captureMovesToSquare(fen, square);
  if (captures.length === 0) {
    return 0;
  }

  let best = Number.NEGATIVE_INFINITY;
  for (const capture of captures) {
    const chess = new Chess(fen);
    chess.move(capture);
    const victim = capture.captured
      ? PIECE_VALUE[capture.captured]
      : PIECE_VALUE.p;
    const score = victim - seeOnSquare(chess.fen(), square, depth + 1);
    if (score > best) {
      best = score;
    }
  }
  return best;
}

/**
 * Square-limited SEE: net centipawns for the side playing `uci` after swap-offs on
 * the capture destination only.
 */
export function squareSee(fenBefore: string, uci: string): number | null {
  try {
    const trimmed = uci.trim().toLowerCase();
    if (trimmed.length < 4) {
      return null;
    }
    const from = trimmed.slice(0, 2) as Square;
    const to = trimmed.slice(2, 4) as Square;
    const promotion = trimmed.length > 4 ? trimmed[4] : undefined;
    const chess = new Chess(fenBefore);
    const move = chess.move({ from, to, promotion });
    if (!move) {
      return null;
    }
    if (move.captured === undefined && !move.flags.includes("e")) {
      return null;
    }
    const gain =
      move.captured !== undefined
        ? PIECE_VALUE[move.captured as PieceSymbol]
        : PIECE_VALUE.p;
    const continuation = seeOnSquare(chess.fen(), to);
    return gain - continuation;
  } catch {
    return null;
  }
}

/**
 * True when `sideToMoveColor` has a legal capture onto `square` with square SEE > 100.
 */
export function wasWinningCaptureOnSquare(
  fen: string,
  sideToMoveColor: Color,
  square: string,
): boolean {
  try {
    const chess = new Chess(fen);
    let evalFen = fen;
    if (chess.turn() !== sideToMoveColor) {
      const flipped = flipSideToMove(fen);
      if (!flipped) {
        return false;
      }
      evalFen = flipped;
    }

    const captures = captureMovesToSquare(evalFen, square);
    for (const capture of captures) {
      const uci =
        capture.from +
        capture.to +
        (capture.promotion ? capture.promotion : "");
      const see = squareSee(evalFen, uci);
      if (see !== null && see > 100) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function isNewlyHangingCapture(
  previous: RecapturePly | undefined,
  current: RecapturePly,
): boolean {
  if (!previous) {
    return false;
  }
  if (!isCapture(current.fenBefore, current.uci)) {
    return false;
  }

  const see = squareSee(current.fenBefore, current.uci);
  if (see === null || see <= 100) {
    return false;
  }

  const toSquare = uciToSquare(current.uci);
  if (!toSquare) {
    return false;
  }

  const mover = new Chess(current.fenBefore).turn();
  if (wasWinningCaptureOnSquare(previous.fenBefore, mover, toSquare)) {
    return false;
  }

  return true;
}

export function isTrivialHangingCapture(
  previous: RecapturePly | undefined,
  current: RecapturePly,
  alternativeUci?: string,
): boolean {
  if (!isNewlyHangingCapture(previous, current)) {
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
