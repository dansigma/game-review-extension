import {
  MOVE_CLASS_LABEL_PT,
  buildCommentBoardFacts,
  formatCommentBoardFacts,
  type CommentSlice,
  type MoveClass,
} from "@game-review/core";

const SHARED_BASE =
  "Você é um treinador de xadrez para crianças de uns 10 anos. Fale em português do Brasil, " +
  "em 2 ou 3 frases curtas, como um adulto paciente no clube — nunca como um computador. " +
  "Palavras simples e diretas. Não use diminutivos (errinho, jogadinha, presentinho). " +
  "Os números são só para VOCÊ medir o tamanho da jogada; nunca os copie na resposta.\n\n" +
  "Use o cartão de fatos como fonte da verdade sobre o tabuleiro, capturas, material e roque. " +
  "Não adivinhe qual peça está numa casa a partir do SAN — o cartão já diz. " +
  "Não diga ganho de material se o cartão disser igual ou troca.";

const FAILURE_BLOCK =
  "\n\nPrimeiro o ERRO: explique por que o lance jogado é ruim usando o Filme do MOTIVO e o tabuleiro — " +
  "ameaça, material e motivo. " +
  "Nunca descreva o lance jogado como boa ideia, sacrifício interessante ou plano positivo. " +
  "Depois o LANCE MELHOR: use a Ideia do melhor lance quando existir. " +
  "Não recite a linha inteira. Não invente ideia que o cartão não sustenta. Não use markdown nem UCI.";

const POSITIVE_BLOCK =
  "\n\nExplique por que o lance jogado é forte, usando o cartão de fatos e a Ideia do melhor lance quando existir. " +
  "Não recite a linha inteira. Não invente ideia que o cartão não sustenta. Não use markdown nem UCI.";

const FAILURE_CLOSER =
  "Escreva o comentário: 1) por que o lance jogado é ruim; 2) por que o melhor lance é melhor.";

const POSITIVE_CLOSER =
  "Escreva o comentário explicando por que o lance jogado é forte e o que ele conquista no tabuleiro.";

const NEUTRAL_CLOSER =
  "Escreva o comentário em 2 ou 3 frases curtas, usando o cartão de fatos.";

const FAILURE_CLASSIFICATIONS = ["blunder", "mistake", "miss"] as const;
const POSITIVE_CLASSIFICATIONS = ["best", "great", "brilliant"] as const;

export type FailureClassification = (typeof FAILURE_CLASSIFICATIONS)[number];
export type PositiveClassification = (typeof POSITIVE_CLASSIFICATIONS)[number];

export function isFailureClassification(
  classification: MoveClass,
): classification is FailureClassification {
  return (FAILURE_CLASSIFICATIONS as readonly string[]).includes(classification);
}

export function isPositiveClassification(
  classification: MoveClass,
): classification is PositiveClassification {
  return (POSITIVE_CLASSIFICATIONS as readonly string[]).includes(classification);
}

function buildSystemPrompt(classification: MoveClass): string {
  if (isFailureClassification(classification)) {
    return SHARED_BASE + FAILURE_BLOCK;
  }
  if (isPositiveClassification(classification)) {
    return SHARED_BASE + POSITIVE_BLOCK;
  }
  return (
    SHARED_BASE +
    "\n\nNão recite a linha inteira. Não invente ideia que o cartão não sustenta. Não use markdown nem UCI."
  );
}

function buildUserCloser(classification: MoveClass): string {
  if (isFailureClassification(classification)) {
    return FAILURE_CLOSER;
  }
  if (isPositiveClassification(classification)) {
    return POSITIVE_CLOSER;
  }
  return NEUTRAL_CLOSER;
}

function colorLabel(color: CommentSlice["color"]): string {
  return color === "white" ? "Brancas" : "Pretas";
}

function classificationLabel(classification: CommentSlice["classification"]): string {
  return MOVE_CLASS_LABEL_PT[classification];
}

function moveNumber(ply: number): number {
  return Math.floor(ply / 2) + 1;
}

function playedMoveRef(slice: CommentSlice): string {
  const n = moveNumber(slice.ply);
  return slice.color === "white" ? `${n}. ${slice.san}` : `${n}... ${slice.san}`;
}

function betterMoveRef(slice: CommentSlice): string | undefined {
  if (slice.bestSan === undefined) {
    return undefined;
  }
  const n = moveNumber(slice.ply);
  return slice.color === "white" ? `${n}. ${slice.bestSan}` : `${n}... ${slice.bestSan}`;
}

export function buildPrompt(slice: CommentSlice): { system: string; user: string } {
  const lines: string[] = [
    `Lance jogado: ${playedMoveRef(slice)} (${colorLabel(slice.color)})`,
    `Julgamento: ${classificationLabel(slice.classification)}`,
    `Foi o melhor lance? ${slice.playedIsBest ? "sim" : "não"}`,
    `Lance único que segurava? ${slice.onlyMove ? "sim" : "não"}`,
  ];

  const factCard = formatCommentBoardFacts(
    buildCommentBoardFacts({
      classification: slice.classification,
      evalBefore: slice.evalBefore,
      evalAfter: slice.evalAfter,
      playerWinPercentBefore: slice.playerWinPercentBefore,
      playerWinPercentAfter: slice.playerWinPercentAfter,
      fenAfter: slice.fenAfter,
      replyLine: slice.replyLine,
      engineLine: slice.engineLine,
    }),
  );

  if (factCard !== undefined) {
    lines.push("");
    lines.push("Cartão de fatos (fonte da verdade — confie nele, não infira do SAN):");
    lines.push(factCard);
  }

  if (slice.replyLine !== undefined) {
    lines.push(`MOTIVO (resposta do adversário depois deste lance, SAN): ${slice.replyLine}`);
  }

  const better = betterMoveRef(slice);
  if (better !== undefined) {
    lines.push(`Melhor lance no lugar deste (SAN): ${better}`);
  }
  if (slice.engineLine !== undefined) {
    lines.push(`Continuação do lance melhor (SAN): ${slice.engineLine}`);
  }

  if (slice.fenAfter !== undefined) {
    lines.push(
      `FEN de backup (não é fonte da verdade; use o cartão): ${slice.fenAfter}`,
    );
  }

  lines.push(buildUserCloser(slice.classification));

  return {
    system: buildSystemPrompt(slice.classification),
    user: lines.join("\n"),
  };
}

export function buildPromptText(slice: CommentSlice): string {
  const { system, user } = buildPrompt(slice);
  return `${system}\n\n${user}`;
}
