import { Chess, SQUARES, type Color, type PieceSymbol, type Square } from "chess.js";
import { squareSee } from "./hangingCapture.ts";
import { MOVE_CLASS_LABEL_PT, type MoveClass } from "./types.ts";

const PIECE_NAME_PT: Record<PieceSymbol, string> = {
  p: "peão",
  n: "cavalo",
  b: "bispo",
  r: "torre",
  q: "dama",
  k: "rei",
};

export interface CommentBoardFactsInput {
  classification: MoveClass;
  evalBefore?: string;
  evalAfter: string;
  playerWinPercentBefore: number;
  playerWinPercentAfter: number;
  fenAfter?: string;
  replyLine?: string;
  engineLine?: string;
}

export interface CommentBoardFacts {
  gravidade?: string;
  tabuleiro?: string;
  filmeMotivo?: string;
  direitosRei?: string;
  material?: string;
  ideiaMelhor?: string;
}

const BLOCK_LABELS: Record<keyof CommentBoardFacts, string> = {
  gravidade: "Gravidade",
  tabuleiro: "Tabuleiro em português",
  filmeMotivo: "Filme do MOTIVO",
  direitosRei: "Direitos do rei",
  material: "Material em palavras",
  ideiaMelhor: "Ideia do melhor lance",
};

function defenderColorLabel(moverColor: Color): string {
  return moverColor === "w" ? "Pretas" : "Brancas";
}

function victimColorLabel(piece: PieceSymbol, moverColor: Color): string {
  const capturedIsBlack = moverColor === "w";
  if (piece === "r" || piece === "q") {
    return capturedIsBlack ? "preta" : "branca";
  }
  return capturedIsBlack ? "preto" : "branco";
}

function normalizeSanToken(token: string): string {
  return token.trim().replace(/[?!]+$/g, "");
}

function applySanMove(
  chess: Chess,
  sanToken: string,
): ReturnType<Chess["move"]> | null {
  const normalized = normalizeSanToken(sanToken);
  if (!normalized) {
    return null;
  }

  try {
    const direct = chess.move(normalized);
    if (direct) {
      return direct;
    }
  } catch {
    // fall through to verbose lookup
  }

  const verbose = chess.moves({ verbose: true });
  const match = verbose.find((candidate) => candidate.san === normalized);
  if (!match) {
    return null;
  }

  return chess.move(match);
}

function hasImmediateRecapture(chess: Chess, captureSquare: string): boolean {
  return chess.moves({ verbose: true }).some(
    (candidate) =>
      candidate.to === captureSquare &&
      (candidate.captured !== undefined || candidate.flags.includes("e")),
  );
}

function findImmediateRecapture(
  chess: Chess,
  captureSquare: string,
): ReturnType<Chess["move"]> | null {
  const recaptures = chess
    .moves({ verbose: true })
    .filter(
      (candidate) =>
        candidate.to === captureSquare &&
        (candidate.captured !== undefined || candidate.flags.includes("e")),
    )
    .sort((a, b) => {
      const victimA = a.captured ? 1 : 0;
      const victimB = b.captured ? 1 : 0;
      return victimB - victimA;
    });

  if (recaptures.length === 0) {
    return null;
  }

  const chessCopy = new Chess(chess.fen());
  return chessCopy.move(recaptures[0]!);
}

function materialOutcomeClause(
  fenBefore: string,
  move: NonNullable<ReturnType<Chess["move"]>>,
  chessAfter: Chess,
): string {
  const uci = move.from + move.to + (move.promotion ?? "");
  const see = squareSee(fenBefore, uci);
  const recapture = hasImmediateRecapture(chessAfter, move.to);
  const isGain = see !== null && see > 100;

  if (isGain && !recapture) {
    return "; peça desprotegida, ganho de material";
  }
  if (isGain && recapture) {
    return "; mesmo com recaptura, é ganho de material";
  }
  if (recapture) {
    return `; as ${defenderColorLabel(move.color)} podem recapturar em ${move.to}; troca, NÃO é ganho de material`;
  }
  return "; troca, NÃO é ganho de material";
}

function squaresFromSanToken(token: string): string[] {
  const normalized = normalizeSanToken(token);
  if (!normalized) {
    return [];
  }
  if (normalized === "O-O" || normalized === "O-O-O") {
    return [];
  }
  const matches = normalized.match(/[a-h][1-8]/g);
  return matches ?? [];
}

