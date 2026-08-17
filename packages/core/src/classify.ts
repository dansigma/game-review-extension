import {
  EPL_THRESHOLDS,
  HOPELESS_WIN_PERCENT,
  MOVE_CLASS_LABEL_PT,
  type MoveClass,
} from "./types.ts";

export function isHopeless(playerWinPercentBefore: number): boolean {
  return playerWinPercentBefore <= HOPELESS_WIN_PERCENT;
}

function isBestQuality(epl: number, playedIsBest: boolean): boolean {
  return playedIsBest || epl < EPL_THRESHOLDS.best;
}

function hasBrilliantImpact(
  playerWinPercentBefore: number,
  playerWinPercentAfter: number,
): boolean {
  return (
    playerWinPercentAfter - playerWinPercentBefore >= 10 ||
    playerWinPercentAfter >= 85
  );
}

export function classifyMove(args: {
  epl: number;
  playedIsBest: boolean;
  playerWinPercentBefore: number;
  playerWinPercentAfter: number;
  isOnlyMove: boolean;
  isSacrifice: boolean;
  previousOpponentEpl?: number;
}): MoveClass {
  if (isHopeless(args.playerWinPercentBefore)) {
    return "forced";
  }

  if (
    !args.playedIsBest &&
    args.previousOpponentEpl !== undefined &&
    args.previousOpponentEpl >= EPL_THRESHOLDS.missPreviousOpponent &&
    args.playerWinPercentBefore >= 60 &&
    args.playerWinPercentBefore - args.playerWinPercentAfter >= 10
  ) {
    return "miss";
  }

  if (
    isBestQuality(args.epl, args.playedIsBest) &&
    args.isSacrifice &&
    args.playerWinPercentAfter >= 35 &&
    args.playerWinPercentBefore <= 90 &&
    hasBrilliantImpact(args.playerWinPercentBefore, args.playerWinPercentAfter)
  ) {
    return "brilliant";
  }

  if (isBestQuality(args.epl, args.playedIsBest)) {
    if (args.isOnlyMove) {
      return "great";
    }
    if (
      args.playerWinPercentBefore < 35 &&
      args.playerWinPercentAfter >= 50
    ) {
      return "great";
    }
    if (
      args.playerWinPercentBefore >= 45 &&
      args.playerWinPercentBefore <= 55 &&
      args.playerWinPercentAfter >= 70
    ) {
      return "great";
    }
  }

  if (args.playedIsBest || args.epl < EPL_THRESHOLDS.bestBandMax) {
    return "best";
  }
  if (args.epl < EPL_THRESHOLDS.inaccuracy) {
    return "inaccuracy";
  }
  if (args.epl < EPL_THRESHOLDS.mistake) {
    return "mistake";
  }
  return "blunder";
}

export function applyOpeningFilter(
  classification: MoveClass,
  isOpening: boolean,
): MoveClass {
  if (
    isOpening &&
    (classification === "brilliant" ||
      classification === "great" ||
      classification === "best")
  ) {
    return "opening";
  }
  return classification;
}

export function classificationLabel(classification: MoveClass): string {
  return MOVE_CLASS_LABEL_PT[classification];
}
