export const ALGO_VERSION = "lila-v1" as const;

export type AlgoVersion = typeof ALGO_VERSION;

export type PlayerColor = "white" | "black";

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export type MoveClass =
  | "best"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "forced";

export const MOVE_CLASS_LABEL_PT: Record<MoveClass, string> = {
  best: "Best",
  good: "Good",
  inaccuracy: "Imprecisão",
  mistake: "Erro",
  blunder: "Blunder",
  forced: "Forced",
};

/**
 * EPL thresholds in expected-points lost (0–1).
 * Own scale for this product — not Chess.com taxonomy.
 */
export const EPL_THRESHOLDS = {
  best: 0.02,
  good: 0.05,
  inaccuracy: 0.1,
  mistake: 0.15,
} as const;

/** Player win% at or below this is hopeless; the ply is Forced (accuracy still computed). */
export const HOPELESS_WIN_PERCENT = 10;

export interface NormalizedPlayer {
  name: string;
  rating?: number;
  title?: string;
}

export interface TimeControl {
  initialSeconds: number;
  incrementSeconds: number;
}

export interface NormalizedMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  color: PlayerColor;
}

export interface NormalizedGame {
  gameId: string;
  variant: "standard";
  result: GameResult;
  players: {
    white: NormalizedPlayer;
    black: NormalizedPlayer;
  };
  timeControl?: TimeControl;
  initialFen: string;
  startedAt?: number;
  termination?: string;
  moves: NormalizedMove[];
}

export type EngineScore =
  | { readonly type: "cp"; readonly value: number }
  | { readonly type: "mate"; readonly value: number };

export interface EngineLine {
  multipv: number;
  depth: number;
  nodes?: number;
  score: EngineScore;
  pv: string[];
}

export interface PositionEval {
  fen: string;
  ply: number;
  lines: EngineLine[];
}

export interface ReviewedMove {
  ply: number;
  san: string;
  uci: string;
  color: PlayerColor;
  classification: MoveClass;
  classificationLabel: string;
  epl: number;
  accuracy: number;
  playerWinPercentBefore: number;
  playerWinPercentAfter: number;
  whiteWinPercentAfter: number;
  bestUci: string;
  /** SAN for engine PV1 before the ply; omitted when UCI→SAN conversion fails. */
  bestSan?: string;
  playedIsBest: boolean;
  alternativeUci?: string;
  /** Side-to-move win% for MultiPV line 2 before the played move; absent when PV2 missing. */
  alternativePlayerWinPercent?: number;
}

export interface EvalGraphPoint {
  ply: number;
  whiteWinPercent: number;
}

export interface PlayerAccuracy {
  color: PlayerColor;
  movesCounted: number;
  movesExcludedForced: number;
  accuracy: number;
}

export interface GameReview {
  gameId: string;
  algoVersion: AlgoVersion;
  engineId: string;
  nodesPerPosition?: number;
  white: PlayerAccuracy;
  black: PlayerAccuracy;
  moves: ReviewedMove[];
  graph: EvalGraphPoint[];
}

export interface ReviewEngineInput {
  game: NormalizedGame;
  evals: PositionEval[];
  engineId: string;
  nodesPerPosition?: number;
}
