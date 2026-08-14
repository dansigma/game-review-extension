import {
  extractGameId,
  isLiveStatus,
  summarizeExport,
  type LichessExportJson,
} from "./lichessExport.ts";
import { loadLichessGame } from "./lichessProvider.ts";
import { loadPgnGame } from "./pgnProvider.ts";
import {
  gameCardHint,
  isLichessSessionGameId,
  type GameLoadSource,
} from "./gameCardDisplay.ts";
import type { ActiveGameData } from "./messages.ts";
import {
  createEnginePort,
  KIWIPETE_FEN,
  type EnginePort,
} from "./enginePort.ts";
import type { NormalizedGame, GameReview } from "@game-review/core";
import { parsePgn } from "@game-review/core";
import { MVP_GO_COMMAND } from "./budgetDecision.ts";
import { reviewGameWithEngine } from "./reviewWithEngine.ts";
import { getCachedReview, putCachedReview } from "./reviewCache.ts";
import { reviewCacheParams } from "./reviewCacheParams.ts";
import { shouldPutCachedReview } from "./analysisCachePolicy.ts";
import { estimateRemainingMs } from "./analysisEta.ts";
import { formatReviewError } from "./reviewErrors.ts";
import { fullMoveCount } from "./gameMoves.ts";
import {
  GameReviewPanel,
  queryGameReviewPanel,
} from "./ui/gameReviewPanel.ts";

const logEl = document.querySelector("#log");
const statusEl = document.querySelector("#status");
const activeGameIdEl = document.querySelector("#active-game-id");
const gameIdHintEl = document.querySelector("#game-id-hint");
const gameIdInput = document.querySelector("#game-id");
const loadGameButton = document.querySelector("#load-game");
const pgnInput = document.querySelector("#pgn-input");
const loadPgnButton = document.querySelector("#load-pgn");
const pgnFileInput = document.querySelector("#pgn-file");
const pgnFileButton = document.querySelector("#pgn-file-button");
const gameSummaryEl = document.querySelector("#game-summary");
const gamePlayersEl = document.querySelector("#game-players");
const gameResultEl = document.querySelector("#game-result");
const gameMovesCountEl = document.querySelector("#game-moves-count");
const loadErrorEl = document.querySelector("#load-error");

let activeGameId: string | null = null;
let autoLoadAttemptedFor: string | null = null;
let loadedGame: NormalizedGame | null = null;
let analysisEngine: EnginePort | null = null;
let analysisAbort: AbortController | null = null;

const reviewPanel = new GameReviewPanel(queryGameReviewPanel(document));

function selectedReviewCacheParams(gameId: string) {
  return reviewCacheParams(gameId, reviewPanel.getNodesPerPosition());
}

async function tryShowCachedReview(game: NormalizedGame): Promise<boolean> {
  try {
    const cached = await getCachedReview(selectedReviewCacheParams(game.gameId));
    if (!cached) {
      return false;
    }
    reviewPanel.showReview(cached, game);
    setStatus("Análise em cache");
    log(`cache hit ${game.gameId}`);
    return true;
  } catch (error: unknown) {
    log(`cache read failed: ${formatReviewError(error)}`);
    return false;
  }
}

