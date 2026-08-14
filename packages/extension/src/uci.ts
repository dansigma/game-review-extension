export type UciScore = { type: "cp" | "mate"; value: number };

export interface UciInfo {
  depth?: number;
  seldepth?: number;
  multipv?: number;
  nodes?: number;
  nps?: number;
  timeMs?: number;
  score?: UciScore;
  pv?: string[];
}

function readNumber(parts: string[], flag: string): number | undefined {
  const index = parts.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  const raw = parts[index + 1];
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function parseInfoLine(line: string): UciInfo | null {
  if (!line.startsWith("info ")) {
    return null;
  }
  const parts = line.split(/\s+/);
  const info: UciInfo = {};
  info.depth = readNumber(parts, "depth");
  info.seldepth = readNumber(parts, "seldepth");
  info.multipv = readNumber(parts, "multipv");
  info.nodes = readNumber(parts, "nodes");
  info.nps = readNumber(parts, "nps");
  info.timeMs = readNumber(parts, "time");

  const scoreIndex = parts.indexOf("score");
  if (scoreIndex >= 0) {
    const kind = parts[scoreIndex + 1];
    const raw = parts[scoreIndex + 2];
    if ((kind === "cp" || kind === "mate") && raw !== undefined) {
      info.score = { type: kind, value: Number(raw) };
    }
  }

  const pvIndex = parts.indexOf("pv");
  if (pvIndex >= 0) {
    info.pv = parts.slice(pvIndex + 1).filter((token) => token.length > 0);
  }

  return info;
}

export function isBestMove(line: string): boolean {
  return line.startsWith("bestmove ");
}

export function isUciOk(line: string): boolean {
  return line === "uciok";
}

export function isReadyOk(line: string): boolean {
  return line === "readyok";
}
