import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { isBestMove, isReadyOk, isUciOk, parseInfoLine, type UciInfo } from "./uci.ts";
import type { EngineLine, PositionEval } from "../../core/src/types.ts";

export const BENCHMARK_NODES_PER_POSITION = 50_000;
export const BENCHMARK_MULTIPV = 2;
export const BENCHMARK_ENGINE_ID = "sf_16_nodes_50k";
export const BENCHMARK_DEPTH_FALLBACK = 12;

function findStockfishBinary(): string | null {
  const env = process.env.STOCKFISH_PATH;
  if (env && existsSync(env)) return env;
  const candidates = [
    "/tmp/stockfish/stockfish-ubuntu-x86-64-avx2",
    "/tmp/stockfish/stockfish-ubuntu-x86-64",
    "/usr/local/bin/stockfish",
    "/usr/games/stockfish",
    "/usr/bin/stockfish",
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

function uciInfosToEngineLines(infos: readonly UciInfo[]): EngineLine[] {
  const latestByPv = new Map<number, UciInfo>();
  for (const info of infos) {
    if (info.score) {
      // Keep latest per multipv even if pv is missing (mate 0 checkmate has no pv)
      const existing = latestByPv.get(info.multipv ?? 1);
      // Prefer entry with pv over one without
      if (!existing || (info.pv && info.pv.length > 0 && (!existing.pv || existing.pv.length === 0))) {
        latestByPv.set(info.multipv ?? 1, info);
      } else if (!latestByPv.has(info.multipv ?? 1)) {
        latestByPv.set(info.multipv ?? 1, info);
      }
    }
  }
  // Filter to those that have a score; for missing pv, synthesize dummy pv for mate
  return [...latestByPv.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, info]) => {
      const score = info.score;
      if (!score) throw new Error("Incomplete UCI info line");
      const pv = info.pv && info.pv.length > 0 ? info.pv : ["0000"];
      return {
        multipv: info.multipv ?? 1,
        depth: info.depth ?? 0,
        nodes: info.nodes,
        score: score as EngineLine["score"],
        pv,
      };
    });
}

export function buildPositionEval(fen: string, ply: number, infos: readonly UciInfo[]): PositionEval {
  const lines = uciInfosToEngineLines(infos);
  if (lines.length === 0) throw new Error(`No engine lines for position ply ${ply} fen ${fen}`);
  return { fen, ply, lines };
}

export interface AnalyzeArgs {
  fen: string;
  nodes?: number;
  multipv?: number;
  signal?: AbortSignal;
}

export class StockfishBinaryEngine {
  private proc: ChildProcess | null = null;
  private binaryPath: string;
  private ready: Promise<void> | null = null;
  private buffer = "";
  private lineQueue: string[] = [];
  private waiters: Array<(line: string) => boolean> = [];

  constructor(binaryPath?: string) {
    const found = binaryPath ?? findStockfishBinary();
    if (!found) {
      throw new Error(
        "Stockfish binary not found. Set STOCKFISH_PATH env or place binary at /tmp/stockfish/stockfish-ubuntu-x86-64-avx2. Tried: env, /tmp/stockfish/*, /usr/local/bin/stockfish, /usr/games/stockfish",
      );
    }
    this.binaryPath = found;
  }

  async init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = this.spawnAndHandshake();
    return this.ready;
  }

  private async spawnAndHandshake(): Promise<void> {
    this.proc = spawn(this.binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    if (!this.proc.stdout || !this.proc.stdin) throw new Error("Failed to spawn stockfish");
    this.proc.stdout.on("data", (chunk: Buffer) => this.onData(chunk.toString("utf8")));
    this.proc.stderr?.on("data", () => {});
    this.proc.on("error", (e) => {
      throw new Error(`Stockfish process error: ${e.message}`);
    });
    await this.sendAndWait("uci", isUciOk, 5000);
    this.send("setoption name MultiPV value 2");
    this.send("setoption name Threads value 1");
    this.send("setoption name Hash value 64");
    await this.sendAndWait("isready", isReadyOk, 5000);
  }

  private onData(data: string): void {
    this.buffer += data;
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      // Try to resolve waiters
      let consumed = false;
      for (let i = 0; i < this.waiters.length; i++) {
        const waiter = this.waiters[i];
        if (waiter && waiter(line)) {
          // waiter returns true when its condition is satisfied
          // but we keep lineQueue for info collection
        }
      }
      this.lineQueue.push(line);
      // Also notify any pending collector via event loop
      void consumed;
    }
  }

  private send(cmd: string): void {
    if (!this.proc?.stdin) throw new Error("Engine not initialized");
    this.proc.stdin.write(cmd + "\n");
  }

  private sendAndWait(cmd: string, predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to "${cmd}"`));
      }, timeoutMs);
      const waiter = (line: string): boolean => {
        if (predicate(line)) {
          clearTimeout(timer);
          // remove this waiter
          const idx = this.waiters.indexOf(waiter);
          if (idx >= 0) this.waiters.splice(idx, 1);
          resolve(line);
          return true;
        }
        return false;
      };
      this.waiters.push(waiter);
      this.send(cmd);
    });
  }

  async analyzePosition(args: AnalyzeArgs): Promise<PositionEval> {
    await this.init();
    const nodes = args.nodes ?? BENCHMARK_NODES_PER_POSITION;
    const multipv = args.multipv ?? BENCHMARK_MULTIPV;
    // Ensure multipv is set (in case engine reset)
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${args.fen}`);
    const infos: UciInfo[] = [];
    let bestMoveSeen = false;

    // We need to collect info lines until bestmove
    // Use a Promise that resolves on bestmove
    const collected = await new Promise<UciInfo[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout analyzing position fen=${args.fen.slice(0, 40)}`));
      }, 15000);

      const onLine = (line: string): boolean => {
        if (line.startsWith("info ")) {
          const info = parseInfoLine(line);
          if (info) infos.push(info);
        }
        if (isBestMove(line)) {
          bestMoveSeen = true;
          cleanup();
          resolve([...infos]);
          return true;
        }
        return false;
      };

      const cleanup = () => {
        clearTimeout(timer);
        const idx = this.waiters.indexOf(onLine as unknown as (line: string) => boolean);
        if (idx >= 0) this.waiters.splice(idx, 1);
      };

      this.waiters.push(onLine as unknown as (line: string) => boolean);
      this.send(`go nodes ${nodes}`);
      // also listen for abort
      args.signal?.addEventListener("abort", () => {
        try {
          this.send("stop");
        } catch {}
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

    if (!bestMoveSeen && collected.length === 0) {
      throw new Error("No engine output for position");
    }
    // Use a synthetic ply 0 here; caller will set correct ply
    return buildPositionEval(args.fen, 0, collected);
  }

  dispose(): void {
    try {
      this.send("quit");
    } catch {}
    this.proc?.kill();
    this.proc = null;
    this.ready = null;
  }

  get enginePath(): string {
    return this.binaryPath;
  }
}