function log(message: string): void {
  if (!(logEl instanceof HTMLElement)) {
    return;
  }
  const time = new Date().toISOString().slice(11, 19);
  logEl.textContent += `[${time}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function setSessionLichessGameId(gameId: string | null): void {
  activeGameId = gameId;
  if (activeGameIdEl instanceof HTMLElement) {
    activeGameIdEl.textContent = gameId ?? "—";
  }
  if (gameIdHintEl instanceof HTMLElement) {
    gameIdHintEl.textContent = gameCardHint(gameId ? "lichess" : null);
  }
  if (gameIdInput instanceof HTMLInputElement && gameId) {
    gameIdInput.value = gameId;
  }
  if (loadGameButton instanceof HTMLButtonElement) {
    loadGameButton.disabled = !isLichessSessionGameId(gameId);
  }
  if (!gameId) {
    clearGameSummary();
  }
}

function showLoadedGameCard(gameId: string, source: GameLoadSource): void {
  if (activeGameIdEl instanceof HTMLElement) {
    activeGameIdEl.textContent = gameId;
  }
  if (gameIdHintEl instanceof HTMLElement) {
    gameIdHintEl.textContent = gameCardHint(source);
  }
}

function clearGameSummary(): void {
  loadedGame = null;
  reviewPanel.setGame(null);
  if (gameSummaryEl instanceof HTMLElement) {
    gameSummaryEl.hidden = true;
  }
  if (loadErrorEl instanceof HTMLElement) {
    loadErrorEl.hidden = true;
    loadErrorEl.textContent = "";
    loadErrorEl.classList.remove("error");
  }
}

function showLoadError(message: string): void {
  if (gameSummaryEl instanceof HTMLElement) {
    gameSummaryEl.hidden = true;
  }
  if (loadErrorEl instanceof HTMLElement) {
    loadErrorEl.hidden = false;
    loadErrorEl.textContent = message;
    loadErrorEl.classList.add("error");
  }
}

function showGameSummary(game: NormalizedGame): void {
  if (loadErrorEl instanceof HTMLElement) {
    loadErrorEl.hidden = true;
    loadErrorEl.textContent = "";
    loadErrorEl.classList.remove("error");
  }
  if (gameSummaryEl instanceof HTMLElement) {
    gameSummaryEl.hidden = false;
  }
  if (gamePlayersEl instanceof HTMLElement) {
    const whiteRating = game.players.white.rating ? ` (${game.players.white.rating})` : "";
    const blackRating = game.players.black.rating ? ` (${game.players.black.rating})` : "";
    gamePlayersEl.textContent = `${game.players.white.name}${whiteRating} vs ${game.players.black.name}${blackRating}`;
  }
  if (gameResultEl instanceof HTMLElement) {
    gameResultEl.textContent = `Resultado: ${game.result}`;
  }
  if (gameMovesCountEl instanceof HTMLElement) {
    gameMovesCountEl.textContent = `Jogadas: ${fullMoveCount(game.moves.length)}`;
  }
}

async function fetchLichessExport(gameId: string): Promise<LichessExportJson> {
  return (await sendBackground({
    type: "lichess-export",
    gameId,
  })) as LichessExportJson;
}

async function finishLoadingGame(
  game: NormalizedGame,
  source: GameLoadSource,
): Promise<void> {
  showLoadedGameCard(game.gameId, source);
  loadedGame = game;
  showGameSummary(game);
  reviewPanel.setGame(game);
  const fromCache = await tryShowCachedReview(game);
  if (!fromCache) {
    setStatus(`Partida ${game.gameId} carregada`);
  }
  log(
    `loaded ${game.gameId}: ${game.players.white.name} vs ${game.players.black.name}, ${game.result}, ${game.moves.length} plies`,
  );
}

async function loadActiveGame(): Promise<void> {
  if (!isLichessSessionGameId(activeGameId)) {
    return;
  }
  setStatus(`Carregando ${activeGameId}…`);
  clearGameSummary();
  try {
    const game = await loadLichessGame(activeGameId, fetchLichessExport);
    await finishLoadingGame(game, "lichess");
  } catch (error: unknown) {
    const text = formatReviewError(error);
    showLoadError(text);
    setStatus("Falha ao carregar partida");
    log(`load failed: ${text}`);
  }
}

async function loadFromPgn(pgn: string): Promise<void> {
  setStatus("Carregando PGN…");
  clearGameSummary();
  try {
    const game = loadPgnGame(pgn);
    await finishLoadingGame(game, "pgn");
  } catch (error: unknown) {
    const text = formatReviewError(error);
    showLoadError(text);
    setStatus("Falha ao carregar PGN");
    log(`pgn load failed: ${text}`);
  }
}

function maybeAutoLoadGame(gameId: string): void {
  if (autoLoadAttemptedFor === gameId) {
    return;
  }
  autoLoadAttemptedFor = gameId;
  void loadActiveGame();
}

async function gameIdFromActiveTab(): Promise<string | undefined> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const url = tabs[0]?.url;
  return url ? extractGameId(url) : undefined;
}

async function loadActiveGameFromSession(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "get-active-game" });
  if (response && response.ok === true) {
    const data = response.data as ActiveGameData | null;
    if (data?.gameId) {
      setSessionLichessGameId(data.gameId);
      setStatus(`Partida ${data.gameId}`);
      maybeAutoLoadGame(data.gameId);
      return;
    }
  }

  try {
    const fromTab = await gameIdFromActiveTab();
    if (!fromTab) {
      return;
    }
    setSessionLichessGameId(fromTab);
    setStatus(`Partida ${fromTab}`);
    maybeAutoLoadGame(fromTab);
  } catch (error: unknown) {
    log(`tab game id: ${formatReviewError(error)}`);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "session" || !changes.activeGameId) {
    return;
  }
  const next = changes.activeGameId.newValue;
  if (typeof next === "string" && next.length > 0) {
    setSessionLichessGameId(next);
    setStatus(`Partida ${next}`);
    maybeAutoLoadGame(next);
  }
});

function setStatus(text: string): void {
  if (statusEl instanceof HTMLElement) {
    statusEl.textContent = text;
  }
}

async function sendBackground(
  message: { type: "lichess-export"; gameId: string } | { type: "lichess-tv" },
): Promise<unknown> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.ok !== true) {
    throw new Error(response?.error ?? "Background request failed");
  }
  return response.data;
}

function assetBase(): string {
  return chrome.runtime.getURL("engine/");
}

async function withEngine<T>(fn: (engine: EnginePort) => Promise<T>): Promise<T> {
  const engine = createEnginePort(assetBase());
  try {
    await engine.init();
    return await fn(engine);
  } finally {
    engine.dispose();
  }
}

async function runPoc1(): Promise<void> {
  setStatus("PoC 1: loading sf_18_smallnet…");
  await withEngine(async (engine) => {
    const result = await engine.analyzePosition({
      fen: KIWIPETE_FEN,
      go: "nodes 20000",
    });
    log(`bestmove ${result.lines[0]?.pv[0] ?? "?"} (MultiPV=${result.lines.length})`);
    for (const line of result.lines) {
      log(
        `  multipv ${line.multipv} score ${line.score.type} ${line.score.value} pv ${line.pv.slice(0, 6).join(" ")}`,
      );
    }
    if (result.lines.length < 2) {
      throw new Error("Expected MultiPV=2 lines");
    }
    setStatus("PoC 1 passed: UCI + MultiPV=2 on Kiwipete.");
  });
}

async function runPoc2(): Promise<void> {
  const input = document.querySelector("#game-id");
  const raw = input instanceof HTMLInputElement ? input.value : "";
  const gameId = extractGameId(raw);
  if (!gameId) {
    throw new Error("Need an 8-character Lichess id or URL");
  }
  setStatus(`PoC 2: GET /game/export/${gameId}`);
  const json = (await sendBackground({
    type: "lichess-export",
    gameId,
  })) as LichessExportJson;
  const summary = summarizeExport(json);
  log(JSON.stringify(summary, null, 2));
  if (isLiveStatus(json.status)) {
    log("LIVE game (status=started) — engine must NOT run. Rejected.");
    setStatus("PoC 2: live game detected and rejected.");
    return;
  }
  setStatus(`PoC 2 passed: ${summary.id} status=${summary.status} plies=${summary.plyCount}`);
}

async function runPoc2Samples(): Promise<void> {
  setStatus("PoC 2: public finished + TV live…");
  const finishedId = "8fuPHGyu";
  const finished = (await sendBackground({
    type: "lichess-export",
    gameId: finishedId,
  })) as LichessExportJson;
  log(`public finished ${finishedId}: status=${finished.status} live=${isLiveStatus(finished.status)}`);
  if (isLiveStatus(finished.status)) {
    throw new Error("Expected 8fuPHGyu to be finished");
  }

  const tv = (await sendBackground({ type: "lichess-tv" })) as Record<
    string,
    { gameId?: string } | undefined
  >;
  const liveId = tv.blitz?.gameId ?? tv.rapid?.gameId ?? tv.best?.gameId;
  if (!liveId) {
    log("TV channels had no gameId; skipped live check.");
    setStatus("PoC 2: finished game ok; no live TV id.");
    return;
  }
  const live = (await sendBackground({
    type: "lichess-export",
    gameId: liveId,
  })) as LichessExportJson;
  log(`tv live ${liveId}: status=${live.status} live=${isLiveStatus(live.status)}`);
  setStatus("PoC 2 samples done (finished vs TV).");
}

const OPERA_PGN = `[Event "Opera Game"]
[White "Morphy"]
[Black "Allies"]
[Result "1-0"]
[Variant "Standard"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

async function runBudget(args: {
  plyLimit: number;
  go: string;
  label: string;
}): Promise<void> {
  const game = parsePgn(OPERA_PGN);
  const fens = [game.initialFen, ...game.moves.map((move) => move.fenAfter)];
  const positions = fens.slice(0, args.plyLimit);
  setStatus(`PoC 3: ${args.label} × ${positions.length} positions`);
  await withEngine(async (engine) => {
    const started = performance.now();
    let totalNodes = 0;
    for (let i = 0; i < positions.length; i += 1) {
      const fen = positions[i];
      if (!fen) {
        continue;
      }
      const result = await engine.analyzePosition({ fen, go: args.go });
      totalNodes += result.lines[0]?.nodes ?? 0;
      if (i === 0 || i === positions.length - 1 || (i + 1) % 10 === 0) {
        log(`  ply ${i + 1}/${positions.length} nodes=${result.lines[0]?.nodes ?? "?"}`);
      }
    }
    const elapsedMs = performance.now() - started;
    const perPos = elapsedMs / positions.length;
    const estimate80 = (perPos * 80) / 1000;
    log(
      `${args.label}: ${positions.length} pos in ${(elapsedMs / 1000).toFixed(1)}s, avg ${perPos.toFixed(0)} ms/pos, nodes=${totalNodes}`,
    );
    log(`  Extrapolated 80 plies: ${estimate80.toFixed(1)}s (target ≤ 120s)`);
    setStatus(`PoC 3 ${args.label} done.`);
  });
}

loadGameButton?.addEventListener("click", () => {
  void loadActiveGame();
});

loadPgnButton?.addEventListener("click", () => {
  const raw = pgnInput instanceof HTMLTextAreaElement ? pgnInput.value : "";
  void loadFromPgn(raw);
});

pgnFileButton?.addEventListener("click", () => {
  if (pgnFileInput instanceof HTMLInputElement) {
    pgnFileInput.click();
  }
});

pgnFileInput?.addEventListener("change", () => {
  if (!(pgnFileInput instanceof HTMLInputElement)) {
    return;
  }
  const file = pgnFileInput.files?.[0];
  if (!file) {
    return;
  }
  void file
    .text()
    .then((text) => loadFromPgn(text))
    .catch((error: unknown) => {
      const text = formatReviewError(error);
      showLoadError(text);
      setStatus("Falha ao ler arquivo");
      log(`pgn file read failed: ${text}`);
    })
    .finally(() => {
      pgnFileInput.value = "";
    });
});

function cancelAnalysis(): void {
  analysisAbort?.abort();
}

function restoreAfterCancelledAnalysis(
  previousReview: GameReview | null,
  game: NormalizedGame,
): void {
  if (previousReview) {
    reviewPanel.showReview(previousReview, game);
  } else {
    reviewPanel.showAnalyzeReady();
  }
}

async function runGameReview(options?: { bypassCache?: boolean }): Promise<void> {
  if (!loadedGame) {
    return;
  }
  if (analysisEngine) {
    return;
  }

  const game = loadedGame;
  const nodesPerPosition = reviewPanel.getNodesPerPosition();
  const bypassCache = options?.bypassCache ?? false;

  if (!bypassCache) {
    const cached = await getCachedReview(selectedReviewCacheParams(game.gameId));
    if (cached) {
      reviewPanel.showReview(cached, game);
      setStatus("Carregada do cache");
      log(`cache hit ${game.gameId} (analyze skipped)`);
      return;
    }
  }

  const previousReview = bypassCache ? reviewPanel.getReview() : null;
  const total = game.moves.length + 1;
  analysisAbort = new AbortController();
  const { signal } = analysisAbort;
  const analysisStartedAt = performance.now();

  analysisEngine = createEnginePort(assetBase());
  reviewPanel.showAnalyzing(0, total);
  setStatus("Analisando partida…");

  try {
    await analysisEngine.init();
    const review = await reviewGameWithEngine(analysisEngine, {
      game,
      nodesPerPosition,
      signal,
      onProgress: (done, progressTotal) => {
        const elapsedMs = performance.now() - analysisStartedAt;
        const remainingMs = estimateRemainingMs(elapsedMs, done, progressTotal);
        reviewPanel.showAnalyzing(done, progressTotal, remainingMs);
        setStatus(`Analisando… ${done}/${progressTotal}`);
      },
    });
    if (!shouldPutCachedReview(signal.aborted, review)) {
      restoreAfterCancelledAnalysis(previousReview, game);
      setStatus("Análise cancelada");
      log("analysis cancelled");
      return;
    }
    await putCachedReview(review);
    reviewPanel.showReview(review, game);
    setStatus("Análise concluída");
    log(
      `review ${game.gameId}: white ${review.white.accuracy.toFixed(1)}% black ${review.black.accuracy.toFixed(1)}%`,
    );
  } catch (error: unknown) {
    if (signal.aborted) {
      restoreAfterCancelledAnalysis(previousReview, game);
      setStatus("Análise cancelada");
      log("analysis cancelled");
      return;
    }
    const text = formatReviewError(error);
    restoreAfterCancelledAnalysis(previousReview, game);
    setStatus(text);
    log(`analysis failed: ${text}`);
  } finally {
    analysisEngine?.dispose();
    analysisEngine = null;
    analysisAbort = null;
  }
}

reviewPanel.setHandlers({
  onAnalyze: () => {
    void runGameReview();
  },
  onReanalyze: () => {
    void runGameReview({ bypassCache: true });
  },
  onCancel: () => {
    cancelAnalysis();
  },
  onPresetChange: () => {
    void onEnginePresetChanged();
  },
});

async function onEnginePresetChanged(): Promise<void> {
  if (!loadedGame || analysisEngine) {
    return;
  }
  const fromCache = await tryShowCachedReview(loadedGame);
  if (!fromCache) {
    reviewPanel.showAnalyzeReady({ hideResults: true });
    setStatus(`Partida ${loadedGame.gameId} carregada`);
    log(`preset ${reviewPanel.getPreset()} (${reviewPanel.getNodesPerPosition()} nodes): cache miss`);
  }
}

window.addEventListener("beforeunload", () => {
  cancelAnalysis();
  analysisEngine?.dispose();
});

document.querySelector("#poc1")?.addEventListener("click", () => {
  void runPoc1().catch((error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    log(`PoC 1 failed: ${text}`);
    setStatus("PoC 1 failed");
  });
});

document.querySelector("#poc2")?.addEventListener("click", () => {
  void runPoc2().catch((error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    log(`PoC 2 failed: ${text}`);
    setStatus("PoC 2 failed");
  });
});

document.querySelector("#poc2-samples")?.addEventListener("click", () => {
  void runPoc2Samples().catch((error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    log(`PoC 2 samples failed: ${text}`);
    setStatus("PoC 2 samples failed");
  });
});

document.querySelector("#poc3-nodes")?.addEventListener("click", () => {
  void runBudget({ plyLimit: 40, go: MVP_GO_COMMAND, label: `go ${MVP_GO_COMMAND}` }).catch(
    (error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      log(`PoC 3 failed: ${text}`);
      setStatus("PoC 3 failed");
    },
  );
});

document.querySelector("#poc3-depth")?.addEventListener("click", () => {
  void runBudget({ plyLimit: 16, go: "depth 16", label: "go depth 16 (16 pos sample)" }).catch(
    (error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      log(`PoC 3 failed: ${text}`);
      setStatus("PoC 3 failed");
    },
  );
});

document.querySelector("#poc3-80")?.addEventListener("click", () => {
  void runBudget({ plyLimit: 33, go: MVP_GO_COMMAND, label: `go ${MVP_GO_COMMAND} opera (33 plies)` }).catch(
    (error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      log(`PoC 3 failed: ${text}`);
      setStatus("PoC 3 failed");
    },
  );
});

log(
  "Side Panel pronto. Engine no painel (fecha o painel, cancela). Threads=1; SharedArrayBuffer exigido pelo sf_18_smallnet (COOP/COEP).",
);
setStatus("Aguardando");
void loadActiveGameFromSession();
