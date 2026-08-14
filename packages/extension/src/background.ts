import type {
  ActiveGameData,
  BackgroundRequest,
  BackgroundResponse,
} from "./messages.ts";
import { isLiveStatus, lichessExportUrl } from "./lichessExport.ts";

const SESSION_KEY = "activeGameId";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error("sidePanel.setPanelBehavior failed", error);
  });

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void,
  ) => {
    void handle(message, sender)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        sendResponse({ ok: false, error: text });
      });
    return true;
  },
);

async function handle(
  message: BackgroundRequest,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  if (message.type === "lichess-export") {
    const response = await fetch(
      lichessExportUrl(message.gameId, { pgnInJson: true }),
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`Lichess export HTTP ${response.status}`);
    }
    return response.json();
  }
  if (message.type === "lichess-tv") {
    const response = await fetch("https://lichess.org/api/tv/channels");
    if (!response.ok) {
      throw new Error(`Lichess TV HTTP ${response.status}`);
    }
    return response.json();
  }
  if (message.type === "open-review") {
    return openReviewPanel(message.gameId, sender.tab?.id);
  }
  if (message.type === "get-active-game") {
    const stored = await chrome.storage.session.get(SESSION_KEY);
    const gameId = stored[SESSION_KEY];
    if (typeof gameId !== "string" || gameId.length === 0) {
      return null;
    }
    return { gameId } satisfies ActiveGameData;
  }
  throw new Error("Unknown background message");
}

async function openReviewPanel(
  gameId: string,
  tabId: number | undefined,
): Promise<{ gameId: string; opened: boolean }> {
  const exportResponse = await fetch(
    `https://lichess.org/game/export/${gameId}`,
    { headers: { Accept: "application/json" } },
  );
  if (!exportResponse.ok) {
    throw new Error(`Lichess export HTTP ${exportResponse.status}`);
  }
  const game = (await exportResponse.json()) as { status?: string };
  if (isLiveStatus(game.status ?? "")) {
    throw new Error("Partida em andamento — análise indisponível");
  }

  await chrome.storage.session.set({ [SESSION_KEY]: gameId });

  let opened = false;
  if (tabId !== undefined) {
    await chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true });
    await chrome.sidePanel.open({ tabId });
    opened = true;
  }

  return { gameId, opened };
}
