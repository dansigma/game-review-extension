import {
  extractGameId,
  isLiveStatus,
  type LichessExportJson,
} from "../lichessExport.ts";
import type { BackgroundResponse } from "../messages.ts";

const CTA_ROOT_ID = "game-review-cta-root";

const STYLES = `
#${CTA_ROOT_ID} {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  font: 13px/1.35 "Segoe UI", system-ui, sans-serif;
}
#${CTA_ROOT_ID} .gr-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #fff;
  background: #629924;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
#${CTA_ROOT_ID} .gr-cta-btn:hover:not(:disabled) {
  background: #73ad2c;
}
#${CTA_ROOT_ID} .gr-cta-btn:disabled {
  cursor: default;
  opacity: 0.85;
}
#${CTA_ROOT_ID} .gr-cta-live {
  padding: 8px 12px;
  border-radius: 6px;
  color: #f0ece4;
  background: #262421;
  border: 1px solid #444;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
`;

function injectStyles(): void {
  if (document.getElementById(`${CTA_ROOT_ID}-styles`)) {
    return;
  }
  const style = document.createElement("style");
  style.id = `${CTA_ROOT_ID}-styles`;
  style.textContent = STYLES;
  document.head.append(style);
}

function gameIdFromPage(): string | undefined {
  return extractGameId(window.location.href);
}

async function sendBackground<T>(message: unknown): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as BackgroundResponse;
  if (!response || response.ok !== true) {
    throw new Error(response?.error ?? "Falha na comunicação com a extensão");
  }
  return response.data as T;
}

function removeCta(): void {
  document.getElementById(CTA_ROOT_ID)?.remove();
}

function showLiveNotice(): void {
  injectStyles();
  removeCta();
  const root = document.createElement("div");
  root.id = CTA_ROOT_ID;
  const note = document.createElement("div");
  note.className = "gr-cta-live";
  note.textContent = "Partida em andamento";
  root.append(note);
  document.body.append(root);
}

function showReviewCta(gameId: string): void {
  injectStyles();
  removeCta();
  const root = document.createElement("div");
  root.id = CTA_ROOT_ID;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gr-cta-btn";
  button.textContent = "Analisar partida";
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Abrindo…";
    void chrome.runtime
      .sendMessage({ type: "open-review", gameId })
      .then((response: BackgroundResponse) => {
        if (!response?.ok) {
          throw new Error(response?.error ?? "Falha ao abrir");
        }
        button.textContent = "Analisar partida";
        button.disabled = false;
      })
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        button.textContent = "Erro — tentar de novo";
        button.disabled = false;
        console.error("[game-review] open-review failed", text);
      });
  });
  root.append(button);
  document.body.append(root);
}

let refreshToken = 0;

async function refreshCta(): Promise<void> {
  const token = ++refreshToken;
  const gameId = gameIdFromPage();
  if (!gameId) {
    removeCta();
    return;
  }

  try {
    const json = await sendBackground<LichessExportJson>({
      type: "lichess-export",
      gameId,
    });
    if (token !== refreshToken) {
      return;
    }
    if (isLiveStatus(json.status)) {
      showLiveNotice();
      return;
    }
    showReviewCta(gameId);
  } catch (error) {
    if (token !== refreshToken) {
      return;
    }
    console.warn("[game-review] export check failed", error);
    removeCta();
  }
}

function onNavigation(): void {
  void refreshCta();
}

let lastHref = location.href;

function watchNavigation(): void {
  const check = (): void => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      onNavigation();
    }
  };
  window.addEventListener("popstate", onNavigation);
  window.addEventListener("hashchange", onNavigation);
  new MutationObserver(check).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

void refreshCta();
watchNavigation();
