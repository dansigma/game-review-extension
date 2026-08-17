import { Chess } from "chess.js";
import { gameAccuracy, moveAccuracyFromWinPercents } from "./accuracy.ts";
import { classificationLabel, classifyMove, isHopeless } from "./classify.ts";
import { meetsOnlyMoveGap } from "./onlyMove.ts";
import { isTrivialRecapture } from "./recapture.ts";
import { isSacrifice } from "./sacrifice.ts";
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
import { whiteScore } from "./evalDisplay.ts";
import { uciPvToSan } from "./pvSan.ts";
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

function startColorFromFen(fen: string): PlayerColor {
  return sideToMoveFromFen(fen);
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

function uciToSan(fen: string, uci: string): string | undefined {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion });
    return move?.san;
  } catch {
    return undefined;
  }
}

function playerAccuracy(
  color: PlayerColor,
  moves: readonly ReviewedMove[],
  gameAccuracyResult: ReturnType<typeof gameAccuracy>,
): PlayerAccuracy {
  const ofColor = moves.filter((move) => move.color === color);
  const forcedCount = ofColor.filter(
    (move) => move.classification === "forced",
  ).length;
  return {
    color,
    movesCounted: ofColor.length,
    movesExcludedForced: forcedCount,
    accuracy:
      color === "white" ? gameAccuracyResult.white : gameAccuracyResult.black,
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
  const startStm = sideToMoveFromFen(start.fen);
  const startBest = bestLine(start);
  graph.push({
    ply: -1,
    whiteWinPercent: whiteWinPercent(startBest.score, startStm),
    whiteScore: whiteScore(startBest.score, startStm),
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
    const beforeStm = sideToMoveFromFen(before.fen);
    const playedIsBest = normalizeUci(pv1.pv[0] ?? "") === normalizeUci(move.uci);
    const playerWinBefore = playerWinPercent(pv1.score);
    const afterStm = sideToMoveFromFen(after.fen);
    const afterBest = bestLine(after);
    const playerWinAfter = 100 - playerWinPercent(afterBest.score);
    const epl = expectedPointsLost(playerWinBefore, playerWinAfter);
    const alternativePlayerWinPercent = pv2
      ? playerWinPercent(pv2.score)
      : undefined;
    const prevGameMove = i > 0 ? game.moves[i - 1] : undefined;
    const trivialRecapture =
      prevGameMove !== undefined &&
      isTrivialRecapture(
        { fenBefore: prevGameMove.fenBefore, uci: prevGameMove.uci },
        { fenBefore: move.fenBefore, uci: move.uci },
        pv2?.pv[0],
      );
    const onlyMove =
      meetsOnlyMoveGap(playerWinBefore, alternativePlayerWinPercent) &&
      !trivialRecapture &&
      !isHopeless(playerWinBefore);
    const previous = reviewed[i - 1];
    const previousOpponentEpl =
      previous && previous.color !== move.color ? previous.epl : undefined;
    const classification = classifyMove({
      epl,
      playedIsBest,
      playerWinPercentBefore: playerWinBefore,
      playerWinPercentAfter: playerWinAfter,
      isOnlyMove: onlyMove,
      isSacrifice: isSacrifice(move.fenBefore, move.uci),
      previousOpponentEpl,
    });
    const accuracy = moveAccuracyFromWinPercents(
      playerWinBefore,
      playerWinAfter,
    );

    const bestUci = pv1.pv[0] ?? move.uci;
    const bestSan = uciToSan(move.fenBefore, bestUci);
    const bestLineSan = uciPvToSan(move.fenBefore, pv1.pv);

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
      whiteScoreAfter: whiteScore(afterBest.score, afterStm),
      whiteScoreBefore: whiteScore(pv1.score, beforeStm),
      bestUci,
      ...(bestSan !== undefined ? { bestSan } : {}),
      ...(bestLineSan !== undefined ? { bestLineSan } : {}),
      playedIsBest,
      alternativeUci: pv2?.pv[0],
      alternativePlayerWinPercent,
      onlyMove,
    });

    graph.push({
      ply: move.ply,
      whiteWinPercent: whiteWinPercent(afterBest.score, afterStm),
      whiteScore: whiteScore(afterBest.score, afterStm),
    });
  }

  const startColor = startColorFromFen(game.initialFen);
  const allWhiteWinPercents = graph.map((point) => point.whiteWinPercent);
  const accuracyByColor = gameAccuracy(allWhiteWinPercents, startColor);

  return {
    gameId: game.gameId,
    algoVersion: ALGO_VERSION,
    engineId,
    nodesPerPosition,
    white: playerAccuracy("white", reviewed, accuracyByColor),
    black: playerAccuracy("black", reviewed, accuracyByColor),
    moves: reviewed,
    graph,
  };
}
