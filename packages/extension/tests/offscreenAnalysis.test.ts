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

describe("offscreen idle alarm (chrome.alarms)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetOffscreenCreateGuardForTests();
  });

  it("scheduleOffscreenIdleTimer creates alarm with delayInMinutes 5", async () => {
    const create = vi.fn();
    const clear = vi.fn(async () => true);
    const addListener = vi.fn();
    const closeDocument = vi.fn(async () => {});
    vi.stubGlobal("chrome", {
      runtime: { getURL: (p: string) => `chrome-extension://test/${p}`, getContexts: vi.fn(async () => []) },
      offscreen: { createDocument: vi.fn(async () => {}), closeDocument },
      alarms: { create, clear, onAlarm: { addListener } },
    });
    const mod = await import("../src/offscreenDocument.ts");
    mod.resetOffscreenCreateGuardForTests();
    const { scheduleOffscreenIdleTimer, OFFSCREEN_IDLE_ALARM_NAME } = mod;
    scheduleOffscreenIdleTimer(undefined, (globalThis as unknown as { chrome: unknown }).chrome as never);
    expect(create).toHaveBeenCalledWith(OFFSCREEN_IDLE_ALARM_NAME, { delayInMinutes: 5 });
    // Listener is now at SW top level (background.ts), not via scheduleOffscreenIdleTimer
    expect(addListener).not.toHaveBeenCalled();
  });

  it("cancelOffscreenIdleTimer clears the alarm", async () => {
    const clear = vi.fn(async () => true);
    const create = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: { getURL: (p: string) => `chrome-extension://test/${p}`, getContexts: vi.fn(async () => []) },
      offscreen: { createDocument: vi.fn(async () => {}) },
      alarms: { create, clear, onAlarm: { addListener: vi.fn() } },
    });
    const { cancelOffscreenIdleTimer, OFFSCREEN_IDLE_ALARM_NAME } = await import("../src/offscreenDocument.ts");
    cancelOffscreenIdleTimer((globalThis as unknown as { chrome: unknown }).chrome as never);
    expect(clear).toHaveBeenCalledWith(OFFSCREEN_IDLE_ALARM_NAME);
  });

  it("handleAnalysisStart clears previous alarm", async () => {
    const clear = vi.fn(async () => true);
    const create = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: { getURL: (p: string) => `chrome-extension://test/${p}`, getContexts: vi.fn(async () => []) },
      offscreen: { createDocument: vi.fn(async () => {}), closeDocument: vi.fn(async () => {}) },
      alarms: { create, clear, onAlarm: { addListener: vi.fn() } },
      storage: { session: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) } },
    });
    const game = parsePgn(`[Event "Test"]\n\n1. e4 e5 1/2-1/2`);
    const ensureOffscreen = vi.fn(async () => {});
    const sendOffscreenCommand = vi.fn(async () => ({}));
    const { handleAnalysisStart } = await import("../src/backgroundAnalysis.ts");
    await handleAnalysisStart({ type: "analysis-start", game, nodesPerPosition: 400000 }, { ensureOffscreen, sendOffscreenCommand });
    expect(clear).toHaveBeenCalled();
  });

  it("rehydrateAnalysisState restores running state and terminal broadcast re-arms alarm", async () => {
    const storageData: Record<string, unknown> = { analysisState: { state: "running", gameId: "g123", nodesPerPosition: 400000 } };
    const storageApi = { get: vi.fn(async (key: string) => ({ [key]: storageData[key] })), set: vi.fn(async () => {}) } as unknown as typeof chrome.storage.session;
    const { rehydrateAnalysisState, getAnalysisJobState, resetAnalysisJobStateForTests } = await import("../src/backgroundAnalysis.ts");
    resetAnalysisJobStateForTests();
    const restored = await rehydrateAnalysisState(storageApi);
    expect(restored.state).toBe("running");
    expect(getAnalysisJobState().state).toBe("running");
    const create = vi.fn();
    const clear = vi.fn(async () => true);
    vi.stubGlobal("chrome", {
      runtime: { getURL: (p: string) => `chrome-extension://test/${p}`, getContexts: vi.fn(async () => []) },
      offscreen: { createDocument: vi.fn(async () => {}), closeDocument: vi.fn(async () => {}) },
      alarms: { create, clear, onAlarm: { addListener: vi.fn() } },
      storage: { session: storageApi as unknown as typeof chrome.storage.session },
    });
    const { ingestAnalysisBroadcast } = await import("../src/backgroundAnalysis.ts");
    ingestAnalysisBroadcast({ type: "analysis-complete", gameId: "g123", review: {} as never });
    expect(create).toHaveBeenCalledWith("offscreen-idle-close", { delayInMinutes: 5 });
    resetAnalysisJobStateForTests();
  });

  it("restart-idle: alarm still closes offscreen after SW wake with idle state (top-level listener)", async () => {
    vi.resetModules();
    const closeDocument = vi.fn(async () => {});
    let alarmCallback: (alarm: { name: string }) => void = () => {};
    const addListener = vi.fn((cb: (alarm: { name: string }) => void) => {
      alarmCallback = cb;
    });
    const create = vi.fn();
    const clear = vi.fn(async () => true);
    // Storage returns idle state
    const storageGet = vi.fn(async (key: string) => {
      if (key === "analysisState") return { analysisState: { state: "idle" } };
      return {};
    });
    const storageSet = vi.fn(async () => {});

    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (p: string) => `chrome-extension://test/${p}`,
        getContexts: vi.fn(async () => []),
        onMessage: { addListener: vi.fn() },
        sendMessage: vi.fn(),
      },
      offscreen: {
        createDocument: vi.fn(async () => {}),
        closeDocument,
      },
      alarms: { create, clear, onAlarm: { addListener } },
      storage: { session: { get: storageGet, set: storageSet } },
      sidePanel: {
        setPanelBehavior: vi.fn(async () => {}),
        setOptions: vi.fn(async () => {}),
        open: vi.fn(async () => {}),
      },
    });

    // Fresh SW: import background.ts (top-level registers onAlarm unconditionally)
    await import("../src/background.ts");
    // Allow top-level await rehydrate to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(addListener).toHaveBeenCalledTimes(1);

    // Simulate pending alarm firing into freshly-woken SW with idle state
    expect(create).not.toHaveBeenCalled();
    alarmCallback({ name: "offscreen-idle-close" });
    expect(closeDocument).toHaveBeenCalledTimes(1);

    // Non-matching alarm names should not close
    closeDocument.mockClear();
    alarmCallback({ name: "other-alarm" });
    expect(closeDocument).not.toHaveBeenCalled();
  });
});
