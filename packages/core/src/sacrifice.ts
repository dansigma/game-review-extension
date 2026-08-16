import {
  Chess,
  SQUARES,
  type Color,
  type PieceSymbol,
  type Square,
} from "chess.js";

/** Centipawn piece values for tactical material. */
export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 0,
};

/** Real material loss after recaptures must exceed one pawn. */
export const SACRIFICE_CP_DROP = 100;

const MATE_SCORE = -10_000;
const QSEARCH_MAX_DEPTH = 8;
const QSEARCH_MAX_NODES = 64;

function staticMaterial(fen: string, color: Color): number {
  const chess = new Chess(fen);
  let own = 0;
  let opponentMaterial = 0;
  for (const square of SQUARES) {
    const piece = chess.get(square);
    if (!piece) {
      continue;
    }
    const value = PIECE_VALUE[piece.type];
    if (piece.color === color) {
      own += value;
    } else {
      opponentMaterial += value;
    }
  }
  return own - opponentMaterial;
}

function captureMoves(chess: Chess) {
  return chess
    .moves({ verbose: true })
    .filter((move) => move.captured !== undefined || move.flags.includes("e"));
}

function captureOrder(
  a: ReturnType<typeof captureMoves>[number],
  b: ReturnType<typeof captureMoves>[number],
): number {
  const victimA = a.captured ? PIECE_VALUE[a.captured] : PIECE_VALUE.p;
  const victimB = b.captured ? PIECE_VALUE[b.captured] : PIECE_VALUE.p;
  const aggressorA = PIECE_VALUE[a.piece];
  const aggressorB = PIECE_VALUE[b.piece];
  return victimB - victimA || aggressorA - aggressorB;
}

interface QSearchBudget {
  nodes: number;
}

/**
 * Capture-only quiescence: best tactical outcome for side to move, in centipawns.
 */
export function evalAfterCaptures(fen: string): number {
  const budget: QSearchBudget = { nodes: 0 };
  return qsearch(fen, QSEARCH_MAX_DEPTH, budget);
}

function qsearch(fen: string, depth: number, budget: QSearchBudget): number {
  if (budget.nodes >= QSEARCH_MAX_NODES) {
    const chess = new Chess(fen);
    return staticMaterial(fen, chess.turn());
  }
  budget.nodes += 1;

  const chess = new Chess(fen);
  const stm = chess.turn();

  if (chess.isCheckmate()) {
    return MATE_SCORE;
  }
  if (chess.isStalemate() || chess.isDraw()) {
    return 0;
  }

  const standPat = staticMaterial(fen, stm);
  if (depth <= 0) {
    return standPat;
  }

  const captures = captureMoves(chess).sort(captureOrder);
  if (captures.length === 0) {
    return standPat;
  }

  let best = standPat;
  for (const capture of captures) {
    const next = new Chess(fen);
    next.move(capture);
    const score = -qsearch(next.fen(), depth - 1, budget);
    if (score > best) {
      best = score;
      if (best > -MATE_SCORE / 2) {
        break;
      }
    }
  }
  return best;
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

/**
 * Sacrifice when the move causes new hanging material: tactical standing before
 * the ply (opponent to move) minus standing after exceeds {@link SACRIFICE_CP_DROP}.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  try {
    const chess = new Chess(fenBefore);
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const mover = chess.turn();
    const move = chess.move({ from, to, promotion });
    if (!move) {
      return false;
    }

    const standingAfter = -evalAfterCaptures(chess.fen());
    const flippedFen = flipSideToMove(fenBefore);
    const standingBefore = flippedFen
      ? -evalAfterCaptures(flippedFen)
      : staticMaterial(fenBefore, mover);
    return standingBefore - standingAfter > SACRIFICE_CP_DROP;
  } catch {
    return false;
  }
}
