import {
  ALGO_VERSION,
  type CommentIntent,
  type CommentSlice,
  type MoveClass,
  type PlayerColor,
  type SuggestedLength,
} from "@game-review/core";

/** Keys that must never reach the Worker — reject with 400. */
export const LEAKY_SLICE_KEYS = [
  "uci",
  "bestUci",
  "alternativeUci",
  "fen",
  "lines",
  "score",
  "pv",
] as const;

const MOVE_CLASSES: readonly MoveClass[] = [
  "brilliant",
  "great",
  "best",
  "opening",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
  "forced",
];

const PLAYER_COLORS: readonly PlayerColor[] = ["white", "black"];

const COMMENT_INTENTS: readonly CommentIntent[] = [
  "blunder_explanation",
  "what_was_missed",
  "why_this_move",
  "neutral",
];

const SUGGESTED_LENGTHS: readonly SuggestedLength[] = ["brief", "standard"];

const REQUIRED_KEYS: readonly (keyof CommentSlice)[] = [
  "gameId",
  "algoVersion",
  "ply",
  "san",
  "color",
  "classification",
  "commentIntent",
  "winPercentDelta",
  "suggestedLength",
  "epl",
  "accuracy",
  "playerWinPercentBefore",
  "playerWinPercentAfter",
  "playedIsBest",
  "onlyMove",
  "evalAfter",
];

const OPTIONAL_KEYS: readonly (keyof CommentSlice)[] = [
  "evalBefore",
  "bestSan",
  "engineLine",
  "replyLine",
  "fenAfter",
];

const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);

/** Per-field length caps for the comment slice (see SIG-701). */
const FIELD_CAPS: Record<string, number> = {
  san: 12,
  bestSan: 12,
  gameId: 64,
  evalAfter: 16,
  evalBefore: 16,
  engineLine: 120,
  replyLine: 120,
  fenAfter: 100,
};

const WIN_PERCENT_MIN = 0;
const WIN_PERCENT_MAX = 100;

export type ParseCommentSliceResult =
  | { ok: true; slice: CommentSlice }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isMoveClass(value: unknown): value is MoveClass {
  return isString(value) && MOVE_CLASSES.includes(value as MoveClass);
}

function isPlayerColor(value: unknown): value is PlayerColor {
  return isString(value) && PLAYER_COLORS.includes(value as PlayerColor);
}

