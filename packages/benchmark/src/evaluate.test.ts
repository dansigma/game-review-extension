import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeMetrics } from "./evaluate.ts";
import type { PerGameResult } from "./types.ts";

describe("benchmark computeMetrics", () => {
  it("computes recall/precision/fpPer1000", () => {
    const perGame: PerGameResult[] = [
      { gameIndex: 0, answerPly: 10, isTP: true, isFN: false, falsePositives: [], totalPlies: 60 },
      { gameIndex: 1, answerPly: 20, isTP: false, isFN: true, falsePositives: [{ ply: 5, san: "Nf3", uci: "g1f3", classification: "brilliant" }], totalPlies: 70 },
      { gameIndex: 2, answerPly: 30, isTP: true, isFN: false, falsePositives: [{ ply: 2, san: "e4", uci: "e2e4", classification: "brilliant" }, { ply: 40, san: "Qh5", uci: "d1h5", classification: "brilliant" }], totalPlies: 80 },
    ];
    const totalPlies = 210;
    const m = computeMetrics(perGame, totalPlies, 3);
    expect(m.tp).toBe(2);
    expect(m.fn).toBe(1);
    expect(m.fp).toBe(3);
    expect(m.engineFailures).toBe(0);
    expect(m.recall).toBeCloseTo(2 / 3);
    expect(m.precision).toBeCloseTo(2 / 5);
    // fpPer1000 = 3*1000/(210-3)
    expect(m.fpPer1000).toBeCloseTo((3 * 1000) / 207);
  });

  it("excludes engine failures from FN and recall denominator", () => {
    const perGame: PerGameResult[] = [
      { gameIndex: 0, answerPly: 10, isTP: true, isFN: false, falsePositives: [], totalPlies: 60 },
      { gameIndex: 1, answerPly: 20, isTP: false, isFN: true, falsePositives: [], totalPlies: 70 },
      { gameIndex: 2, answerPly: 30, isTP: false, isFN: false, falsePositives: [], totalPlies: 0, error: "engine failure after retry: timeout", engineFailure: true },
    ];
    const totalPlies = 130; // only non-failed games contribute
    const m = computeMetrics(perGame, totalPlies, 3);
    expect(m.tp).toBe(1);
    expect(m.fn).toBe(1);
    expect(m.engineFailures).toBe(1);
    expect(m.fp).toBe(0);
    // recall = tp / (answerCount - engineFailures) = 1 / 2
    expect(m.recall).toBeCloseTo(1 / 2);
    // TP + FN + engineFailures should equal totalGames
    expect(m.tp + m.fn + m.engineFailures).toBe(3);
  });

  it("dataset fixture exists and has 100 entries with correct shape", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const p = resolve(__dirname, "../../core/fixtures/brilliant-benchmark/chessigma-100.json");
    const raw = readFileSync(p, "utf8");
    const data = JSON.parse(raw) as Array<{ pgn: string; ply: number }>;
    expect(data.length).toBe(100);
    for (const item of data.slice(0, 3)) {
      expect(typeof item.pgn).toBe("string");
      expect(typeof item.ply).toBe("number");
      expect(item.ply).toBeGreaterThan(0);
      expect(item.pgn).toContain("[Event");
    }
  });

  it("ply indexing: answer ply maps to a real move SAN via parsePgn", async () => {
    const { parsePgn } = await import("../../core/src/parsePgn.ts");
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const p = resolve(__dirname, "../../core/fixtures/brilliant-benchmark/chessigma-100.json");
    const raw = readFileSync(p, "utf8");
    const data = JSON.parse(raw) as Array<{ pgn: string; ply: number }>;
    // Spot-check first 3 games
    for (let i = 0; i < 3; i++) {
      const item = data[i]!;
      const game = parsePgn(item.pgn);
      const idx = item.ply - 1;
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(game.moves.length);
      const move = game.moves[idx]!;
      expect(move.san.length).toBeGreaterThan(0);
      expect(move.uci.length).toBeGreaterThanOrEqual(4);
    }
  });
});
