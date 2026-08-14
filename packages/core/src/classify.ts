import {
  EPL_THRESHOLDS,
  HOPELESS_WIN_PERCENT,
  MOVE_CLASS_LABEL_PT,
  type MoveClass,
} from "./types.ts";

export function isHopeless(playerWinPercentBefore: number): boolean {
  return playerWinPercentBefore <= HOPELESS_WIN_PERCENT;
}

export function classifyMove(args: {
  epl: number;
  playedIsBest: boolean;
  playerWinPercentBefore: number;
}): MoveClass {
  if (isHopeless(args.playerWinPercentBefore)) {
    return "forced";
  }
  if (args.playedIsBest || args.epl < EPL_THRESHOLDS.best) {
    return "best";
  }
  if (args.epl < EPL_THRESHOLDS.good) {
    return "good";
  }
  if (args.epl < EPL_THRESHOLDS.inaccuracy) {
    return "inaccuracy";
  }
  if (args.epl < EPL_THRESHOLDS.mistake) {
    return "mistake";
  }
  return "blunder";
}

export function classificationLabel(classification: MoveClass): string {
  return MOVE_CLASS_LABEL_PT[classification];
}
