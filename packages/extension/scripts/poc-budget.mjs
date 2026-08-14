#!/usr/bin/env node
/**
 * PoC 3 from Node: compare go depth 16 vs go nodes on sf_18_smallnet.
 * Same engine as the MV3 Side Panel; numbers feed the MVP budget decision.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Chess } from "chess.js";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("@lichess-org/stockfish-web/package.json"));
const here = dirname(fileURLToPath(import.meta.url));
const nnuePath = join(here, "..", "public", "engine", "nn-4ca89e4b3abf.nnue");

const OPERA = `1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#`;

const KIWIPETE =
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

function fensFromPgn(pgn, limit) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const verbose = chess.history({ verbose: true });
  const fens = [verbose[0]?.before ?? chess.fen()];
  for (const move of verbose) {
    fens.push(move.after);
  }
  return fens.slice(0, limit);
}

function parseInfo(line) {
  if (!line.startsWith("info ")) return null;
  const parts = line.split(/\s+/);
  const idx = (flag) => parts.indexOf(flag);
  const num = (flag) => {
    const i = idx(flag);
    return i >= 0 ? Number(parts[i + 1]) : undefined;
  };
  return { depth: num("depth"), nodes: num("nodes"), nps: num("nps"), time: num("time") };
}

async function createEngine() {
  const mod = await import(pathToFileURL(join(pkgDir, "sf_18_smallnet.js")).href);
  const engine = await mod.default({
    locateFile: (file) => join(pkgDir, file),
  });
  const nnueName = engine.getRecommendedNnue(0);
  const nnueFile = nnueName
    ? join(dirname(nnuePath), nnueName)
    : nnuePath;
  try {
    engine.setNnueBuffer(new Uint8Array(readFileSync(nnueFile)), 0);
  } catch {
    console.warn("NNUE not prefetched; engine may be weaker until copy-engine-assets runs.");
  }
  return engine;
}

function uciUntil(engine, command, predicate, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const lines = [];
    const timer = setTimeout(() => {
      engine.listen = console.log;
      reject(new Error(`timeout after ${command}`));
    }, timeoutMs);
    engine.listen = (line) => {
      lines.push(line);
      if (predicate(line)) {
        clearTimeout(timer);
        resolve(lines);
      }
    };
    engine.uci(command);
  });
}

async function analyze(engine, fen, go) {
  engine.uci("setoption name MultiPV value 2");
  engine.uci("setoption name Threads value 1");
  engine.uci(`position fen ${fen}`);
  const t0 = Date.now();
  const lines = await uciUntil(engine, `go ${go}`, (line) => line.startsWith("bestmove "));
  const infos = lines.map(parseInfo).filter(Boolean);
  const last = infos.at(-1) ?? {};
  return {
    elapsedMs: Date.now() - t0,
    nodes: last.nodes,
    nps: last.nps,
    depth: last.depth,
    bestmove: lines.at(-1)?.split(/\s+/)[1],
  };
}

const engine = await createEngine();
engine.onError = console.error;
await uciUntil(engine, "uci", (line) => line === "uciok");
await uciUntil(engine, "isready", (line) => line === "readyok");

console.log("--- single position (Kiwipete) ---");
for (const go of ["nodes 20000", "nodes 80000", "depth 12", "depth 16"]) {
  const r = await analyze(engine, KIWIPETE, go);
  console.log(go, r);
}

const plyCounts = [8];
const gos = ["nodes 80000", "depth 12"];
const fens40 = fensFromPgn(OPERA, 12);

for (const go of gos) {
  for (const n of plyCounts) {
    const slice = fens40.slice(0, Math.min(n, fens40.length));
    const t0 = Date.now();
    let nodes = 0;
    for (const fen of slice) {
      const r = await analyze(engine, fen, go);
      nodes += r.nodes ?? 0;
    }
    const elapsedMs = Date.now() - t0;
    const per = elapsedMs / slice.length;
    console.log({
      go,
      positions: slice.length,
      elapsedSec: +(elapsedMs / 1000).toFixed(2),
      msPerPos: +per.toFixed(0),
      nodes,
      estimate80Sec: +((per * 80) / 1000).toFixed(1),
      under2min80: (per * 80) / 1000 <= 120,
    });
  }
}

console.log(
  "Decision hint: prefer go nodes if depth 16 extrapolates > 120s for 80 plies.",
);
engine.uci("quit");
