import {
  extractGameId,
  isLiveStatus,
  summarizeExport,
  type LichessExportJson,
} from "./lichessExport.ts";
import {
  KIWIPETE_FEN,
  StockfishSession,
} from "./stockfishSession.ts";
import { parsePgn } from "@game-review/core";
import { MVP_GO_COMMAND } from "./budgetDecision.ts";

const logEl = document.querySelector("#log");
const statusEl = document.querySelector("#status");

function log(message: string): void {
  if (!(logEl instanceof HTMLElement)) {
    return;
  }
  const time = new Date().toISOString().slice(11, 19);
  logEl.textContent += `[${time}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

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

async function runPoc1(): Promise<void> {
  setStatus("PoC 1: loading sf_18_smallnet…");
  const session = new StockfishSession(assetBase());
  try {
    const ready = await session.init();
    log(`Engine ready: ${ready.engineName} nnue=${ready.nnue ?? "?"}`);
    const uciLines = await session.handshake();
    const nameLine = uciLines.find((line) => line.startsWith("id name"));
    log(nameLine ?? "uciok (no id name line)");
    log("MultiPV=2, Threads=1, Hash=64");
    const result = await session.analyzePosition({
      fen: KIWIPETE_FEN,
      go: "nodes 20000",
      multipv: 2,
    });
    log(`bestmove ${result.bestMove} (${result.elapsedMs.toFixed(0)} ms, nodes=${result.nodes ?? "?"})`);
    for (const line of result.lines) {
      log(
        `  multipv ${line.multipv ?? 1} score ${line.score?.type} ${line.score?.value} pv ${(line.pv ?? []).slice(0, 6).join(" ")}`,
      );
    }
    if (result.lines.length < 2) {
      throw new Error("Expected MultiPV=2 lines");
    }
    setStatus("PoC 1 passed: UCI + MultiPV=2 on Kiwipete.");
  } finally {
    session.dispose();
  }
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
  const session = new StockfishSession(assetBase());
  try {
    await session.handshake();
    const started = performance.now();
    let totalNodes = 0;
    for (let i = 0; i < positions.length; i += 1) {
      const fen = positions[i];
      if (!fen) {
        continue;
      }
      const result = await session.analyzePosition({ fen, go: args.go, multipv: 2 });
      totalNodes += result.nodes ?? 0;
      if (i === 0 || i === positions.length - 1 || (i + 1) % 10 === 0) {
        log(
          `  ply ${i + 1}/${positions.length} ${result.elapsedMs.toFixed(0)}ms nodes=${result.nodes ?? "?"}`,
        );
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
  } finally {
    session.dispose();
  }
}

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

log("Side Panel PoCs. Engine stays here (dies if the panel closes). Threads=1, no SAB required by us.");
setStatus("Idle");
