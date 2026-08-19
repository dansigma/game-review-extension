export type GameEndReason =
  | "time"
  | "mate"
  | "resign"
  | "stalemate"
  | "agreement"
  | "insufficient"
  | "repetition"
  | "unknown";

export type FinalStanding = "white_winning" | "black_winning" | "equal";

const GAME_END_REASONS: readonly GameEndReason[] = [
  "time",
  "mate",
  "resign",
  "stalemate",
  "agreement",
  "insufficient",
  "repetition",
  "unknown",
];

const FINAL_STANDINGS: readonly FinalStanding[] = [
  "white_winning",
  "black_winning",
  "equal",
];

export function isGameEndReason(value: string): value is GameEndReason {
  return (GAME_END_REASONS as readonly string[]).includes(value);
}

export function isFinalStanding(value: string): value is FinalStanding {
  return (FINAL_STANDINGS as readonly string[]).includes(value);
}

function normalizeTermination(raw: string | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * Maps host-agnostic PGN Termination text to a normalized end reason.
 * Time is checked first so "timeout versus insufficient material" → time.
 */
export function gameEndReasonFromTermination(raw: string | undefined): GameEndReason {
  const t = normalizeTermination(raw);
  if (!t) {
    return "unknown";
  }

  if (
    t.includes("time forfeit") ||
    t.includes("timeout") ||
    t.includes("on time") ||
    t.includes("won on time") ||
    t.includes("drawn by timeout") ||
    t.includes("by timeout") ||
    t.includes("out of time") ||
    t.includes("flag") ||
    t.includes("no tempo") ||
    t.includes("tempo esgotado") ||
    t.includes("acabou o tempo")
  ) {
    return "time";
  }

  if (t.includes("stalemate")) {
    return "stalemate";
  }

  if (t.includes("checkmate") || t.includes("won by mate") || /\bmate\b/.test(t)) {
    return "mate";
  }

  if (t.includes("resign") || t.includes("abandoned")) {
    return "resign";
  }

  if (t.includes("agreement") || t.includes("agreed")) {
    return "agreement";
  }

  if (t.includes("insufficient")) {
    return "insufficient";
  }

  if (t.includes("repetition") || t.includes("threefold")) {
    return "repetition";
  }

  return "unknown";
}

export function finalStandingFromWinPercent(whiteWinPercentAfter: number): FinalStanding {
  if (whiteWinPercentAfter >= 70) {
    return "white_winning";
  }
  if (whiteWinPercentAfter <= 30) {
    return "black_winning";
  }
  return "equal";
}
