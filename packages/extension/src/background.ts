import type {
  ActiveGameData,
  BackgroundRequest,
  BackgroundResponse,
} from "./messages.ts";
import {
  fetchChesscomArchive,
  fetchChesscomCallback,
  isChesscomTaggedGameId,
} from "./chesscomExport.ts";
import { isLiveChesscomCallback } from "./chesscomProvider.ts";
import { isLiveStatus, lichessExportUrl } from "./lichessExport.ts";
import { formatLichessExportHttpError } from "./reviewErrors.ts";
import { LIVE_GAME_MESSAGE_PT } from "./lichessProvider.ts";

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
    let response: Response;
    try {
      response = await fetch(
        lichessExportUrl(message.gameId, { pgnInJson: true }),
        { headers: { Accept: "application/json" } },
      );
    } catch {
      throw new Error("Falha de rede");
    }
    if (!response.ok) {
      throw new Error(formatLichessExportHttpError(response.status));
    }
    return response.json();
  }
  if (message.type === "chesscom-callback") {
    return fetchChesscomCallback(message.kind, message.id);
  }
  if (message.type === "chesscom-archive") {
    return fetchChesscomArchive(message.username, message.year, message.month);
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

async function assertReviewableBeforeOpen(gameId: string): Promise<void> {
  if (isChesscomTaggedGameId(gameId)) {
    const tagged = /^chesscom:(live|daily):(\d+)$/.exec(gameId);
    if (!tagged?.[1] || !tagged[2]) {
      throw new Error("ID de partida Chess.com inválido");
    }
    const callback = await fetchChesscomCallback(
      tagged[1] as "live" | "daily",
      tagged[2],
    );
    if (isLiveChesscomCallback(callback)) {
      throw new Error(LIVE_GAME_MESSAGE_PT);
    }
    return;
  }

  let exportResponse: Response;
  try {
    exportResponse = await fetch(lichessExportUrl(gameId, { pgnInJson: true }), {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Falha de rede");
  }
  if (!exportResponse.ok) {
    throw new Error(formatLichessExportHttpError(exportResponse.status));
  }
  const game = (await exportResponse.json()) as { status?: string };
  if (isLiveStatus(game.status ?? "")) {
    throw new Error(LIVE_GAME_MESSAGE_PT);
  }
}

async function openReviewPanel(
  gameId: string,
  tabId: number | undefined,
): Promise<{ gameId: string; opened: boolean }> {
  await assertReviewableBeforeOpen(gameId);

  await chrome.storage.session.set({ [SESSION_KEY]: gameId });

  let opened = false;
  if (tabId !== undefined) {
    await chrome.sidePanel.setOptions({ tabId, path: "sidepanel.html", enabled: true });
    await chrome.sidePanel.open({ tabId });
    opened = true;
  }

  return { gameId, opened };
}
