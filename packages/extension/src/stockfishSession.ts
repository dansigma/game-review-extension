import {
  isBestMove,
  isReadyOk,
  isUciOk,
  parseInfoLine,
  type UciInfo,
} from "./uci.ts";
import type { EngineCommand, EngineEvent } from "./engineWorker.ts";

export interface AnalyzePositionArgs {
  fen: string;
  go: string;
  multipv?: number;
}

export interface PositionAnalysis {
  bestMove: string;
  lines: UciInfo[];
  nodes?: number;
  nps?: number;
  elapsedMs: number;
}

export class StockfishSession {
  private readonly worker: Worker;
  private readonly waiters: Array<(line: string) => void> = [];
  private ready: Promise<EngineEvent & { type: "ready" }>;

  constructor(assetBase: string) {
    this.worker = new Worker(new URL("./engineWorker.ts", import.meta.url), {
      type: "module",
    });
    this.ready = new Promise((resolve, reject) => {
      this.worker.addEventListener("message", (event: MessageEvent<EngineEvent>) => {
        const payload = event.data;
        if (payload.type === "ready") {
          resolve(payload);
          return;
        }
        if (payload.type === "error") {
          reject(new Error(payload.message));
          return;
        }
        if (payload.type === "line") {
          for (const waiter of this.waiters) {
            waiter(payload.line);
          }
        }
      });
      this.send({ type: "init", assetBase });
    });
  }

  async init(): Promise<EngineEvent & { type: "ready" }> {
    return this.ready;
  }

  dispose(): void {
    this.send({ type: "dispose" });
    this.worker.terminate();
  }

  async handshake(): Promise<string[]> {
    await this.init();
    const lines: string[] = [];
    await this.sendAndCollect("uci", (line) => {
      lines.push(line);
      return isUciOk(line);
    });
    this.sendUci("setoption name MultiPV value 2");
    this.sendUci("setoption name Threads value 1");
    this.sendUci("setoption name Hash value 64");
    await this.sendAndCollect("isready", isReadyOk);
    return lines;
  }

  async analyzePosition(args: AnalyzePositionArgs): Promise<PositionAnalysis> {
    await this.init();
    const multipv = args.multipv ?? 2;
    this.sendUci(`setoption name MultiPV value ${multipv}`);
    this.sendUci(`position fen ${args.fen}`);
    const started = performance.now();
    const infos: UciInfo[] = [];
    let bestMove = "";
    let nodes: number | undefined;
    let nps: number | undefined;
    await this.sendAndCollect(`go ${args.go}`, (line) => {
      const info = parseInfoLine(line);
      if (info) {
        if (info.nodes !== undefined) {
          nodes = info.nodes;
        }
        if (info.nps !== undefined) {
          nps = info.nps;
        }
        if (info.score && info.pv && info.pv.length > 0) {
          infos.push(info);
        }
      }
      if (isBestMove(line)) {
        bestMove = line.split(/\s+/)[1] ?? "";
        return true;
      }
      return false;
    });
    const latestByPv = new Map<number, UciInfo>();
    for (const info of infos) {
      latestByPv.set(info.multipv ?? 1, info);
    }
    return {
      bestMove,
      lines: [...latestByPv.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, info]) => info),
      nodes,
      nps,
      elapsedMs: performance.now() - started,
    };
  }

  private sendUci(command: string): void {
    this.send({ type: "uci", command });
  }

  private send(command: EngineCommand): void {
    this.worker.postMessage(command);
  }

  private sendAndCollect(
    command: string,
    done: (line: string) => boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for engine after: ${command}`));
      }, 120_000);
      const onLine = (line: string) => {
        try {
          if (done(line)) {
            cleanup();
            resolve();
          }
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const cleanup = () => {
        clearTimeout(timeout);
        const index = this.waiters.indexOf(onLine);
        if (index >= 0) {
          this.waiters.splice(index, 1);
        }
      };
      this.waiters.push(onLine);
      this.sendUci(command);
    });
  }
}

export const KIWIPETE_FEN =
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
