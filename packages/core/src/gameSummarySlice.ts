import {
  countJudgements,
  selectCriticalMoments,
  type JudgementsByColor,
} from "./criticalMoments.ts";
import type {
  AlgoVersion,
  GameResult,
  GameReview,
  MoveClass,
  NormalizedGame,
  PlayerColor,
} from "./types.ts";

export interface GameSummaryMoment {
  ply: number;
  san: string;
  color: PlayerColor;
  classification: MoveClass;
  winPercentSwing: number;
}

export interface GameSummarySlice {
  gameId: string;
  algoVersion: AlgoVersion;
  result: GameResult;
  whiteAccuracy: number;
  blackAccuracy: number;
  judgements: JudgementsByColor;
  moments: GameSummaryMoment[];
}

export function buildGameSummarySlice(
  review: GameReview,
  game: NormalizedGame,
): GameSummarySlice {
  const moments = selectCriticalMoments(review.moves)
    .slice(0, 5)
    .map((moment) => ({
      ply: moment.ply,
      san: moment.san,
      color: moment.color,
      classification: moment.classification,
      winPercentSwing: moment.winPercentSwing,
    }));

  return {
    gameId: review.gameId,
    algoVersion: review.algoVersion,
    result: game.result,
    whiteAccuracy: review.white.accuracy,
    blackAccuracy: review.black.accuracy,
    judgements: countJudgements(review.moves),
    moments,
  };
}
