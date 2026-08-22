import { parsePgn } from "../../core/src/parsePgn.ts";
import { reviewGame } from "../../core/src/reviewEngine.ts";
import type { PositionEval } from "../../core/src/types.ts";
import { BENCHMARK_ENGINE_ID, BENCHMARK_MULTIPV, BENCHMARK_NODES_PER_POSITION, StockfishBinaryEngine } from "./engine.ts";
import type { BenchmarkGameInput, BenchmarkResults, GlobalMetrics, PerGameResult } from "./types.ts";

export const DATASET_REL = "packages/core/fixtures/brilliant-benchmark/chessigma-100.json";

export function computeMetrics(perGame: PerGameResult[], totalPlies: number, answerCount: number): GlobalMetrics {
  const tp = perGame.filter((g) => g.isTP).length;
  const fn = perGame.filter((g) => g.isFN).length;
  const fp = perGame.reduce((sum, g) => sum + g.falsePositives.length, 0);
  const recall = answerCount > 0 ? tp / answerCount : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const ordinaryMoves = totalPlies - answerCount;
  const fpPer1000 = ordinaryMoves > 0 ? (fp * 1000) / ordinaryMoves : 0;
  return { totalGames: perGame.length, tp, fn, fp, recall, precision, fpPer1000, totalPlies };
}

export async function evaluateOneGame(
  input: BenchmarkGameInput,
  gameIndex: number,
  engine: StockfishBinaryEngine,
  nodesPerPosition: number,
): Promise<PerGameResult> {
  try {
    const game = parsePgn(input.pgn);
    const answerPly1Based = input.ply;
    const answerIndex0Based = answerPly1Based - 1; // convert to 0-based
    if (answerIndex0Based < 0 || answerIndex0Based >= game.moves.length) {
      throw new Error(`Answer ply ${answerPly1Based} out of range (moves=${game.moves.length})`);
    }
    const fens = [game.initialFen, ...game.moves.map((m) => m.fenAfter)];
    const evals: PositionEval[] = [];
    for (let ply = 0; ply < fens.length; ply++) {
      const fen = fens[ply]!;
      const ev = await engine.analyzePosition({ fen, nodes: nodesPerPosition, multipv: BENCHMARK_MULTIPV });
      // engine returns ply 0 placeholder; fix to actual ply index
      ev.ply = ply - 1; // PositionEval ply: -1 for start, 0 for after first move, etc. But reviewGame expects evals[0] ply -1? Let's see: reviewGame graphs start at ply -1. We'll set consistently: evals index i corresponds to position before move i (for i < moves.length) and after last move.
      // Actually PositionEval ply field is just for debugging; reviewGame doesn't use it except for error messages. We'll set evals[i].ply = i-1
      ev.ply = ply - 1;
      evals.push(ev);
    }
    const review = reviewGame({ game, evals, engineId: BENCHMARK_ENGINE_ID, nodesPerPosition });
    const answerMove = game.moves[answerIndex0Based];
    const reviewedAtAnswer = review.moves.find((m) => m.ply === answerIndex0Based);
    if (!reviewedAtAnswer) throw new Error("Missing reviewed move at answer ply");
    const isTP = reviewedAtAnswer.classification === "brilliant";
    const falsePositives = review.moves
      .filter((m) => m.classification === "brilliant" && m.ply !== answerIndex0Based)
      .map((m) => ({ ply: m.ply + 1, san: m.san, uci: m.uci, classification: m.classification }));

    return {
      gameIndex,
      answerPly: answerPly1Based,
      answerSan: answerMove?.san,
      answerUci: answerMove?.uci,
      ourClassificationAtAnswer: reviewedAtAnswer.classification,
      isTP,
      isFN: !isTP,
      falsePositives,
      totalPlies: game.moves.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      gameIndex,
      answerPly: input.ply,
      isTP: false,
      isFN: true,
      falsePositives: [],
      totalPlies: 0,
      error: msg,
    };
  }
}

export async function evaluateAll(
  dataset: BenchmarkGameInput[],
  opts: { nodesPerPosition?: number; enginePath?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<BenchmarkResults> {
  const nodesPerPosition = opts.nodesPerPosition ?? BENCHMARK_NODES_PER_POSITION;
  const start = Date.now();
  const perGame: PerGameResult[] = [];
  let totalPlies = 0;
  let enginePath = opts.enginePath ?? "unknown";
  // Use per-game engine to avoid long-lived process instability; recreate every game
  for (let i = 0; i < dataset.length; i++) {
    const input = dataset[i]!;
    // Retry once with fresh engine on failure
    let res: PerGameResult | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const engine = new StockfishBinaryEngine(opts.enginePath);
      try {
        await engine.init();
        enginePath = (engine as unknown as { enginePath: string }).enginePath ?? enginePath;
        res = await evaluateOneGame(input, i, engine, nodesPerPosition);
        engine.dispose();
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Game ${i} attempt ${attempt + 1} failed: ${msg}`);
        try {
          engine.dispose();
        } catch {}
        if (attempt === 1) {
          res = {
            gameIndex: i,
            answerPly: input.ply,
            isTP: false,
            isFN: true,
            falsePositives: [],
            totalPlies: 0,
            error: `engine failure after retry: ${msg}`,
          };
        } else {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
    const finalRes = res!;
    perGame.push(finalRes);
    totalPlies += finalRes.totalPlies;
    opts.onProgress?.(i + 1, dataset.length);
  }
  const wallClockMs = Date.now() - start;
  const metrics = computeMetrics(perGame, totalPlies, dataset.length);
  return {
    meta: {
      enginePath,
      engineId: BENCHMARK_ENGINE_ID,
      nodesPerPosition,
      multipv: BENCHMARK_MULTIPV,
      dataset: "chessigma-100",
      generatedAt: new Date().toISOString(),
      wallClockMs,
      totalGames: dataset.length,
    },
    metrics,
    perGame,
  };
}
