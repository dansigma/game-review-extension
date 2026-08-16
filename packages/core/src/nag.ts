import type { MoveClass } from "./types.ts";

const CLASSIFICATION_GLYPH: Record<MoveClass, string> = {
  brilliant: "!!",
  great: "!",
  best: "★",
  mistake: "?",
  miss: "",
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
  const { classification, bestSan } = args;

  switch (classification) {
    case "brilliant":
      return "Lance brilhante.";
    case "great":
      return "Ótimo lance.";
    case "best":
      return "Melhor lance.";
    case "mistake":
      return bestSan ? `Erro. Melhor era ${bestSan}.` : "Erro.";
    case "miss":
      return bestSan ? `Miss. Melhor era ${bestSan}.` : "Miss.";
    case "blunder":
      return bestSan ? `Blunder. Melhor era ${bestSan}.` : "Blunder.";
    case "forced":
      return "Lance forçado.";
  }
}
