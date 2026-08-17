import { shouldPutCachedReview } from "./analysisCachePolicy.ts";
import { createEnginePort, type EnginePort } from "./enginePort.ts";
import type { NormalizedGame } from "@game-review/core";
import type { OffscreenCommand } from "./messages.ts";
import { putCachedReview } from "./reviewCache.ts";
import { reviewGameWithEngine } from "./reviewWithEngine.ts";

let analysisEngine: EnginePort | null = null;
let analysisAbort: AbortController | null = null;
let currentGameId: string | null = null;

function assetBase(): string {
  return chrome.runtime.getURL("engine/");
}

function disposeEngine(): void {
  analysisEngine?.dispose();
  analysisEngine = null;
}

function cancelAnalysis(): void {
  analysisAbort?.abort();
}

function broadcast(message: Record<string, unknown>): void {
  void chrome.runtime.sendMessage(message).catch(() => {
    // Side panel or background may be unavailable; analysis still completes locally.
  });
}

async function runAnalysis(
  normalizedGame: NormalizedGame,
  nodesPerPosition: number,
): Promise<void> {
  cancelAnalysis();
  disposeEngine();

  const gameId = normalizedGame.gameId;
  currentGameId = gameId;
  analysisAbort = new AbortController();
  const { signal } = analysisAbort;

  analysisEngine = createEnginePort(assetBase());

  try {
    await analysisEngine.init();
    const review = await reviewGameWithEngine(analysisEngine, {
      game: normalizedGame,
      nodesPerPosition,
      signal,
      onProgress: (done, progressTotal) => {
        broadcast({
          type: "analysis-progress",
          gameId,
          done,
          total: progressTotal,
        });
      },
    });

    if (!shouldPutCachedReview(signal.aborted, review)) {
      broadcast({ type: "analysis-cancelled", gameId });
      return;
    }

    await putCachedReview(review);
    broadcast({ type: "analysis-complete", gameId, review });
  } catch (error: unknown) {
    if (signal.aborted) {
      broadcast({ type: "analysis-cancelled", gameId });
      return;
    }
    const text = error instanceof Error ? error.message : String(error);
    broadcast({ type: "analysis-error", gameId, error: text });
  } finally {
    disposeEngine();
    analysisAbort = null;
    if (currentGameId === gameId) {
      currentGameId = null;
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: OffscreenCommand, _sender, sendResponse) => {
    if (message.type === "offscreen-analysis-start") {
      void runAnalysis(message.game, message.nodesPerPosition)
        .then(() => {
          sendResponse({ ok: true });
        })
        .catch((error: unknown) => {
          const text = error instanceof Error ? error.message : String(error);
          sendResponse({ ok: false, error: text });
        });
      return true;
    }

    if (message.type === "offscreen-analysis-cancel") {
      const gameId = currentGameId;
      cancelAnalysis();
      if (gameId) {
        broadcast({ type: "analysis-cancelled", gameId });
      }
      sendResponse({ ok: true });
      return false;
    }

    return false;
  },
);
