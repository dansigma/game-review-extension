export type BackgroundRequest =
  | { type: "lichess-export"; gameId: string }
  | { type: "lichess-tv" };

export type BackgroundResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error("sidePanel.setPanelBehavior failed", error);
  });

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void,
  ) => {
    void handle(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        sendResponse({ ok: false, error: text });
      });
    return true;
  },
);

async function handle(message: BackgroundRequest): Promise<unknown> {
  if (message.type === "lichess-export") {
    const response = await fetch(
      `https://lichess.org/game/export/${message.gameId}`,
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
  throw new Error("Unknown background message");
}
