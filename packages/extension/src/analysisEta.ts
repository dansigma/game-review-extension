/**
 * Estimates remaining analysis time from elapsed time and ply progress.
 * Returns null when no estimate is possible (no plies completed yet).
 */
export function estimateRemainingMs(
  elapsedMs: number,
  done: number,
  total: number,
): number | null {
  if (done <= 0) {
    return null;
  }
  if (done >= total) {
    return 0;
  }
  const msPerPly = elapsedMs / done;
  return Math.round(msPerPly * (total - done));
}

export function formatRemainingPt(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "~0s restantes";
  }
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) {
    return `~${seconds}s restantes`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes === 1) {
    return "~1 min restante";
  }
  return `~${minutes} min restantes`;
}

export function formatAnalysisProgressLabel(
  done: number,
  total: number,
  remainingMs: number | null | undefined,
): string {
  const base = `Analisando… ${done}/${total}`;
  if (remainingMs === null || remainingMs === undefined) {
    return base;
  }
  return `${base} · ${formatRemainingPt(remainingMs)}`;
}
