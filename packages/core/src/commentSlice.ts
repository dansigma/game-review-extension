import {
  formatMoveEvalAfter,
  formatMoveEvalBefore,
} from "./evalDisplay.ts";
import { isOnlyMove } from "./onlyMove.ts";
import type {
  AlgoVersion,
  GameReview,
  MoveClass,
  PlayerColor,
} from "./types.ts";

export type CommentIntent =
  | "blunder_explanation"
  | "what_was_missed"
  | "why_this_move"
  | "neutral";

export type SuggestedLength = "brief" | "standard";

export function commentIntentForMove(classification: MoveClass): CommentIntent {
  switch (classification) {
    case "blunder":
      return "blunder_explanation";
    case "mistake":
    case "miss":
    case "inaccuracy":
      return "what_was_missed";
    case "brilliant":
    case "great":
    case "best":
      return "why_this_move";
    case "opening":
    case "forced":
      return "neutral";
  }
}

export function suggestedLengthForIntent(intent: CommentIntent): SuggestedLength {
  switch (intent) {
    case "blunder_explanation":
    case "what_was_missed":
      return "standard";
    case "why_this_move":
    case "neutral":
      return "brief";
  }
}

export interface CommentSlice {
  gameId: string;
  algoVersion: AlgoVersion;
  ply: number;
  san: string;
  color: PlayerColor;
  classification: MoveClass;
  commentIntent: CommentIntent;
  winPercentDelta: number;
  suggestedLength: SuggestedLength;
  epl: number;
  accuracy: number | null;
  playerWinPercentBefore: number;
  playerWinPercentAfter: number;
  playedIsBest: boolean;
  bestSan?: string;
  /** Space-separated SAN plies of engine PV1; never UCI. */
  engineLine?: string;
  /** Opponent's best reply after the played move, SAN only (never UCI). */
  replyLine?: string;
  /** FEN after the played move so the comment model can see the board. Never a field named `fen`. */
  fenAfter?: string;
  onlyMove: boolean;
  evalAfter: string;
  evalBefore?: string;
}

export const REPLY_LINE_SAN_MAX = 3;

function capReplyLine(line: string): string {
  return line.split(/\s+/).filter(Boolean).slice(0, REPLY_LINE_SAN_MAX).join(" ");
}

function replyLineForMove(review: GameReview, ply: number): string | undefined {
  const move = review.moves.find((entry) => entry.ply === ply);
  if (move?.replyLineSan !== undefined) {
    return capReplyLine(move.replyLineSan);
  }

  const next = review.moves.find((entry) => entry.ply === ply + 1);
  if (next?.bestLineSan !== undefined) {
    return capReplyLine(next.bestLineSan);
  }
  if (next?.bestSan !== undefined) {
    return next.bestSan;
  }
  return undefined;
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

  const evalAfter = formatMoveEvalAfter(move);
  const evalBefore = formatMoveEvalBefore(move);
  const replyLine = replyLineForMove(review, ply);
  const commentIntent = commentIntentForMove(move.classification);
  const winPercentDelta =
    move.playerWinPercentAfter - move.playerWinPercentBefore;

  return {
    gameId: review.gameId,
    algoVersion: review.algoVersion,
    ply: move.ply,
    san: move.san,
    color: move.color,
    classification: move.classification,
    commentIntent,
    winPercentDelta,
    suggestedLength: suggestedLengthForIntent(commentIntent),
    epl: move.epl,
    accuracy: move.accuracy,
    playerWinPercentBefore: move.playerWinPercentBefore,
    playerWinPercentAfter: move.playerWinPercentAfter,
    playedIsBest: move.playedIsBest,
    bestSan: move.bestSan,
    ...(move.bestLineSan !== undefined ? { engineLine: move.bestLineSan } : {}),
    ...(replyLine !== undefined ? { replyLine } : {}),
    ...(move.fenAfter !== undefined ? { fenAfter: move.fenAfter } : {}),
    onlyMove: isOnlyMove(move),
    evalAfter,
    evalBefore: evalBefore !== evalAfter ? evalBefore : undefined,
  };
}
