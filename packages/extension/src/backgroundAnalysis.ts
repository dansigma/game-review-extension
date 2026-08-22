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
import {
  cancelOffscreenIdleTimer,
  ensureOffscreenDocument,
  scheduleOffscreenIdleTimer,
} from "./offscreenDocument.ts";

export const ANALYSIS_STATE_STORAGE_KEY = "analysisState";

let analysisState: AnalysisJobState = IDLE_ANALYSIS_STATE;

export function saveAnalysisStateToStorage(
  storageApi: typeof chrome.storage.session = globalThis.chrome?.storage?.session,
): void {
  void storageApi?.set?.({ [ANALYSIS_STATE_STORAGE_KEY]: analysisState })?.catch(() => {});
}

export async function rehydrateAnalysisState(
  storageApi: typeof chrome.storage.session = globalThis.chrome?.storage?.session,
): Promise<AnalysisJobState> {
  try {
    const data = await storageApi?.get?.(ANALYSIS_STATE_STORAGE_KEY);
    if (data && data[ANALYSIS_STATE_STORAGE_KEY]) {
      analysisState = data[ANALYSIS_STATE_STORAGE_KEY] as AnalysisJobState;
    }
  } catch {
    // Keep default state on storage error
  }
  return analysisState;
}

export function getAnalysisJobState(): AnalysisJobState {
  return analysisState;
}

export function resetAnalysisJobStateForTests(): void {
  analysisState = IDLE_ANALYSIS_STATE;
  cancelOffscreenIdleTimer();
}

export function ingestAnalysisBroadcast(broadcast: AnalysisBroadcast): void {
  const prevState = analysisState.state;
  analysisState = applyAnalysisBroadcast(analysisState, broadcast);
  if (prevState === "running" && analysisState.state === "idle") {
    scheduleOffscreenIdleTimer();
  }
  saveAnalysisStateToStorage();
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
  saveAnalysisStateToStorage();

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
  scheduleOffscreenIdleTimer();
  saveAnalysisStateToStorage();
}

export function handleAnalysisStatus(): AnalysisStatusData {
  return toAnalysisStatus(analysisState);
}
