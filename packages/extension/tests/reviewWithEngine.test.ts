import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  parsePgn,
  type EngineLine,
  type PositionEval,
} from "@game-review/core";
import { nodesForPreset } from "../src/budgetDecision.ts";
import type { EnginePort } from "../src/enginePort.ts";
import { reviewGameWithEngine } from "../src/reviewWithEngine.ts";

function coreFixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../core/fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

const SLOPE = 0.00368208;

function cpFromWinPercent(winPercent: number): number {
  const p = Math.min(99.5, Math.max(0.5, winPercent)) / 100;
  return -Math.log(1 / p - 1) / SLOPE;
}

function line(
  multipv: number,
  score: EngineLine["score"],
  pv: string | string[],
): EngineLine {
  return { multipv, depth: 16, score, pv: Array.isArray(pv) ? pv : [pv] };
}

function classificationCoverageEvals(
  game: ReturnType<typeof parsePgn>,
): PositionEval[] {
  const stmWin = [55, 45, 58, 50, 64, 60, 40];
  const pvs = [
    "e2e4",
    "c7c5",
    "d2d4",
    "g8f6",
    "d2d4",
    "a7a6",
    "d2d4",
  ];
  const alt = "a2a3";

  return stmWin.map((wp, ply) => {
    const fen =
      ply === 0 ? game.initialFen : (game.moves[ply - 1]?.fenAfter ?? "");
    const pv = pvs[ply] ?? alt;
    return {
      fen,
      ply,
      lines: [
        line(1, { type: "cp", value: cpFromWinPercent(wp) }, pv),
        line(2, { type: "cp", value: cpFromWinPercent(wp) - 15 }, alt),
      ],
    };
  });
}

function createMockPort(
  game: ReturnType<typeof parsePgn>,
  opts: {
    pass1Evals?: PositionEval[];
    onAnalyzePosition?: (fen: string, go?: string) => void;
  } = {},
): EnginePort & {
  analyzePositionCalls: Array<{ fen: string; go?: string }>;
} {
  const pass1Evals = opts.pass1Evals ?? classificationCoverageEvals(game);
  const analyzePositionCalls: Array<{ fen: string; go?: string }> = [];

  return {
    analyzePositionCalls,
    init: vi.fn(async () => {}),
    dispose: vi.fn(),
    analyzeGame: vi.fn(async (args) => {
      const evals = structuredClone(pass1Evals);
      for (let ply = 0; ply < evals.length; ply += 1) {
        if (args.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        args.onProgress?.(ply + 1, evals.length);
      }
      return evals;
    }),
    analyzePosition: vi.fn(async (args) => {
      analyzePositionCalls.push({ fen: args.fen, go: args.go });
      opts.onAnalyzePosition?.(args.fen, args.go);
      if (args.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return {
        fen: args.fen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: 900 }, "d2d4"),
          line(2, { type: "cp", value: 850 }, "a2a3"),
        ],
      };
    }),
  };
}

describe("reviewGameWithEngine two-pass orchestration", () => {
  const game = parsePgn(coreFixture("classification-coverage.pgn"));

  it("runs pass 1 once, pass 2 only on critical eval indexes, then re-reviews", async () => {
    const port = createMockPort(game);
    const progress: Array<{ done: number; total: number }> = [];

    const review = await reviewGameWithEngine(port, {
      game,
      nodesPerPosition: nodesForPreset("fast"),
      onProgress: (done, total) => {
        progress.push({ done, total });
      },
    });

    expect(port.analyzeGame).toHaveBeenCalledTimes(1);
    expect(port.analyzePosition).toHaveBeenCalled();
    expect(port.analyzePositionCalls.length).toBeGreaterThan(0);
    for (const call of port.analyzePositionCalls) {
      expect(call.go).toBe(`nodes ${nodesForPreset("standard")}`);
    }
    expect(review.nodesPerPosition).toBe(nodesForPreset("fast"));
    expect(review.moves.length).toBe(game.moves.length);
    expect(progress.at(-1)?.done).toBe(progress.at(-1)?.total);
  });

  it("skips pass 2 for Deep preset", async () => {
    const port = createMockPort(game);
    await reviewGameWithEngine(port, {
      game,
      nodesPerPosition: nodesForPreset("deep"),
    });
    expect(port.analyzeGame).toHaveBeenCalledTimes(1);
    expect(port.analyzePosition).not.toHaveBeenCalled();
  });

  it("propagates abort during pass 1", async () => {
    const port = createMockPort(game);
    const controller = new AbortController();
    controller.abort();

    await expect(
      reviewGameWithEngine(port, {
        game,
        nodesPerPosition: nodesForPreset("standard"),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("propagates abort during pass 2", async () => {
    const controller = new AbortController();
    const port = createMockPort(game, {
      onAnalyzePosition: () => {
        controller.abort();
      },
    });

    await expect(
      reviewGameWithEngine(port, {
        game,
        nodesPerPosition: nodesForPreset("fast"),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(port.analyzePositionCalls.length).toBeGreaterThan(0);
  });

  it("node-weights progress across both passes", async () => {
    const port = createMockPort(game);
    const pass1Nodes = nodesForPreset("fast");
    const pass2Nodes = nodesForPreset("standard");
    const nPass1 = game.moves.length + 1;
    let lastTotal = 0;

    await reviewGameWithEngine(port, {
      game,
      nodesPerPosition: pass1Nodes,
      onProgress: (_done, total) => {
        lastTotal = total;
      },
    });

    const pass2Calls = port.analyzePositionCalls.length;
    const expectedTotal = Math.round(
      (nPass1 * pass1Nodes + pass2Calls * pass2Nodes) / 1000,
    );
    expect(lastTotal).toBe(expectedTotal);
  });
});

describe("reviewGameWithEngine pass 2 ply selection", () => {
  it("re-searches deduplicated before/after indexes for capped criticals", async () => {
    const game = parsePgn(coreFixture("classification-coverage.pgn"));
    const port = createMockPort(game);

    await reviewGameWithEngine(port, {
      game,
      nodesPerPosition: nodesForPreset("fast"),
    });

    const searchedFens = new Set(port.analyzePositionCalls.map((c) => c.fen));
    expect(searchedFens.size).toBe(port.analyzePositionCalls.length);
    expect(port.analyzePositionCalls.length).toBeLessThanOrEqual(
      (game.moves.length + 1) * 2,
    );
    expect(port.analyzePositionCalls.length).toBeGreaterThan(0);
  });
});
