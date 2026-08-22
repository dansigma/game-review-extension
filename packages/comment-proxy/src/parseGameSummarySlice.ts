import {
  ALGO_VERSION,
  DASHBOARD_CLASSES,
  isFinalStanding,
  isGameEndReason,
  type FinalStanding,
  type GameEndReason,
  type GameResult,
  type GameSummaryMoment,
  type GameSummarySlice,
  type JudgementCounts,
  type JudgementsByColor,
  type MoveClass,
  type PlayerColor,
} from "@game-review/core";
import { LEAKY_SLICE_KEYS } from "./parseCommentSlice.ts";

const GAME_RESULTS: readonly GameResult[] = ["1-0", "0-1", "1/2-1/2", "*"];

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

const REQUIRED_KEYS: readonly (keyof GameSummarySlice)[] = [
  "gameId",
  "algoVersion",
  "result",
  "whiteAccuracy",
  "blackAccuracy",
  "judgements",
  "moments",
];

const ALLOWED_KEYS = new Set<string>([
  ...REQUIRED_KEYS,
  "endReason",
  "finalStanding",
]);

const MOMENT_SAN_MAX = 12;
const WIN_PERCENT_MIN = 0;
const WIN_PERCENT_MAX = 100;

export type ParseGameSummarySliceResult =
  | { ok: true; slice: GameSummarySlice }
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

function isGameResult(value: unknown): value is GameResult {
  return isString(value) && GAME_RESULTS.includes(value as GameResult);
}

function isPlayerColor(value: unknown): value is PlayerColor {
  return isString(value) && PLAYER_COLORS.includes(value as PlayerColor);
}

function isMoveClass(value: unknown): value is MoveClass {
  return isString(value) && MOVE_CLASSES.includes(value as MoveClass);
}

function parseJudgementCounts(value: unknown): JudgementCounts | null {
  if (!isRecord(value)) {
    return null;
  }
  const counts = {} as JudgementCounts;
  for (const key of DASHBOARD_CLASSES) {
    const count = value[key];
    if (!isNumber(count) || count < 0 || !Number.isInteger(count)) {
      return null;
    }
    counts[key] = count;
  }
  for (const key of Object.keys(value)) {
    if (!DASHBOARD_CLASSES.includes(key as keyof JudgementCounts)) {
      return null;
    }
  }
  return counts;
}

function parseJudgements(value: unknown): JudgementsByColor | null {
  if (!isRecord(value)) {
    return null;
  }
  const white = parseJudgementCounts(value.white);
  const black = parseJudgementCounts(value.black);
  if (!white || !black) {
    return null;
  }
  return { white, black };
}

function parseMoment(value: unknown): GameSummaryMoment | null {
  if (!isRecord(value)) {
    return null;
  }
  const { ply, san, color, classification, winPercentSwing } = value;
  if (!isNumber(ply) || ply < 0 || !Number.isInteger(ply)) {
    return null;
  }
  if (!isString(san) || san.length === 0) {
    return null;
  }
  if (san.length > MOMENT_SAN_MAX) {
    return null;
  }
  if (!isPlayerColor(color)) {
    return null;
  }
  if (!isMoveClass(classification)) {
    return null;
  }
  if (
    !isNumber(winPercentSwing) ||
    winPercentSwing < WIN_PERCENT_MIN ||
    winPercentSwing > WIN_PERCENT_MAX
  ) {
    return null;
  }
  return { ply, san, color, classification, winPercentSwing };
}

export function parseGameSummarySlice(body: unknown): ParseGameSummarySliceResult {
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
    result,
    endReason,
    finalStanding,
    whiteAccuracy,
    blackAccuracy,
    judgements,
    moments,
  } = body;

  if (!isString(gameId) || gameId.length === 0) {
    return { ok: false, error: "gameId inválido." };
  }
  if (algoVersion !== ALGO_VERSION) {
    return { ok: false, error: "algoVersion inválido." };
  }
  if (!isGameResult(result)) {
    return { ok: false, error: "result inválido." };
  }

  let parsedEndReason: GameEndReason = "unknown";
  if ("endReason" in body) {
    if (!isString(endReason) || !isGameEndReason(endReason)) {
      return { ok: false, error: "endReason inválido." };
    }
    parsedEndReason = endReason;
  }

  let parsedFinalStanding: FinalStanding = "equal";
  if ("finalStanding" in body) {
    if (!isString(finalStanding) || !isFinalStanding(finalStanding)) {
      return { ok: false, error: "finalStanding inválido." };
    }
    parsedFinalStanding = finalStanding;
  }

  if (!isNumber(whiteAccuracy) || whiteAccuracy < 0 || whiteAccuracy > 100) {
    return { ok: false, error: "whiteAccuracy inválido." };
  }
  if (!isNumber(blackAccuracy) || blackAccuracy < 0 || blackAccuracy > 100) {
    return { ok: false, error: "blackAccuracy inválido." };
  }

  const parsedJudgements = parseJudgements(judgements);
  if (!parsedJudgements) {
    return { ok: false, error: "judgements inválido." };
  }

  if (!Array.isArray(moments)) {
    return { ok: false, error: "moments inválido." };
  }
  if (moments.length > 5) {
    return { ok: false, error: "moments inválido." };
  }

  const parsedMoments: GameSummaryMoment[] = [];
  for (const moment of moments) {
    const parsed = parseMoment(moment);
    if (!parsed) {
      return { ok: false, error: "moments inválido." };
    }
    parsedMoments.push(parsed);
  }

  return {
    ok: true,
    slice: {
      gameId,
      algoVersion,
      result,
      endReason: parsedEndReason,
      finalStanding: parsedFinalStanding,
      whiteAccuracy,
      blackAccuracy,
      judgements: parsedJudgements,
      moments: parsedMoments,
    },
  };
}
