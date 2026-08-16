import {
  clampGraphPawns,
  GRAPH_PAWN_CAP,
  graphPawns,
  graphYFraction,
  type EvalGraphPoint,
} from "@game-review/core";

const LINE = "#629924";
const FILL = "rgba(98, 153, 36, 0.15)";
const GRID = "#444";
const MIDLINE = "#666";
const CURSOR = "#f0ece4";
const LABEL = "#9e9a91";

function yAtPawns(padY: number, innerH: number, pawns: number): number {
  return padY + innerH * (1 - graphYFraction(clampGraphPawns(pawns)));
}

export function renderEvalGraph(
  canvas: HTMLCanvasElement,
  points: readonly EvalGraphPoint[],
  activePly: number,
): void {
  const width = canvas.clientWidth > 0 ? canvas.clientWidth : 280;
  const height = canvas.clientHeight > 0 ? canvas.clientHeight : 72;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx || points.length === 0) {
    return;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const padX = 4;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (const pawns of [2, -2]) {
    const y = yAtPawns(padY, innerH, pawns);
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + innerW, y);
    ctx.stroke();
  }

  ctx.strokeStyle = MIDLINE;
  const midY = yAtPawns(padY, innerH, 0);
  ctx.beginPath();
  ctx.moveTo(padX, midY);
  ctx.lineTo(padX + innerW, midY);
  ctx.stroke();

  const maxPly = Math.max(...points.map((p) => p.ply), 1);
  const xAt = (ply: number): number => padX + ((ply + 1) / (maxPly + 1)) * innerW;
  const yAt = (point: EvalGraphPoint): number =>
    yAtPawns(padY, innerH, graphPawns(point));

  const bottomY = padY + innerH;

  ctx.beginPath();
  ctx.moveTo(xAt(points[0]?.ply ?? -1), yAt(points[0] ?? { ply: -1, whiteWinPercent: 50 }));
  for (const point of points) {
    ctx.lineTo(xAt(point.ply), yAt(point));
  }
  ctx.lineTo(xAt(points[points.length - 1]?.ply ?? 0), bottomY);
  ctx.lineTo(xAt(points[0]?.ply ?? -1), bottomY);
  ctx.closePath();
  ctx.fillStyle = FILL;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(xAt(points[0]?.ply ?? -1), yAt(points[0] ?? { ply: -1, whiteWinPercent: 50 }));
  for (const point of points) {
    ctx.lineTo(xAt(point.ply), yAt(point));
  }
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  const cursorX = xAt(activePly);
  ctx.strokeStyle = CURSOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cursorX, padY);
  ctx.lineTo(cursorX, padY + innerH);
  ctx.stroke();

  ctx.fillStyle = LABEL;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`+${GRAPH_PAWN_CAP}`, padX, padY + 8);
  ctx.fillText(`-${GRAPH_PAWN_CAP}`, padX, padY + innerH - 2);
}
