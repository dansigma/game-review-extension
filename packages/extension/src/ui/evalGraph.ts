import type { EvalGraphPoint } from "@game-review/core";

const LINE = "#629924";
const FILL = "rgba(98, 153, 36, 0.15)";
const GRID = "#444";
const MIDLINE = "#666";
const CURSOR = "#f0ece4";
const LABEL = "#9e9a91";

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
  for (const pct of [25, 50, 75]) {
    const y = padY + innerH * (1 - pct / 100);
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + innerW, y);
    ctx.stroke();
  }

  ctx.strokeStyle = MIDLINE;
  ctx.setLineDash([4, 4]);
  const midY = padY + innerH / 2;
  ctx.beginPath();
  ctx.moveTo(padX, midY);
  ctx.lineTo(padX + innerW, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  const maxPly = Math.max(...points.map((p) => p.ply), 1);
  const xAt = (ply: number): number => padX + ((ply + 1) / (maxPly + 1)) * innerW;
  const yAt = (wp: number): number => padY + innerH * (1 - wp / 100);

  ctx.beginPath();
  ctx.moveTo(xAt(points[0]?.ply ?? -1), yAt(points[0]?.whiteWinPercent ?? 50));
  for (const point of points) {
    ctx.lineTo(xAt(point.ply), yAt(point.whiteWinPercent));
  }
  ctx.lineTo(xAt(points[points.length - 1]?.ply ?? 0), padY + innerH);
  ctx.lineTo(xAt(points[0]?.ply ?? -1), padY + innerH);
  ctx.closePath();
  ctx.fillStyle = FILL;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(xAt(points[0]?.ply ?? -1), yAt(points[0]?.whiteWinPercent ?? 50));
  for (const point of points) {
    ctx.lineTo(xAt(point.ply), yAt(point.whiteWinPercent));
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
  ctx.fillText("Brancas", padX, padY - 1);
  ctx.textAlign = "right";
  ctx.fillText("Pretas", padX + innerW, height - 1);
}