function collectTouchedSquares(
  fenAfter: string,
  replyLine?: string,
  engineLine?: string,
): Set<string> {
  const squares = new Set<string>();

  if (replyLine) {
    let chess: Chess;
    try {
      chess = new Chess(fenAfter);
    } catch {
      chess = new Chess();
    }
    for (const token of replyLine.trim().split(/\s+/).filter(Boolean)) {
      for (const square of squaresFromSanToken(token)) {
        squares.add(square);
      }
      const move = applySanMove(chess, token);
      if (move) {
        squares.add(move.from);
        squares.add(move.to);
      }
    }
  }

  if (engineLine) {
    for (const token of engineLine.trim().split(/\s+/).filter(Boolean)) {
      for (const square of squaresFromSanToken(token)) {
        squares.add(square);
      }
    }
  }

  return squares;
}

function pieceLabelAt(
  chess: Chess,
  square: string,
): string | undefined {
  const piece = chess.get(square as Square);
  if (!piece) {
    return undefined;
  }
  const color =
    piece.color === "w" ? "branco" : "preto";
  const name = PIECE_NAME_PT[piece.type];
  if (piece.type === "r" || piece.type === "q") {
    return `${square} ${name} ${piece.color === "w" ? "branca" : "preta"}`;
  }
  return `${square} ${name} ${color}`;
}

function describeBoardOccupancy(
  fenAfter: string,
  replyLine?: string,
  engineLine?: string,
): string | undefined {
  let chess: Chess;
  try {
    chess = new Chess(fenAfter);
  } catch {
    return undefined;
  }

  const squares = collectTouchedSquares(fenAfter, replyLine, engineLine);

  for (const square of SQUARES) {
    const piece = chess.get(square);
    if (piece?.type === "k") {
      squares.add(square);
    }
  }

  const labels: string[] = [];
  const ordered = [...squares].sort();
  for (const square of ordered) {
    const label = pieceLabelAt(chess, square);
    if (label) {
      labels.push(label);
    }
  }

  return labels.length > 0 ? labels.join(", ") : undefined;
}

function castlingDescription(fen: string): string | undefined {
  const parts = fen.split(" ");
  if (parts.length < 3) {
    return undefined;
  }
  const rights = parts[2] ?? "-";
  if (rights === "-") {
    return "sem roque";
  }

  const options: string[] = [];
  if (rights.includes("K")) {
    options.push("O-O brancas");
  }
  if (rights.includes("Q")) {
    options.push("O-O-O brancas");
  }
  if (rights.includes("k")) {
    options.push("O-O pretas");
  }
  if (rights.includes("q")) {
    options.push("O-O-O pretas");
  }
  return options.length > 0 ? options.join(", ") : "sem roque";
}

function kingSquare(chess: Chess, color: Color): string | undefined {
  for (const square of SQUARES) {
    const piece = chess.get(square);
    if (piece?.type === "k" && piece.color === color) {
      return square;
    }
  }
  return undefined;
}

