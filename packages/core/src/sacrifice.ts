import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function opponent(color: Color): Color {
  return color === "w" ? "b" : "w";
}

/**
 * Sacrifice: after the ply, the destination is attacked by the opponent and
 * moved-piece value minus captured value is at least 3 (pawn sacs excluded).
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

    const movedPiece: PieceSymbol = move.promotion ?? move.piece;
    const movedValue = PIECE_VALUE[movedPiece];
    const capturedValue = move.captured ? PIECE_VALUE[move.captured] : 0;
    const net = movedValue - capturedValue;
    if (net < 3) {
      return false;
    }

    return chess.isAttacked(to, opponent(mover));
  } catch {
    return false;
  }
}
