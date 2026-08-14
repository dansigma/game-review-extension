import { aggregateAccuracy, moveAccuracy } from "./accuracy.ts";
import { classificationLabel, classifyMove } from "./classify.ts";
import {
  ALGO_VERSION,
  type EngineLine,
  type EvalGraphPoint,
  type GameReview,
  type PlayerAccuracy,
  type PlayerColor,
  type PositionEval,
  type ReviewedMove,
  type ReviewEngineInput,
} from "./types.ts";
import { expectedPointsLost, playerWinPercent, whiteWinPercent } from "./winPercent.ts";

export class ReviewEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewEngineError";
  }
}

function sideToMoveFromFen(fen: string): PlayerColor {
  const parts = fen.split(" ");
  const stm = parts[1];
  if (stm === "w") {
    return "white";
  }
  if (stm === "b") {
    return "black";
  }
  throw new ReviewEngineError(`Cannot read side to move from FEN: ${fen}`);
}

function bestLine(position: PositionEval): EngineLine {
  const sorted = [...position.lines].sort((a, b) => a.multipv - b.multipv);
  const line = sorted[0];
  if (!line || line.pv.length === 0) {
    throw new ReviewEngineError(`Missing MultiPV line for ply ${position.ply}`);
  }
  return line;
}

function secondLine(position: PositionEval): EngineLine | undefined {
  const sorted = [...position.lines].sort((a, b) => a.multipv - b.multipv);
  return sorted[1];
}

function normalizeUci(uci: string): string {
  return uci.trim().toLowerCase();
}

function playerAccuracy(
  color: PlayerColor,
  moves: readonly ReviewedMove[],
): PlayerAccuracy {
  const ofColor = moves.filter((move) => move.color === color);
  const counted = ofColor
    .filter((move) => move.accuracy !== null)
    .map((move) => move.accuracy as number);
  return {
    color,
    movesCounted: counted.length,
    movesExcludedForced: ofColor.length - counted.length,
    accuracy: aggregateAccuracy(counted),
  };
}

/**
 * ReviewEngine: NormalizedGame + UCI evals (MultiPV=2, one eval per position
 * including the position after the last move) → GameReview.
 *
 * Played-move quality uses the next position's PV1 (flipped), not only MultiPV
 * matching, so off-book moves still get a real EPL.
 */
export function reviewGame(input: ReviewEngineInput): GameReview {
  const { game, evals, engineId, nodesPerPosition } = input;

  if (game.variant !== "standard") {
    throw new ReviewEngineError("Only standard chess is supported in the MVP");
  }
  if (evals.length !== game.moves.length + 1) {
    throw new ReviewEngineError(
      `Expected ${game.moves.length + 1} position evals (one after the last move), got ${evals.length}`,
    );
  }

  const reviewed: ReviewedMove[] = [];
  const graph: EvalGraphPoint[] = [];

  const start = evals[0];
  if (!start) {
    throw new ReviewEngineError("Missing eval for the starting position");
  }
  graph.push({
    ply: -1,
    whiteWinPercent: whiteWinPercent(
      bestLine(start).score,
      sideToMoveFromFen(start.fen),
    ),
  });

  for (let i = 0; i < game.moves.length; i += 1) {
    const move = game.moves[i];
    const before = evals[i];
    const after = evals[i + 1];
    if (!move || !before || !after) {
      throw new ReviewEngineError(`Missing eval around ply ${i}`);
    }

    const pv1 = bestLine(before);
    const pv2 = secondLine(before);
    const playedIsBest = normalizeUci(pv1.pv[0] ?? "") === normalizeUci(move.uci);
    const playerWinBefore = playerWinPercent(pv1.score);
    const afterStm = sideToMoveFromFen(after.fen);
    const afterBest = bestLine(after);
    const playerWinAfter = 100 - playerWinPercent(afterBest.score);
    const epl = expectedPointsLost(playerWinBefore, playerWinAfter);
    const classification = classifyMove({
      epl,
      playedIsBest,
      playerWinPercentBefore: playerWinBefore,
    });
    const accuracy =
      classification === "forced" ? null : moveAccuracy(epl);

    reviewed.push({
      ply: move.ply,
      san: move.san,
      uci: move.uci,
      color: move.color,
      classification,
      classificationLabel: classificationLabel(classification),
      epl,
      accuracy,
      playerWinPercentBefore: playerWinBefore,
      playerWinPercentAfter: playerWinAfter,
      whiteWinPercentAfter: whiteWinPercent(afterBest.score, afterStm),
      bestUci: pv1.pv[0] ?? move.uci,
      playedIsBest,
      alternativeUci: pv2?.pv[0],
    });

    graph.push({
      ply: move.ply,
      whiteWinPercent: whiteWinPercent(afterBest.score, afterStm),
    });
  }

  return {
    gameId: game.gameId,
    algoVersion: ALGO_VERSION,
    engineId,
    nodesPerPosition,
    white: playerAccuracy("white", reviewed),
    black: playerAccuracy("black", reviewed),
    moves: reviewed,
    graph,
  };
}