function describeKingRights(
  fenAfter: string,
  replyLine?: string,
): string | undefined {
  let chessBefore: Chess;
  try {
    chessBefore = new Chess(fenAfter);
  } catch {
    return undefined;
  }

  const whiteBefore = kingSquare(chessBefore, "w");
  const blackBefore = kingSquare(chessBefore, "b");
  const castlingBefore = castlingDescription(fenAfter);

  let chessAfter = new Chess(fenAfter);
  if (replyLine) {
    for (const token of replyLine.trim().split(/\s+/).filter(Boolean)) {
      const move = applySanMove(chessAfter, token);
      if (!move) {
        break;
      }
    }
  }

  const whiteAfter = kingSquare(chessAfter, "w");
  const blackAfter = kingSquare(chessAfter, "b");
  const castlingAfter = castlingDescription(chessAfter.fen());

  const parts: string[] = [];
  if (whiteBefore) {
    parts.push(`rei branco em ${whiteBefore}`);
  }
  if (blackBefore) {
    parts.push(`rei preto em ${blackBefore}`);
  }
  if (castlingBefore !== undefined) {
    parts.push(`roque antes do MOTIVO: ${castlingBefore}`);
  }
  if (whiteAfter && whiteAfter !== whiteBefore) {
    parts.push(`rei branco foi para ${whiteAfter}`);
  }
  if (blackAfter && blackAfter !== blackBefore) {
    parts.push(`rei preto foi para ${blackAfter}`);
  }
  if (castlingAfter !== castlingBefore && castlingAfter !== undefined) {
    parts.push(`roque depois do MOTIVO: ${castlingAfter}`);
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}

function plyFilmClause(
  move: NonNullable<ReturnType<Chess["move"]>>,
  normalized: string,
  fenBefore: string,
  chessAfter: Chess,
): string {
  if (move.captured !== undefined) {
    const pieceName = PIECE_NAME_PT[move.captured];
    const colorLabel = victimColorLabel(move.captured, move.color);
    const clause = `${normalized} toma ${pieceName} ${colorLabel} em ${move.to}`;
    const recapture = findImmediateRecapture(chessAfter, move.to);
    if (recapture) {
      const recaptureSan = recapture.san;
      const see = squareSee(fenBefore, move.from + move.to + (move.promotion ?? ""));
      const isGain = see !== null && see > 100;
      if (isGain) {
        return `${clause}, ${recaptureSan} recaptura, ainda é ganho de material`;
      }
      return `${clause}, ${recaptureSan} recaptura, material igual`;
    }
    const see = squareSee(fenBefore, move.from + move.to + (move.promotion ?? ""));
    if (see !== null && see > 100) {
      return `${clause}, sem recaptura imediata`;
    }
    return clause;
  }

  if (move.flags.includes("k") || move.flags.includes("q")) {
    return `${normalized} roque`;
  }

  if (/[+#]/.test(normalized)) {
    return `${normalized} xeque`;
  }

  if (move.piece === "k") {
    const fenParts = fenBefore.split(" ");
    const rightsBefore = fenParts[2] ?? "-";
    const rightsAfter = chessAfter.fen().split(" ")[2] ?? "-";
    const colorKey = move.color === "w" ? /[KQ]/ : /[kq]/;
    if (colorKey.test(rightsBefore) && !colorKey.test(rightsAfter)) {
      return `${normalized} perde o roque`;
    }
  }

  return normalized;
}

function describeMotivoFilm(
  fenAfter: string,
  replyLine: string,
): string | undefined {
  let chess: Chess;
  try {
    chess = new Chess(fenAfter);
  } catch {
    return undefined;
  }

  const tokens = replyLine.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return undefined;
  }

  const clauses: string[] = [];
  let lastCaptureSquare: string | undefined;
  let lastCaptureHadRecaptureInLine = false;

  for (const token of tokens) {
    const normalized = normalizeSanToken(token);
    const fenBefore = chess.fen();
    const move = applySanMove(chess, token);
    if (!move) {
      break;
    }

    if (move.captured !== undefined) {
      lastCaptureSquare = move.to;
      const recapture = findImmediateRecapture(chess, move.to);
      const recaptureSan = recapture?.san;
      lastCaptureHadRecaptureInLine =
        recaptureSan !== undefined &&
        tokens.slice(tokens.indexOf(token) + 1).some(
          (later) => normalizeSanToken(later) === recaptureSan,
        );
    }

    clauses.push(plyFilmClause(move, normalized, fenBefore, chess));
  }

  if (
    lastCaptureSquare !== undefined &&
    !lastCaptureHadRecaptureInLine
  ) {
    const recapture = findImmediateRecapture(chess, lastCaptureSquare);
    if (recapture) {
      const lastClause = clauses[clauses.length - 1];
      if (lastClause && !lastClause.includes("recaptura")) {
        clauses[clauses.length - 1] = `${lastClause}, ${recapture.san} recaptura, material igual`;
      }
    }
  }

  return clauses.length > 0 ? clauses.join("; ") : undefined;
}

type MaterialLabel = "igual" | "+peão" | "+peça" | "dama de graça";

function materialLabelForCapture(
  fenBefore: string,
  move: NonNullable<ReturnType<Chess["move"]>>,
  chessAfter: Chess,
): MaterialLabel {
  const uci = move.from + move.to + (move.promotion ?? "");
  const see = squareSee(fenBefore, uci);
  const recapture = hasImmediateRecapture(chessAfter, move.to);
  const isGain = see !== null && see > 100;

  if (!isGain || recapture) {
    return "igual";
  }

  if (move.captured === "q") {
    return "dama de graça";
  }
  if (move.captured === "p") {
    return "+peão";
  }
  return "+peça";
}

function describeMaterialLabel(
  fenAfter: string,
  replyLine?: string,
): string | undefined {
  if (!replyLine) {
    return undefined;
  }

  let chess: Chess;
  try {
    chess = new Chess(fenAfter);
  } catch {
    return undefined;
  }

  let label: MaterialLabel | undefined;

  for (const token of replyLine.trim().split(/\s+/).filter(Boolean)) {
    const fenBefore = chess.fen();
    const move = applySanMove(chess, token);
    if (!move) {
      break;
    }
    if (move.captured !== undefined) {
      label = materialLabelForCapture(fenBefore, move, chess);
    }
  }

  return label;
}

function describeEngineIdea(engineLine: string): string | undefined {
  const tokens = engineLine.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return undefined;
  }

  const ideas: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeSanToken(token);
    if (normalized === "O-O" || normalized === "O-O-O") {
      ideas.push(`${normalized}: roque`);
      continue;
    }
    if (/^[NBRQK]/.test(normalized) && !normalized.includes("x")) {
      const dest = normalized.match(/[a-h][1-8]/)?.[0];
      if (dest) {
        ideas.push(`${normalized}: desenvolve para ${dest}`);
      }
      continue;
    }
    if (/^R.*x/.test(normalized)) {
      const dest = normalized.match(/[a-h][1-8]/)?.[0];
      if (dest) {
        ideas.push(`${normalized}: torre ativa na coluna ${dest[0]}`);
      }
      continue;
    }
    if (/x/.test(normalized)) {
      const dest = normalized.match(/[a-h][1-8]/)?.[0];
      if (dest) {
        ideas.push(`${normalized}: troca ou captura em ${dest}`);
      }
    }
  }

  return ideas.length > 0 ? ideas.join("; ") : undefined;
}

