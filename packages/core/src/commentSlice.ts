import { isOnlyMove } from "./onlyMove.ts";
import type {
  AlgoVersion,
  GameReview,
  MoveClass,
  PlayerColor,
} from "./types.ts";

export interface CommentSlice {
  gameId: string;
  algoVersion: AlgoVersion;
  ply: number;
  san: string;
  color: PlayerColor;
  classification: MoveClass;
  epl: number;
  accuracy: number | null;
  playerWinPercentBefore: number;
  playerWinPercentAfter: number;
  playedIsBest: boolean;
  bestSan?: string;
  onlyMove: boolean;
}

export function buildCommentSlice(
  review: GameReview,
  ply: number,
): CommentSlice | null {
  if (ply < 0) {
    return null;
  }

  const move = review.moves.find((entry) => entry.ply === ply);
  if (!move) {
    return null;
  }

  return {
    gameId: review.gameId,
    algoVersion: review.algoVersion,
    ply: move.ply,
    san: move.san,
    color: move.color,
    classification: move.classification,
    epl: move.epl,
    accuracy: move.accuracy,
    playerWinPercentBefore: move.playerWinPercentBefore,
    playerWinPercentAfter: move.playerWinPercentAfter,
    playedIsBest: move.playedIsBest,
    bestSan: move.bestSan,
    onlyMove: isOnlyMove(move),
  };
}
