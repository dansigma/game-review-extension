import type { GameReview, NormalizedGame } from "@game-review/core";
import type { ChesscomGameKind } from "./chesscomExport.ts";

export type BackgroundRequest =
  | { type: "lichess-export"; gameId: string }
  | { type: "lichess-tv" }
  | { type: "chesscom-callback"; kind: ChesscomGameKind; id: string }
  | {
      type: "chesscom-archive";
      username: string;
      year: number;
      month: number;
    }
  | { type: "open-review"; gameId: string }
  | { type: "get-active-game" }
  | AnalysisStartRequest
  | AnalysisCancelRequest
  | AnalysisStatusRequest;

export type BackgroundResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type ActiveGameData = {
  gameId: string;
};

export type AnalysisStatusData = {
  state: "idle" | "running";
  gameId?: string;
  done?: number;
  total?: number;
};

export type AnalysisStartRequest = {
  type: "analysis-start";
  game: NormalizedGame;
  nodesPerPosition: number;
  bypassCache?: boolean;
};

export type AnalysisCancelRequest = {
  type: "analysis-cancel";
};

export type AnalysisStatusRequest = {
  type: "analysis-status";
};

export type AnalysisProgressBroadcast = {
  type: "analysis-progress";
  gameId: string;
  done: number;
  total: number;
};

export type AnalysisCompleteBroadcast = {
  type: "analysis-complete";
  gameId: string;
  review: GameReview;
};

export type AnalysisErrorBroadcast = {
  type: "analysis-error";
  gameId: string;
  error: string;
};

export type AnalysisCancelledBroadcast = {
  type: "analysis-cancelled";
  gameId: string;
};

export type AnalysisBroadcast =
  | AnalysisProgressBroadcast
  | AnalysisCompleteBroadcast
  | AnalysisErrorBroadcast
  | AnalysisCancelledBroadcast;

/** Background → offscreen commands (avoid routing loops in the service worker). */
export type OffscreenCommand =
  | {
      type: "offscreen-analysis-start";
      game: NormalizedGame;
      nodesPerPosition: number;
    }
  | { type: "offscreen-analysis-cancel" };

const ANALYSIS_BROADCAST_TYPES = new Set<string>([
  "analysis-progress",
  "analysis-complete",
  "analysis-error",
  "analysis-cancelled",
]);

export function isAnalysisBroadcast(message: unknown): message is AnalysisBroadcast {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof (message as { type: unknown }).type === "string" &&
    ANALYSIS_BROADCAST_TYPES.has((message as { type: string }).type)
  );
}