function buildGravidade(input: CommentBoardFactsInput): string {
  const classLabel = MOVE_CLASS_LABEL_PT[input.classification];
  const evalLabel =
    input.evalBefore !== undefined
      ? `${input.evalBefore} → ${input.evalAfter}`
      : input.evalAfter;
  const winLabel = `${input.playerWinPercentBefore.toFixed(1)}% → ${input.playerWinPercentAfter.toFixed(1)}%`;
  return (
    `${classLabel}; avaliação ${evalLabel}; win% ${winLabel}. ` +
    "Números só para tom de voz — não são a explicação do erro."
  );
}

/**
 * Decodes capture victims and check-only plies from a reply SAN line on `fenAfter`.
 * Returns Portuguese facts for the comment proxy prompt, or undefined when none apply.
 */
export function describeReplyCaptures(
  fenAfter: string,
  replyLine: string,
): string | undefined {
  let chess: Chess;
  try {
    chess = new Chess(fenAfter);
  } catch {
    return undefined;
  }

  const tokens = replyLine.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return undefined;
  }

  const facts: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeSanToken(token);
    const fenBefore = chess.fen();
    const move = applySanMove(chess, token);
    if (!move) {
      break;
    }

    if (move.captured !== undefined) {
      const pieceName = PIECE_NAME_PT[move.captured];
      const colorLabel = victimColorLabel(move.captured, move.color);
      const article = move.captured === "r" || move.captured === "q" ? "a" : "o";
      const materialClause = materialOutcomeClause(fenBefore, move, chess);
      facts.push(
        `${normalized} captura ${article} ${pieceName} ${colorLabel} em ${move.to}${materialClause}`,
      );
    } else if (/[+#]/.test(normalized)) {
      facts.push(`${normalized} dá xeque e não captura peça`);
    }
  }

  return facts.length > 0 ? facts.join("; ") : undefined;
}

export function buildCommentBoardFacts(
  input: CommentBoardFactsInput,
): CommentBoardFacts {
  const facts: CommentBoardFacts = {
    gravidade: buildGravidade(input),
  };

  if (input.fenAfter !== undefined) {
    facts.tabuleiro = describeBoardOccupancy(
      input.fenAfter,
      input.replyLine,
      input.engineLine,
    );
    facts.direitosRei = describeKingRights(input.fenAfter, input.replyLine);
    if (input.replyLine !== undefined) {
      facts.filmeMotivo = describeMotivoFilm(input.fenAfter, input.replyLine);
      facts.material = describeMaterialLabel(input.fenAfter, input.replyLine);
    }
  }

  if (input.engineLine !== undefined) {
    facts.ideiaMelhor = describeEngineIdea(input.engineLine);
  }

  return facts;
}

export function formatCommentBoardFacts(
  facts: CommentBoardFacts,
): string | undefined {
  const lines: string[] = [];

  for (const key of Object.keys(BLOCK_LABELS) as Array<keyof CommentBoardFacts>) {
    const value = facts[key];
    if (value !== undefined && value.trim().length > 0) {
      lines.push(`${BLOCK_LABELS[key]}: ${value}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}
