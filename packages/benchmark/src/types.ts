export interface BenchmarkGameInput {
  pgn: string;
  ply: number; // 1-based halfmove
}

export interface PerGameResult {
  gameIndex: number;
  answerPly: number; // 1-based
  answerSan?: string;
  answerUci?: string;
  ourClassificationAtAnswer?: string;
  isTP: boolean;
  isFN: boolean;
  falsePositives: Array<{ ply: number; san: string; uci: string; classification: string }>;
  totalPlies: number;
  error?: string;
}

export interface GlobalMetrics {
  totalGames: number;
  tp: number;
  fn: number;
  fp: number;
  recall: number; // TP/100
  precision: number; // TP/(TP+FP)
  fpPer1000: number; // FP*1000 / (totalPlies - answerPlies)
  totalPlies: number;
}

export interface BenchmarkResults {
  meta: {
    enginePath: string;
    engineId: string;
    nodesPerPosition: number;
    multipv: number;
    dataset: string;
    generatedAt: string;
    wallClockMs: number;
    totalGames: number;
  };
  metrics: GlobalMetrics;
  perGame: PerGameResult[];
}
