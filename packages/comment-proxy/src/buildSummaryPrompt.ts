import {
  MOVE_CLASS_LABEL_PT,
  type FinalStanding,
  type GameEndReason,
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
  "use só o tamanho relativo dos erros para decidir o tom. " +
  "Se a partida acabou no tempo, a primeira frase deve dizer que o relógio decidiu o resultado. " +
  "Não descreva um empate ou vitória no tempo como se ninguém tivesse convertido a vantagem. " +
  "Se a posição final estava claramente desequilibrada, diga isso em linguagem simples, sem números de avaliação.";

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

function formatEndReason(endReason: GameEndReason): string {
  switch (endReason) {
    case "time":
      return "no tempo (relógio decidiu)";
    case "mate":
      return "xeque-mate";
    case "resign":
      return "desistência";
    case "stalemate":
      return "afogamento";
    case "agreement":
      return "acordo entre os jogadores";
    case "insufficient":
      return "material insuficiente";
    case "repetition":
      return "repetição de lances";
    case "unknown":
      return "motivo não informado";
  }
}

function formatFinalStanding(finalStanding: FinalStanding): string {
  switch (finalStanding) {
    case "white_winning":
      return "brancas claramente à frente";
    case "black_winning":
      return "pretas claramente à frente";
    case "equal":
      return "equilibrada";
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
    `Como a partida acabou: ${formatEndReason(slice.endReason)}`,
    `Posição final no tabuleiro (só para você): ${formatFinalStanding(slice.finalStanding)}`,
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

  if (slice.endReason === "time") {
    lines.push(
      "Instrução: a partida terminou no tempo. Comece o resumo dizendo que o relógio decidiu. " +
        "Não diga que ninguém converteu a vantagem se o empate ou a vitória foi por tempo.",
    );
    if (slice.finalStanding !== "equal") {
      lines.push(
        "Instrução: a posição final estava claramente desequilibrada — mencione isso em linguagem simples, sem números de avaliação.",
      );
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
