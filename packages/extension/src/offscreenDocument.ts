export const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

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
  };
}

let creatingOffscreen: Promise<void> | null = null;

export async function ensureOffscreenDocument(
  chromeApi: OffscreenChrome = globalThis.chrome as unknown as OffscreenChrome,
): Promise<void> {
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

/** Test-only reset for concurrent-create guard. */
export function resetOffscreenCreateGuardForTests(): void {
  creatingOffscreen = null;
}
