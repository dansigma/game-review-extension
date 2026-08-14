import { Chess, type Square } from "chess.js";

/** In-repo SVG board (MIT). No chessground / GPL surface. */
const LIGHT = "#eeeed2";
const DARK = "#769656";
const HIGHLIGHT = "rgba(155, 199, 0, 0.5)";
const LAST_MOVE = "rgba(155, 199, 0, 0.35)";

const PIECE_GLYPH: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

export interface BoardHighlight {
  from?: string;
  to?: string;
}

function squareColor(file: number, rank: number): string {
  return (file + rank) % 2 === 0 ? LIGHT : DARK;
}

function parseSquare(sq: string): { file: number; rank: number } | null {
  if (sq.length !== 2) {
    return null;
  }
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }
  return { file, rank };
}

export function fenAtPly(
  initialFen: string,
  fensAfter: readonly string[],
  ply: number,
): string {
  if (ply < 0) {
    return initialFen;
  }
  const fen = fensAfter[ply];
  if (!fen) {
    return initialFen;
  }
  return fen;
}

export function renderChessBoard(
  container: HTMLElement,
  fen: string,
  highlight: BoardHighlight = {},
): void {
  const chess = new Chess(fen);
  const board = chess.board();
  const size = container.clientWidth > 0 ? container.clientWidth : 280;
  const cell = size / 8;

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Tabuleiro de xadrez");

  for (let rank = 7; rank >= 0; rank -= 1) {
    for (let file = 0; file < 8; file += 1) {
      const x = file * cell;
      const y = (7 - rank) * cell;
      const rect = document.createElementNS(svgNs, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(cell));
      rect.setAttribute("height", String(cell));
      rect.setAttribute("fill", squareColor(file, rank));
      svg.appendChild(rect);
    }
  }

  const from = highlight.from ? parseSquare(highlight.from) : null;
  const to = highlight.to ? parseSquare(highlight.to) : null;
  for (const sq of [from, to]) {
    if (!sq) {
      continue;
    }
    const rect = document.createElementNS(svgNs, "rect");
    rect.setAttribute("x", String(sq.file * cell));
    rect.setAttribute("y", String((7 - sq.rank) * cell));
    rect.setAttribute("width", String(cell));
    rect.setAttribute("height", String(cell));
    rect.setAttribute("fill", from && to ? LAST_MOVE : HIGHLIGHT);
    svg.appendChild(rect);
  }

  for (let rank = 7; rank >= 0; rank -= 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (!piece) {
        continue;
      }
      const key = `${piece.color}${piece.type}`;
      const glyph = PIECE_GLYPH[key];
      if (!glyph) {
        continue;
      }
      const text = document.createElementNS(svgNs, "text");
      text.setAttribute("x", String(file * cell + cell / 2));
      text.setAttribute("y", String((7 - rank) * cell + cell * 0.68));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", String(cell * 0.78));
      text.setAttribute(
        "fill",
        piece.color === "w" ? "#ffffff" : "#000000",
      );
      text.setAttribute("stroke", piece.color === "w" ? "#333" : "#fff");
      text.setAttribute("stroke-width", "0.4");
      text.textContent = glyph;
      svg.appendChild(text);
    }
  }

  container.replaceChildren(svg);
}

export function uciSquares(uci: string): { from: Square; to: Square } | null {
  if (uci.length < 4) {
    return null;
  }
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  return { from, to };
}
