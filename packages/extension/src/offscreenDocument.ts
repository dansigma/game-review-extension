export const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
export const OFFSCREEN_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function offscreenDocumentUrl(getUrl: (path: string) => string): string {
  return getUrl(OFFSCREEN_DOCUMENT_PATH);
}

export interface OffscreenChrome {
  runtime: {
    getURL(path: string): string;
    getContexts(filter: {
      contextTypes: string[];
      documentUrls: string[];
    }): Promise<{ contextType: string; documentUrl?: string }[]>;
  };
  offscreen: {
    createDocument(options: {
      url: string;
      reasons: string[];
      justification: string;
    }): Promise<void>;
    closeDocument?(): Promise<void>;
  };
}

let creatingOffscreen: Promise<void> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelOffscreenIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export function scheduleOffscreenIdleTimer(
  timeoutMs = OFFSCREEN_IDLE_TIMEOUT_MS,
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): void {
  cancelOffscreenIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void chromeApi?.offscreen?.closeDocument?.();
  }, timeoutMs);
}

export function getOffscreenIdleTimerForTests(): ReturnType<typeof setTimeout> | null {
  return idleTimer;
}

export async function ensureOffscreenDocument(
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): Promise<void> {
  cancelOffscreenIdleTimer();

  const url = offscreenDocumentUrl(chromeApi.runtime.getURL.bind(chromeApi.runtime));

  const existingContexts = await chromeApi.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chromeApi.offscreen
    .createDocument({
      url,
      reasons: ["WORKERS"],
      justification: "Keep Stockfish WASM running after the side panel closes",
    })
    .finally(() => {
      creatingOffscreen = null;
    });

  await creatingOffscreen;
}

/** Test-only reset for concurrent-create guard and idle timer. */
export function resetOffscreenCreateGuardForTests(): void {
  creatingOffscreen = null;
  cancelOffscreenIdleTimer();
}
