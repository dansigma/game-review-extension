import type { EngineLine, PositionEval } from "@game-review/core";
import type { UciInfo } from "./uci.ts";

export function uciInfosToEngineLines(infos: readonly UciInfo[]): EngineLine[] {
  const latestByPv = new Map<number, UciInfo>();
  for (const info of infos) {
    if (info.score && info.pv && info.pv.length > 0) {
      latestByPv.set(info.multipv ?? 1, info);
    }
  }
  return [...latestByPv.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, info]) => {
      const score = info.score;
      const pv = info.pv;
      if (!score || !pv || pv.length === 0) {
        throw new Error("Incomplete UCI info line");
      }
      return {
        multipv: info.multipv ?? 1,
        depth: info.depth ?? 0,
        nodes: info.nodes,
        score,
        pv,
      };
    });
}

export function buildPositionEval(
  fen: string,
  ply: number,
  infos: readonly UciInfo[],
): PositionEval {
  const lines = uciInfosToEngineLines(infos);
  if (lines.length === 0) {
    throw new Error("No engine lines for position");
  }
  return { fen, ply, lines };
}
