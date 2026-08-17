import type { AnalysisBroadcast, AnalysisStatusData } from "./messages.ts";

export type AnalysisJobState = AnalysisStatusData & {
  nodesPerPosition?: number;
};

export const IDLE_ANALYSIS_STATE: AnalysisJobState = { state: "idle" };

export function shouldIgnoreDuplicateAnalysisStart(
  current: AnalysisJobState,
  request: {
    gameId: string;
    nodesPerPosition: number;
    bypassCache?: boolean;
  },
): boolean {
  return (
    current.state === "running" &&
    current.gameId === request.gameId &&
    current.nodesPerPosition === request.nodesPerPosition &&
    !request.bypassCache
  );
}

export function applyAnalysisBroadcast(
  current: AnalysisJobState,
  broadcast: AnalysisBroadcast,
): AnalysisJobState {
  switch (broadcast.type) {
    case "analysis-progress":
      return {
        state: "running",
        gameId: broadcast.gameId,
        done: broadcast.done,
        total: broadcast.total,
        nodesPerPosition: current.nodesPerPosition,
      };
    case "analysis-complete":
    case "analysis-error":
    case "analysis-cancelled":
      return IDLE_ANALYSIS_STATE;
    default:
      return current;
  }
}

export function toAnalysisStatus(state: AnalysisJobState): AnalysisStatusData {
  if (state.state === "idle") {
    return { state: "idle" };
  }
  return {
    state: "running",
    gameId: state.gameId,
    done: state.done,
    total: state.total,
  };
}

export function markAnalysisStarting(
  gameId: string,
  nodesPerPosition: number,
): AnalysisJobState {
  return {
    state: "running",
    gameId,
    nodesPerPosition,
    done: 0,
    total: undefined,
  };
}
