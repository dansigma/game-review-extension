import { Chess, type Square } from "chess.js";
import { pieceSvg, type PieceType } from "./chessPieces.ts";

/** In-repo SVG board. Pieces: Cburnett (GPL/CC BY-SA). Not chessground. */
const LIGHT = "#ebd3b0";
const DARK = "#b88762";
const LAST_MOVE = "rgba(205, 210, 106, 0.62)";
const BORDER = "#3d2b1f";
const COORD_ON_LIGHT = "#b88762";
const COORD_ON_DARK = "#ebd3b0";
const FILES = "abcdefgh";

export interface BoardHighlight {
  from?: string;
  to?: string;
}

/** chess.js row index for a chess rank (0 = 1st rank). */
export function boardRowForRank(chessRank: number): number {
  return 7 - chessRank;
}

export function isDarkSquare(file: number, chessRank: number): boolean {
  return (file + chessRank) % 2 === 0;
}

export function displayYForRank(chessRank: number, cell: number): number {
  return (7 - chessRank) * cell;
}

function squareColor(file: number, chessRank: number): string {
  return isDarkSquare(file, chessRank) ? DARK : LIGHT;
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

function svgEl(name: string): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

function appendPiece(
  parent: SVGElement,
  type: PieceType,
  color: "w" | "b",
  x: number,
  y: number,
  cell: number,
): void {
  const source = pieceSvg(color, type);
  if (!source) {
    return;
  }
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.localName !== "svg") {
    return;
  }
  const nested = document.importNode(root, true);
  nested.setAttribute("x", String(x));
  nested.setAttribute("y", String(y));
  nested.setAttribute("width", String(cell));
  nested.setAttribute("height", String(cell));
  nested.setAttribute("viewBox", nested.getAttribute("viewBox") ?? "0 0 45 45");
  parent.appendChild(nested);
}

function appendCoordinates(svg: SVGElement, cell: number): void {
  const font = Math.max(8, cell * 0.18);
  for (let file = 0; file < 8; file += 1) {
    const label = svgEl("text");
    const onDark = isDarkSquare(file, 0);
    label.setAttribute("x", String(file * cell + cell * 0.08));
    label.setAttribute("y", String(displayYForRank(0, cell) + cell * 0.92));
    label.setAttribute("fill", onDark ? COORD_ON_DARK : COORD_ON_LIGHT);
    label.setAttribute("font-size", String(font));
    label.setAttribute("font-family", "system-ui, Segoe UI, sans-serif");
    label.setAttribute("font-weight", "600");
    label.textContent = FILES[file] ?? "";
    svg.appendChild(label);
  }
  for (let rank = 0; rank < 8; rank += 1) {
    const label = svgEl("text");
    const onDark = isDarkSquare(0, rank);
    label.setAttribute("x", String(cell * 0.08));
    label.setAttribute("y", String(displayYForRank(rank, cell) + cell * 0.22));
    label.setAttribute("fill", onDark ? COORD_ON_DARK : COORD_ON_LIGHT);
    label.setAttribute("font-size", String(font));
    label.setAttribute("font-family", "system-ui, Segoe UI, sans-serif");
    label.setAttribute("font-weight", "600");
    label.textContent = String(rank + 1);
    svg.appendChild(label);
  }
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

  const svg = svgEl("svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Tabuleiro de xadrez");

  for (let rank = 7; rank >= 0; rank -= 1) {
    for (let file = 0; file < 8; file += 1) {
      const rect = svgEl("rect");
      rect.setAttribute("x", String(file * cell));
      rect.setAttribute("y", String(displayYForRank(rank, cell)));
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
    const rect = svgEl("rect");
    rect.setAttribute("x", String(sq.file * cell));
    rect.setAttribute("y", String(displayYForRank(sq.rank, cell)));
    rect.setAttribute("width", String(cell));
    rect.setAttribute("height", String(cell));
    rect.setAttribute("fill", LAST_MOVE);
    svg.appendChild(rect);
  }

  appendCoordinates(svg, cell);

  for (let rank = 7; rank >= 0; rank -= 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[boardRowForRank(rank)]?.[file];
      if (!piece) {
        continue;
      }
      appendPiece(
        svg,
        piece.type as PieceType,
        piece.color,
        file * cell,
        displayYForRank(rank, cell),
        cell,
      );
    }
  }

  const border = svgEl("rect");
  border.setAttribute("x", "0.5");
  border.setAttribute("y", "0.5");
  border.setAttribute("width", String(size - 1));
  border.setAttribute("height", String(size - 1));
  border.setAttribute("fill", "none");
  border.setAttribute("stroke", BORDER);
  border.setAttribute("stroke-width", "1");
  svg.appendChild(border);

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
