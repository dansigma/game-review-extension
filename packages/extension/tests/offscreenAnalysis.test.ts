import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAnalysisBroadcast,
  IDLE_ANALYSIS_STATE,
  shouldIgnoreDuplicateAnalysisStart,
} from "../src/analysisJobState.ts";
import {
  handleAnalysisStart,
  resetAnalysisJobStateForTests,
} from "../src/backgroundAnalysis.ts";
import type { AnalysisBroadcast } from "../src/messages.ts";
import {
  ensureOffscreenDocument,
  resetOffscreenCreateGuardForTests,
} from "../src/offscreenDocument.ts";
import { parsePgn } from "@game-review/core";

describe("ensureOffscreenDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetOffscreenCreateGuardForTests();
  });

  it("creates an offscreen document when none exists", async () => {
    const getContexts = vi.fn().mockResolvedValue([]);
    const createDocument = vi.fn().mockResolvedValue(undefined);
    const getURL = vi.fn((path: string) => `chrome-extension://test/${path}`);

    vi.stubGlobal("chrome", {
      runtime: { getURL, getContexts },
      offscreen: { createDocument },
    });

    await ensureOffscreenDocument();

    expect(getContexts).toHaveBeenCalledWith({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: ["chrome-extension://test/offscreen.html"],
    });
    expect(createDocument).toHaveBeenCalledWith({
      url: "chrome-extension://test/offscreen.html",
      reasons: ["WORKERS"],
      justification: "Keep Stockfish WASM running after the side panel closes",
    });
  });

  it("skips create when an offscreen document already exists", async () => {
    const getContexts = vi
      .fn()
      .mockResolvedValue([{ contextType: "OFFSCREEN_DOCUMENT" }]);
    const createDocument = vi.fn();

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        getContexts,
      },
      offscreen: { createDocument },
    });

    await ensureOffscreenDocument();

    expect(createDocument).not.toHaveBeenCalled();
  });

  it("shares one create promise for concurrent callers", async () => {
    let resolveCreate: (() => void) | undefined;
    const getContexts = vi.fn().mockResolvedValue([]);
    const createDocument = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        getContexts,
      },
      offscreen: { createDocument },
    });

    const first = ensureOffscreenDocument();
    const second = ensureOffscreenDocument();

    await Promise.resolve();

    expect(createDocument).toHaveBeenCalledTimes(1);

    resolveCreate?.();
    await Promise.all([first, second]);
  });

  it("schedules idle timer and closes document after 5 minutes", async () => {
    vi.useFakeTimers();
    const closeDocument = vi.fn().mockResolvedValue(undefined);

    const chromeApi = {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
        getContexts: vi.fn().mockResolvedValue([]),
      },
      offscreen: {
        createDocument: vi.fn().mockResolvedValue(undefined),
        closeDocument,
      },
    };

    const { scheduleOffscreenIdleTimer } = await import("../src/offscreenDocument.ts");
    scheduleOffscreenIdleTimer(300_000, chromeApi as any);

    expect(closeDocument).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300_000);

    expect(closeDocument).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("analysis job state", () => {
  it("ignores duplicate starts for the same running job", () => {
    expect(
      shouldIgnoreDuplicateAnalysisStart(
        {
          state: "running",
          gameId: "abc12345",
          nodesPerPosition: 400000,
        },
        { gameId: "abc12345", nodesPerPosition: 400000 },
      ),
    ).toBe(true);
  });

  it("allows reanalyze to restart the same job", () => {
    expect(
      shouldIgnoreDuplicateAnalysisStart(
        {
          state: "running",
          gameId: "abc12345",
          nodesPerPosition: 400000,
        },
        { gameId: "abc12345", nodesPerPosition: 400000, bypassCache: true },
      ),
    ).toBe(false);
  });

  it("returns idle after terminal broadcasts", () => {
    const running = applyAnalysisBroadcast(IDLE_ANALYSIS_STATE, {
      type: "analysis-progress",
      gameId: "abc12345",
      done: 1,
      total: 40,
    });
    expect(running.state).toBe("running");

    const complete = applyAnalysisBroadcast(running, {
      type: "analysis-complete",
      gameId: "abc12345",
      review: {} as AnalysisBroadcast extends { type: "analysis-complete" }
        ? import("@game-review/core").GameReview
        : never,
    });
    expect(complete).toEqual(IDLE_ANALYSIS_STATE);
  });
});

describe("background analysis-start", () => {
  afterEach(() => {
    resetAnalysisJobStateForTests();
  });

  it("persists analysis state to storage.session and rehydrates state", async () => {
    const {
      getAnalysisJobState,
      ingestAnalysisBroadcast,
      rehydrateAnalysisState,
      ANALYSIS_STATE_STORAGE_KEY,
    } = await import("../src/backgroundAnalysis.ts");

    let storedData: Record<string, any> = {};
    const storageApi = {
      set: vi.fn(async (items: Record<string, any>) => {
        storedData = { ...storedData, ...items };
      }),
      get: vi.fn(async (key: string) => ({ [key]: storedData[key] })),
    } as any;

    ingestAnalysisBroadcast({
      type: "analysis-progress",
      gameId: "test-game-123",
      done: 2,
      total: 10,
    });

    const currentState = getAnalysisJobState();
    expect(currentState.state).toBe("running");

    const { saveAnalysisStateToStorage } = await import("../src/backgroundAnalysis.ts");
    saveAnalysisStateToStorage(storageApi);

    expect(storageApi.set).toHaveBeenCalledWith({
      [ANALYSIS_STATE_STORAGE_KEY]: currentState,
    });

    resetAnalysisJobStateForTests();
    expect(getAnalysisJobState().state).toBe("idle");

    const rehydrated = await rehydrateAnalysisState(storageApi);
    expect(rehydrated.state).toBe("running");
    expect((rehydrated as any).gameId).toBe("test-game-123");
  });

  it("does not throw and forwards to offscreen", async () => {
    const game = parsePgn(
      `[Event "Test"]\n\n1. e4 e5 2. Nf3 Nc6 1/2-1/2`,
    );
    const ensureOffscreen = vi.fn().mockResolvedValue(undefined);
    const sendOffscreenCommand = vi.fn().mockResolvedValue({ ok: true });

    const result = await handleAnalysisStart(
      {
        type: "analysis-start",
        game,
        nodesPerPosition: 400000,
      },
      { ensureOffscreen, sendOffscreenCommand },
    );

    expect(result).toEqual({ started: true });
    expect(ensureOffscreen).toHaveBeenCalledTimes(1);
    expect(sendOffscreenCommand).toHaveBeenCalledWith({
      type: "offscreen-analysis-start",
      game,
      nodesPerPosition: 400000,
    });
  });
});
