import {
  MOVE_CLASS_LABEL_PT,
  type GameSummaryMoment,
  type GameSummarySlice,
  type JudgementCounts,
  type PlayerColor,
} from "@game-review/core";
import { SHARED_BASE } from "./buildPrompt.ts";

const SUMMARY_SYSTEM =
  SHARED_BASE +
  "\n\nSua tarefa agora é escrever um resumo curto da PARTIDA inteira em 3 a 5 frases. " +
  "Conte o que aconteceu de forma simples: resultado, quem jogou melhor ou pior, e os momentos mais importantes. " +
  "Não use markdown nem UCI. Não cite casas do tabuleiro em notação de coordenadas. " +
  "Nunca copie porcentagens de chance de vitória, EPL ou avaliações numéricas na resposta — " +
  "use só o tamanho relativo dos erros para decidir o tom.";

function colorLabel(color: PlayerColor): string {
  return color === "white" ? "Brancas" : "Pretas";
}

function formatResult(result: GameSummarySlice["result"]): string {
  switch (result) {
    case "1-0":
      return "1-0 (vitória das brancas)";
    case "0-1":
      return "0-1 (vitória das pretas)";
    case "1/2-1/2":
      return "Empate";
    default:
      return result;
  }
}

function formatJudgementLine(color: PlayerColor, counts: JudgementCounts): string {
  const parts = [
    `brilliant ${counts.brilliant}`,
    `great ${counts.great}`,
    `best ${counts.best}`,
    `imprecisão ${counts.inaccuracy}`,
    `erro ${counts.mistake}`,
    `miss ${counts.miss}`,
    `blunder ${counts.blunder}`,
  ];
  return `${colorLabel(color)}: ${parts.join(", ")}`;
}

function formatMoment(moment: GameSummaryMoment): string {
  const moveNum = Math.floor(moment.ply / 2) + 1;
  const moveRef =
    moment.color === "white"
      ? `${moveNum}. ${moment.san}`
      : `${moveNum}... ${moment.san}`;
  return (
    `${moveRef} (${colorLabel(moment.color)}) — ${MOVE_CLASS_LABEL_PT[moment.classification]}; ` +
    `balanço de chance (só para você): ${moment.winPercentSwing.toFixed(1)} pp`
  );
}

export function buildSummaryPrompt(slice: GameSummarySlice): {
  system: string;
  user: string;
} {
  const lines: string[] = [
    `Resultado: ${formatResult(slice.result)}`,
    `Precisão (só para você): brancas ${slice.whiteAccuracy.toFixed(1)}%, pretas ${slice.blackAccuracy.toFixed(1)}%`,
    formatJudgementLine("white", slice.judgements.white),
    formatJudgementLine("black", slice.judgements.black),
  ];

  if (slice.moments.length === 0) {
    lines.push("Momentos críticos: nenhum lance grave se destacou.");
  } else {
    lines.push("Momentos críticos (ordem de importância):");
    for (const moment of slice.moments) {
      lines.push(`- ${formatMoment(moment)}`);
    }
  }

  lines.push(
    "Escreva o resumo da partida em 3 a 5 frases curtas, em português do Brasil, " +
      "como um treinador falando com uma criança de uns 10 anos.",
  );

  return {
    system: SUMMARY_SYSTEM,
    user: lines.join("\n"),
  };
}
