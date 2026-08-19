import type { JudgementsByColor } from "./criticalMoments.ts";
import type { FinalStanding, GameEndReason } from "./gameEndReason.ts";
import type { GameSummarySlice } from "./gameSummarySlice.ts";
import { MOVE_CLASS_LABEL_PT } from "./types.ts";
import type { GameResult, PlayerColor } from "./types.ts";

function formatResult(
  result: GameResult,
  endReason: GameEndReason,
  finalStanding: FinalStanding,
): string {
  if (endReason === "time") {
    switch (result) {
      case "1-0":
        return "As brancas venceram no tempo.";
      case "0-1":
        return "As pretas venceram no tempo.";
      case "1/2-1/2":
        if (finalStanding === "white_winning") {
          return "A partida empatou porque o tempo acabou, mesmo com as brancas claramente à frente no tabuleiro.";
        }
        if (finalStanding === "black_winning") {
          return "A partida empatou porque o tempo acabou, mesmo com as pretas claramente à frente no tabuleiro.";
        }
        return "A partida empatou porque o tempo acabou.";
      default:
        return "A partida terminou por tempo.";
    }
  }

  switch (result) {
    case "1-0":
      return "As brancas venceram a partida.";
    case "0-1":
      return "As pretas venceram a partida.";
    case "1/2-1/2":
      return "A partida terminou em empate.";
    default:
      return "A partida chegou ao fim.";
  }
}

function colorLabelPt(color: PlayerColor): string {
  return color === "white" ? "brancas" : "pretas";
}

function totalSeriousErrors(judgements: JudgementsByColor, color: PlayerColor): number {
  const counts = judgements[color];
  return counts.mistake + counts.miss + counts.blunder;
}

function judgementSummary(judgements: JudgementsByColor): string {
  const whiteErrors = totalSeriousErrors(judgements, "white");
  const blackErrors = totalSeriousErrors(judgements, "black");
  const whiteBlunders = judgements.white.blunder;
  const blackBlunders = judgements.black.blunder;

  if (whiteBlunders + blackBlunders > 0) {
    const parts: string[] = [];
    if (whiteBlunders > 0) {
      parts.push(
        whiteBlunders === 1
          ? "1 blunder nas brancas"
          : `${whiteBlunders} blunders nas brancas`,
      );
    }
    if (blackBlunders > 0) {
      parts.push(
        blackBlunders === 1
          ? "1 blunder nas pretas"
          : `${blackBlunders} blunders nas pretas`,
      );
    }
    return `Houve ${parts.join(" e ")}.`;
  }

  if (whiteErrors + blackErrors > 0) {
    return "As duas cores tiveram erros importantes em alguns momentos.";
  }

  return "Foi uma partida com poucos erros graves.";
}

function cleanSan(san: string): string {
  return san.replace(/[+#!?]+$/, "");
}

function formatMomentRef(ply: number, color: PlayerColor, san: string): string {
  const moveNum = Math.floor(ply / 2) + 1;
  const clean = cleanSan(san);
  if (color === "white") {
    return `${moveNum}. ${clean}`;
  }
  return `${moveNum}... ${clean}`;
}

/**
 * Deterministic Portuguese game summary when the LLM proxy is unavailable.
 * Three to five short sentences — never includes UCI, FEN, or eval numbers.
 */
export function buildFallbackGameSummary(slice: GameSummarySlice): string {
  const sentences: string[] = [
    formatResult(slice.result, slice.endReason, slice.finalStanding),
    `Precisão: brancas ${slice.whiteAccuracy.toFixed(1)}%, pretas ${slice.blackAccuracy.toFixed(1)}%.`,
    judgementSummary(slice.judgements),
  ];

  for (const moment of slice.moments.slice(0, 2)) {
    const classLabel = MOVE_CLASS_LABEL_PT[moment.classification];
    const moveRef = formatMomentRef(moment.ply, moment.color, moment.san);
    sentences.push(
      `Um momento marcante foi ${moveRef} (${colorLabelPt(moment.color)}), classificado como ${classLabel}.`,
    );
  }

  if (slice.moments.length === 0) {
    sentences.push("Não houve um único lance que dominou o jogo do começo ao fim.");
  }

  return sentences.slice(0, 5).join(" ");
}
