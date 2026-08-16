import { clamp } from "./winPercent.ts";
import type { PlayerColor } from "./types.ts";

/** Lichess AccuracyPercent curve (full-precision constants from lila). */
const ACC_A = 103.1668100711649;
const ACC_K = 0.04354415386753951;
const ACC_B = -3.166924740191411;
const UNCERTAINTY_BONUS = 1;

const TRIM_RATIO = 0.1;
const MIN_COUNT_FOR_TRIM = 10;

/** Per-move accuracy from player win% before/after (Lichess `fromWinPercents`). */
export function moveAccuracyFromWinPercents(
  before: number,
  after: number,
): number {
  if (after >= before) {
    return 100;
  }
  const winDiff = before - after;
  const raw = ACC_A * Math.exp(-ACC_K * winDiff) + ACC_B;
  return clamp(raw + UNCERTAINTY_BONUS, 0, 100);
}

/** Per-move accuracy from EPL (winDiff = EPL × 100 when the position worsened). */
export function moveAccuracy(epl: number): number {
  if (epl <= 0) {
    return 100;
  }
  return moveAccuracyFromWinPercents(100, 100 - epl * 100);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Population standard deviation (matches scalalib `Maths.standardDeviation`). */
export function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const m = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function weightedMean(
  pairs: readonly Readonly<[accuracy: number, weight: number]>[],
): number {
  if (pairs.length === 0) {
    return 0;
  }
  const totalWeight = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight === 0) {
    return 0;
  }
  return (
    pairs.reduce((sum, [accuracy, weight]) => sum + accuracy * weight, 0) /
    totalWeight
  );
}

export function trimmedMean(
  values: readonly number[],
  trimRatio: number = TRIM_RATIO,
): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const trim =
    values.length >= MIN_COUNT_FOR_TRIM
      ? Math.floor(values.length * trimRatio)
      : 0;
  const sliced = sorted.slice(trim, sorted.length - trim);
  return mean(sliced.length > 0 ? sliced : sorted);
}

export function harmonicMean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.some((value) => value <= 0)) {
    return 0;
  }
  const sumInv = values.reduce((sum, value) => sum + 1 / value, 0);
  return values.length / sumInv;
}

function squeeze(value: number, min: number, max: number): number {
  return clamp(value, min, max);
}

function rollingSlices(
  values: readonly number[],
  sliceSize: number,
): number[][] {
  if (sliceSize <= 0 || values.length < sliceSize) {
    return [];
  }
  const slices: number[][] = [];
  for (let i = 0; i <= values.length - sliceSize; i += 1) {
    slices.push(values.slice(i, i + sliceSize));
  }
  return slices;
}

function moveColorAt(
  moveIndex: number,
  startColor: PlayerColor,
): PlayerColor {
  const whiteToMove = moveIndex % 2 === 0;
  return (whiteToMove === (startColor === "white")) ? "white" : "black";
}

function accuracyForMove(
  prevWhiteWinPercent: number,
  nextWhiteWinPercent: number,
  color: PlayerColor,
): number {
  if (color === "white") {
    return moveAccuracyFromWinPercents(prevWhiteWinPercent, nextWhiteWinPercent);
  }
  return moveAccuracyFromWinPercents(nextWhiteWinPercent, prevWhiteWinPercent);
}

export interface GameAccuracyResult {
  white: number;
  black: number;
}

/**
 * Lichess `gameAccuracy`: volatility-weighted mean + harmonic mean per color.
 * `allWhiteWinPercents` includes the starting position (graph[0]) then after each move.
 */
export function gameAccuracy(
  allWhiteWinPercents: readonly number[],
  startColor: PlayerColor,
): GameAccuracyResult {
  const moveCount = allWhiteWinPercents.length - 1;
  if (moveCount <= 0) {
    return { white: 0, black: 0 };
  }

  const sliceSize = squeeze(Math.floor(moveCount / 10), 2, 8);
  const n = allWhiteWinPercents.length;
  const repeatCount = Math.max(0, Math.min(sliceSize, n) - 2);
  const firstSlice = allWhiteWinPercents.slice(0, sliceSize);
  const slices = [
    ...Array.from({ length: repeatCount }, () => [...firstSlice]),
    ...rollingSlices(allWhiteWinPercents, sliceSize),
  ];
  const weights = slices.map((slice) =>
    squeeze(standardDeviation(slice), 0.5, 12),
  );

  const byColor: Record<
    PlayerColor,
    { weighted: Readonly<[number, number]>[]; accuracies: number[] }
  > = {
    white: { weighted: [], accuracies: [] },
    black: { weighted: [], accuracies: [] },
  };

  for (let i = 0; i < moveCount; i += 1) {
    const prev = allWhiteWinPercents[i];
    const next = allWhiteWinPercents[i + 1];
    const weight = weights[i];
    if (prev === undefined || next === undefined || weight === undefined) {
      continue;
    }
    const color = moveColorAt(i, startColor);
    const accuracy = accuracyForMove(prev, next, color);
    byColor[color].weighted.push([accuracy, weight]);
    byColor[color].accuracies.push(accuracy);
  }

  function colorAccuracy(color: PlayerColor): number {
    const { weighted, accuracies } = byColor[color];
    if (accuracies.length === 0) {
      return 0;
    }
    const wm = weightedMean(weighted);
    const hm = harmonicMean(accuracies);
    return (wm + hm) / 2;
  }

  return {
    white: colorAccuracy("white"),
    black: colorAccuracy("black"),
  };
}

/** Legacy helper (not used for game accuracy under lila-v1). */
export function aggregateAccuracy(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return 0.5 * trimmedMean(values) + 0.5 * harmonicMean(values);
}
