import { buildCommentBoardFacts } from "./commentBoardFacts.ts";
import type { CommentSlice } from "./commentSlice.ts";
import { MOVE_CLASS_LABEL_PT } from "./types.ts";

function secondSentence(slice: CommentSlice): string {
  if (slice.bestSan !== undefined && !slice.playedIsBest) {
    return `O melhor lance era ${slice.bestSan}.`;
  }

  const facts = buildCommentBoardFacts({
    classification: slice.classification,
    evalBefore: slice.evalBefore,
    evalAfter: slice.evalAfter,
    playerWinPercentBefore: slice.playerWinPercentBefore,
    playerWinPercentAfter: slice.playerWinPercentAfter,
    ...(slice.fenAfter !== undefined ? { fenAfter: slice.fenAfter } : {}),
    ...(slice.replyLine !== undefined ? { replyLine: slice.replyLine } : {}),
    ...(slice.engineLine !== undefined ? { engineLine: slice.engineLine } : {}),
  });

  if (facts.ideiaMelhor !== undefined && facts.ideiaMelhor.trim().length > 0) {
    const firstIdea = facts.ideiaMelhor.split(";")[0]?.trim();
    if (firstIdea) {
      return `${firstIdea}.`;
    }
  }

  if (slice.evalBefore !== undefined) {
    return `A avaliação passou de ${slice.evalBefore} para ${slice.evalAfter}.`;
  }

  return `A avaliação após o lance é ${slice.evalAfter}.`;
}

/**
 * Deterministic Portuguese comment when the LLM proxy is unavailable.
 * Two short sentences — never includes UCI or FEN.
 */
export function buildFallbackComment(slice: CommentSlice): string {
  const classLabel = MOVE_CLASS_LABEL_PT[slice.classification];
  const first = `${classLabel}. Você jogou ${slice.san}.`;
  const second = secondSentence(slice);
  return `${first} ${second}`;
}
