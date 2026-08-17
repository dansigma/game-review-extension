import { MOVE_CLASS_LABEL_PT, type CommentSlice } from "@game-review/core";

const SYSTEM_PROMPT =
  "Você é um treinador de xadrez. Responda em português do Brasil, em 2–4 frases curtas. " +
  "Comente o lance do jogador usando apenas os dados fornecidos (SAN, classificação, avaliação, linha do motor em SAN). " +
  "Não invente variantes nem notação UCI. Não use markdown.";

function colorLabel(color: CommentSlice["color"]): string {
  return color === "white" ? "Brancas" : "Pretas";
}

function classificationLabel(classification: CommentSlice["classification"]): string {
  return MOVE_CLASS_LABEL_PT[classification];
}

export function buildPrompt(slice: CommentSlice): { system: string; user: string } {
  const moveRef =
    slice.color === "white"
      ? `${Math.floor(slice.ply / 2) + 1}. ${slice.san}`
      : `${Math.floor(slice.ply / 2) + 1}... ${slice.san}`;

  const evalLabel =
    slice.evalBefore !== undefined
      ? `${slice.evalBefore} → ${slice.evalAfter}`
      : slice.evalAfter;

  const accuracyLabel =
    slice.accuracy === null ? "—" : `${slice.accuracy.toFixed(1)}%`;

  const lines: string[] = [
    `Lance: ${moveRef} (${colorLabel(slice.color)})`,
    `Classificação: ${classificationLabel(slice.classification)}`,
    `Win% jogador: ${slice.playerWinPercentBefore.toFixed(1)}% → ${slice.playerWinPercentAfter.toFixed(1)}%`,
    `Avaliação: ${evalLabel}`,
    `Precisão do lance: ${accuracyLabel}`,
    `Melhor lance? ${slice.playedIsBest ? "sim" : "não"}`,
    `Lance único? ${slice.onlyMove ? "sim" : "não"}`,
  ];

  if (slice.bestSan !== undefined) {
    lines.push(`Melhor SAN sugerido: ${slice.bestSan}`);
  }
  if (slice.engineLine !== undefined) {
    lines.push(`Linha do motor (SAN): ${slice.engineLine}`);
  }

  return {
    system: SYSTEM_PROMPT,
    user: lines.join("\n"),
  };
}

export function buildPromptText(slice: CommentSlice): string {
  const { system, user } = buildPrompt(slice);
  return `${system}\n\n${user}`;
}
