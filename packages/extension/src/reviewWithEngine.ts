import {
  reviewGame,
  selectCriticalMoments,
  type GameReview,
  type NormalizedGame,
} from "@game-review/core";
import { MVP_ENGINE_ID, MVP_NODES_PER_POSITION } from "./budgetDecision.ts";
import {
  ANALYSIS_PROGRESS_NODE_SCALE,
  nodeWeightedUnits,
} from "./analysisProgressUnits.ts";
import type { EnginePort } from "./enginePort.ts";
import { pass2EvalIndexes } from "./pass2EvalIndexes.ts";
import { pass2NodesFor } from "./pass2Nodes.ts";

export interface ReviewWithEngineArgs {
  game: NormalizedGame;
  nodesPerPosition?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export async function reviewGameWithEngine(
  engine: EnginePort,
  args: ReviewWithEngineArgs,
): Promise<GameReview> {
  const pass1Nodes = args.nodesPerPosition ?? MVP_NODES_PER_POSITION;
  const pass2Nodes = pass2NodesFor(pass1Nodes);
  const nPass1 = args.game.moves.length + 1;
  const pass1Unit = pass1Nodes / ANALYSIS_PROGRESS_NODE_SCALE;

  let progressTotal = nodeWeightedUnits(pass1Nodes, nPass1);
  let pass1UnitsDone = 0;
  let pass2UnitsDone = 0;

  const reportProgress = (): void => {
    const done = Math.round(pass1UnitsDone + pass2UnitsDone);
    const total = Math.round(progressTotal);
    args.onProgress?.(done, total);
  };

  const evals = await engine.analyzeGame({
    game: args.game,
    nodesPerPosition: pass1Nodes,
    signal: args.signal,
    onProgress: (done, _total) => {
      pass1UnitsDone = done * pass1Unit;
      reportProgress();
    },
  });

  let review = reviewGame({
    game: args.game,
    evals,
    engineId: MVP_ENGINE_ID,
    nodesPerPosition: pass1Nodes,
  });

  if (pass2Nodes === null) {
    return review;
  }

  const criticalMoments = selectCriticalMoments(review.moves);
  if (criticalMoments.length === 0) {
    return review;
  }

  const pass2Indexes = pass2EvalIndexes(criticalMoments);
  const pass2Unit = pass2Nodes / ANALYSIS_PROGRESS_NODE_SCALE;
  progressTotal =
    nodeWeightedUnits(pass1Nodes, nPass1) +
    nodeWeightedUnits(pass2Nodes, pass2Indexes.length);
  reportProgress();

  for (const index of pass2Indexes) {
    if (args.signal?.aborted) {
      throw abortError(args.signal);
    }
    const existing = evals[index];
    if (!existing) {
      continue;
    }
    const updated = await engine.analyzePosition({
      fen: existing.fen,
      go: `nodes ${pass2Nodes}`,
      signal: args.signal,
    });
    evals[index] = { ...updated, ply: index };
    pass2UnitsDone += pass2Unit;
    reportProgress();
  }

  return reviewGame({
    game: args.game,
    evals,
    engineId: MVP_ENGINE_ID,
    nodesPerPosition: pass1Nodes,
  });
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }
  return new DOMException("Aborted", "AbortError");
}
