import type { MoveClass } from "./types.ts";

const CLASSIFICATION_GLYPH: Record<MoveClass, string> = {
  best: "!!",
  good: "!",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
  forced: "",
};

export function classificationGlyph(classification: MoveClass): string {
  return CLASSIFICATION_GLYPH[classification];
}

export function formatSanWithGlyph(
  san: string,
  classification: MoveClass,
): string {
  return san + classificationGlyph(classification);
}

export interface JudgementCommentArgs {
  classification: MoveClass;
  bestSan?: string;
  playedIsBest: boolean;
}

export function judgementComment(args: JudgementCommentArgs): string {
  const { classification, bestSan, playedIsBest } = args;

  switch (classification) {
    case "best":
      return "Melhor lance.";
    case "good":
      return "Bom lance.";
    case "inaccuracy":
      if (bestSan && !playedIsBest) {
        return `Imprecisão. Melhor era ${bestSan}.`;
      }
      return "Imprecisão.";
    case "mistake":
      return bestSan ? `Erro. Melhor era ${bestSan}.` : "Erro.";
    case "blunder":
      return bestSan ? `Blunder. Melhor era ${bestSan}.` : "Blunder.";
    case "forced":
      return "Lance forçado.";
  }
}
