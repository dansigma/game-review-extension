import {
  applyAnalysisBroadcast,
  IDLE_ANALYSIS_STATE,
  markAnalysisStarting,
  shouldIgnoreDuplicateAnalysisStart,
  toAnalysisStatus,
  type AnalysisJobState,
} from "./analysisJobState.ts";
import type {
  AnalysisBroadcast,
  AnalysisCancelRequest,
  AnalysisStartRequest,
  AnalysisStatusData,
  OffscreenCommand,
} from "./messages.ts";
import { ensureOffscreenDocument } from "./offscreenDocument.ts";

let analysisState: AnalysisJobState = IDLE_ANALYSIS_STATE;

export function getAnalysisJobState(): AnalysisJobState {
  return analysisState;
}

export function resetAnalysisJobStateForTests(): void {
  analysisState = IDLE_ANALYSIS_STATE;
}

export function ingestAnalysisBroadcast(broadcast: AnalysisBroadcast): void {
  analysisState = applyAnalysisBroadcast(analysisState, broadcast);
}

export async function handleAnalysisStart(
  message: AnalysisStartRequest,
  deps: {
    ensureOffscreen: () => Promise<void>;
    sendOffscreenCommand: (command: OffscreenCommand) => Promise<unknown>;
  } = {
    ensureOffscreen: ensureOffscreenDocument,
    sendOffscreenCommand: (command) => chrome.runtime.sendMessage(command),
  },
): Promise<{ started: boolean }> {
  if (
    shouldIgnoreDuplicateAnalysisStart(analysisState, {
      gameId: message.game.gameId,
      nodesPerPosition: message.nodesPerPosition,
      bypassCache: message.bypassCache,
    })
  ) {
    return { started: false };
  }

  await deps.ensureOffscreen();

  if (analysisState.state === "running") {
    await deps.sendOffscreenCommand({ type: "offscreen-analysis-cancel" });
  }

  analysisState = markAnalysisStarting(message.game.gameId, message.nodesPerPosition);

  await deps.sendOffscreenCommand({
    type: "offscreen-analysis-start",
    game: message.game,
    nodesPerPosition: message.nodesPerPosition,
  });

  return { started: true };
}

export async function handleAnalysisCancel(
  _message: AnalysisCancelRequest,
  deps: {
    ensureOffscreen: () => Promise<void>;
    sendOffscreenCommand: (command: OffscreenCommand) => Promise<unknown>;
  } = {
    ensureOffscreen: ensureOffscreenDocument,
    sendOffscreenCommand: (command) => chrome.runtime.sendMessage(command),
  },
): Promise<void> {
  if (analysisState.state !== "running") {
    return;
  }

  await deps.ensureOffscreen();
  await deps.sendOffscreenCommand({ type: "offscreen-analysis-cancel" });
}

export function handleAnalysisStatus(): AnalysisStatusData {
  return toAnalysisStatus(analysisState);
}
