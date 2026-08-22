export const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
export const OFFSCREEN_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const OFFSCREEN_IDLE_ALARM_NAME = "offscreen-idle-close";
export const OFFSCREEN_IDLE_DELAY_MINUTES = 5;

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
  alarms?: {
    create(name: string, info: { delayInMinutes: number }): void;
    clear(name: string): Promise<boolean> | boolean | void;
    onAlarm?: {
      addListener(cb: (alarm: { name: string }) => void): void;
    };
  };
}

let creatingOffscreen: Promise<void> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let alarmListenerRegistered = false;

function getAlarmsApi(
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): OffscreenChrome["alarms"] | undefined {
  return (chromeApi as OffscreenChrome)?.alarms ?? (globalThis.chrome as unknown as OffscreenChrome)?.alarms;
}

function ensureAlarmListener(
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): void {
  if (alarmListenerRegistered) return;
  const alarms = getAlarmsApi(chromeApi);
  if (!alarms?.onAlarm?.addListener) return;
  alarms.onAlarm.addListener((alarm: { name: string }) => {
    if (alarm.name === OFFSCREEN_IDLE_ALARM_NAME) {
      void (chromeApi as OffscreenChrome)?.offscreen?.closeDocument?.();
      // Also try global chrome as fallback
      void (globalThis.chrome as unknown as OffscreenChrome)?.offscreen?.closeDocument?.();
    }
  });
  alarmListenerRegistered = true;
}

export function cancelOffscreenIdleTimer(
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  void getAlarmsApi(chromeApi)?.clear?.(OFFSCREEN_IDLE_ALARM_NAME);
}

export function scheduleOffscreenIdleTimer(
  timeoutMs = OFFSCREEN_IDLE_TIMEOUT_MS,
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): void {
  cancelOffscreenIdleTimer(chromeApi);
  const alarms = getAlarmsApi(chromeApi);
  if (alarms?.create) {
    const delayInMinutes = timeoutMs / 60000;
    alarms.create(OFFSCREEN_IDLE_ALARM_NAME, { delayInMinutes });
    ensureAlarmListener(chromeApi);
    return;
  }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void chromeApi?.offscreen?.closeDocument?.();
  }, timeoutMs);
}

export function getOffscreenIdleTimerForTests(): ReturnType<typeof setTimeout> | null {
  return idleTimer;
}

/** Test-only: reset alarm listener registration. */
export function resetOffscreenAlarmListenerForTests(): void {
  alarmListenerRegistered = false;
}

export async function ensureOffscreenDocument(
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): Promise<void> {
  cancelOffscreenIdleTimer(chromeApi);

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
  resetOffscreenAlarmListenerForTests();
}
