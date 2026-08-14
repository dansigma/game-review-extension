import { clamp } from "./winPercent.ts";

const TRIM_RATIO = 0.1;
const MIN_COUNT_FOR_TRIM = 10;

/** Per-ply accuracy for epl-v1: 100 * (1 - EPL)^1.2 */
export function moveAccuracy(epl: number): number {
  const lost = clamp(epl, 0, 1);
  return 100 * (1 - lost) ** 1.2;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

/** epl-v1 aggregate: 0.5 * trimmedMean + 0.5 * harmonicMean */
export function aggregateAccuracy(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return 0.5 * trimmedMean(values) + 0.5 * harmonicMean(values);
}