function isAccuracy(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isCommentIntent(value: unknown): value is CommentIntent {
  return isString(value) && COMMENT_INTENTS.includes(value as CommentIntent);
}

function isSuggestedLength(value: unknown): value is SuggestedLength {
  return isString(value) && SUGGESTED_LENGTHS.includes(value as SuggestedLength);
}

export function parseCommentSlice(body: unknown): ParseCommentSliceResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Corpo JSON inválido." };
  }

  for (const leaky of LEAKY_SLICE_KEYS) {
    if (leaky in body) {
      return {
        ok: false,
        error: `Campo proibido: ${leaky}.`,
      };
    }
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Campo desconhecido: ${key}.` };
    }
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in body)) {
      return { ok: false, error: `Campo obrigatório ausente: ${key}.` };
    }
  }

  const {
    gameId,
    algoVersion,
    ply,
    san,
    color,
    classification,
    commentIntent,
    winPercentDelta,
    suggestedLength,
    epl,
    accuracy,
    playerWinPercentBefore,
    playerWinPercentAfter,
    playedIsBest,
    onlyMove,
    evalAfter,
    evalBefore,
    bestSan,
    engineLine,
    replyLine,
    fenAfter,
  } = body;

  if (!isString(gameId) || gameId.length === 0) {
    return { ok: false, error: "gameId inválido." };
  }
  if (gameId.length > FIELD_CAPS.gameId!) {
    return { ok: false, error: "Campo acima do limite: gameId." };
  }
  if (algoVersion !== ALGO_VERSION) {
    return { ok: false, error: "algoVersion inválido." };
  }
  if (!isNumber(ply) || ply < 0 || !Number.isInteger(ply)) {
    return { ok: false, error: "ply inválido." };
  }
  if (!isString(san) || san.length === 0) {
    return { ok: false, error: "san inválido." };
  }
  if (san.length > FIELD_CAPS.san!) {
    return { ok: false, error: "Campo acima do limite: san." };
  }
  if (!isPlayerColor(color)) {
    return { ok: false, error: "color inválido." };
  }
  if (!isMoveClass(classification)) {
    return { ok: false, error: "classification inválida." };
  }
  if (!isCommentIntent(commentIntent)) {
    return { ok: false, error: "commentIntent inválido." };
  }
  if (!isNumber(winPercentDelta)) {
    return { ok: false, error: "winPercentDelta inválido." };
  }
  if (!isSuggestedLength(suggestedLength)) {
    return { ok: false, error: "suggestedLength inválido." };
  }
  if (!isNumber(epl) || epl < 0) {
    return { ok: false, error: "epl inválido." };
  }
  if (
    !isAccuracy(accuracy) ||
    (accuracy !== null && (accuracy < 0 || accuracy > 100))
  ) {
    return { ok: false, error: "accuracy inválida." };
  }
  if (
    !isNumber(playerWinPercentBefore) ||
    playerWinPercentBefore < WIN_PERCENT_MIN ||
    playerWinPercentBefore > WIN_PERCENT_MAX
  ) {
    return { ok: false, error: "playerWinPercentBefore inválido." };
  }
  if (
    !isNumber(playerWinPercentAfter) ||
    playerWinPercentAfter < WIN_PERCENT_MIN ||
    playerWinPercentAfter > WIN_PERCENT_MAX
  ) {
    return { ok: false, error: "playerWinPercentAfter inválido." };
  }
  if (!isBoolean(playedIsBest)) {
    return { ok: false, error: "playedIsBest inválido." };
  }
  if (!isBoolean(onlyMove)) {
    return { ok: false, error: "onlyMove inválido." };
  }
  if (!isString(evalAfter) || evalAfter.length === 0) {
    return { ok: false, error: "evalAfter inválido." };
  }
  if (evalAfter.length > FIELD_CAPS.evalAfter!) {
    return { ok: false, error: "Campo acima do limite: evalAfter." };
  }
  if (
    evalBefore !== undefined &&
    (!isString(evalBefore) || evalBefore.length > FIELD_CAPS.evalBefore!)
  ) {
    return { ok: false, error: "evalBefore inválido." };
  }
  if (
    bestSan !== undefined &&
    (!isString(bestSan) || bestSan.length > FIELD_CAPS.bestSan!)
  ) {
    return { ok: false, error: "bestSan inválido." };
  }
  if (engineLine !== undefined && !isString(engineLine)) {
    return { ok: false, error: "engineLine inválido." };
  }
  if (engineLine !== undefined && engineLine.length > FIELD_CAPS.engineLine!) {
    return { ok: false, error: "Campo acima do limite: engineLine." };
  }
  if (replyLine !== undefined && !isString(replyLine)) {
    return { ok: false, error: "replyLine inválido." };
  }
  if (replyLine !== undefined && replyLine.length > FIELD_CAPS.replyLine!) {
    return { ok: false, error: "Campo acima do limite: replyLine." };
  }
  if (
    fenAfter !== undefined &&
    (!isString(fenAfter) || !fenAfter.includes("/"))
  ) {
    return { ok: false, error: "fenAfter inválido." };
  }
  if (fenAfter !== undefined && fenAfter.length > FIELD_CAPS.fenAfter!) {
    return { ok: false, error: "Campo acima do limite: fenAfter." };
  }

  const slice: CommentSlice = {
    gameId,
    algoVersion,
    ply,
    san,
    color,
    classification,
    commentIntent,
    winPercentDelta,
    suggestedLength,
    epl,
    accuracy,
    playerWinPercentBefore,
    playerWinPercentAfter,
    playedIsBest,
    onlyMove,
    evalAfter,
    ...(evalBefore !== undefined ? { evalBefore } : {}),
    ...(bestSan !== undefined ? { bestSan } : {}),
    ...(engineLine !== undefined ? { engineLine } : {}),
    ...(replyLine !== undefined ? { replyLine } : {}),
    ...(fenAfter !== undefined ? { fenAfter } : {}),
  };

  return { ok: true, slice };
}
