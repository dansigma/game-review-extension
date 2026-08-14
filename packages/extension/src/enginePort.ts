import type { NormalizedGame, PositionEval } from "@game-review/core";
import {
  MVP_GO_COMMAND,
  MVP_MULTIPV,
  MVP_NODES_PER_POSITION,
} from "./budgetDecision.ts";
import { KIWIPETE_FEN, StockfishSession } from "./stockfishSession.ts";
import { buildPositionEval } from "./uciToPositionEval.ts";

export interface AnalyzePositionPortArgs {
  fen: string;
  go?: string;
  signal?: AbortSignal;
}

export interface AnalyzeGamePortArgs {
  game: NormalizedGame;
  nodesPerPosition?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface EnginePort {
  init(): Promise<void>;
  analyzePosition(args: AnalyzePositionPortArgs): Promise<PositionEval>;
  analyzeGame(args: AnalyzeGamePortArgs): Promise<PositionEval[]>;
  dispose(): void;
}

function goCommand(nodesPerPosition?: number): string {
  const nodes = nodesPerPosition ?? MVP_NODES_PER_POSITION;
  return `nodes ${nodes}`;
}

export class StockfishEnginePort implements EnginePort {
  private session: StockfishSession | null = null;
  private initialized = false;

  constructor(private readonly assetBase: string) {}

  async init(): Promise<void> {
    if (!this.session) {
      this.session = new StockfishSession(this.assetBase);
    }
    if (!this.initialized) {
      await this.session.handshake();
      this.initialized = true;
    }
  }

  async analyzePosition(args: AnalyzePositionPortArgs): Promise<PositionEval> {
    const session = await this.requireSession();
    const go = args.go ?? MVP_GO_COMMAND;
    const result = await session.analyzePosition({
      fen: args.fen,
      go,
      multipv: MVP_MULTIPV,
      signal: args.signal,
    });
    return buildPositionEval(args.fen, 0, result.lines);
  }

  async analyzeGame(args: AnalyzeGamePortArgs): Promise<PositionEval[]> {
    const session = await this.requireSession();
    const go = goCommand(args.nodesPerPosition);
    const fens = [args.game.initialFen, ...args.game.moves.map((move) => move.fenAfter)];
    const evals: PositionEval[] = [];

    for (let ply = 0; ply < fens.length; ply += 1) {
      if (args.signal?.aborted) {
        throw abortError(args.signal);
      }
      const fen = fens[ply];
      if (!fen) {
        continue;
      }
      const result = await session.analyzePosition({
        fen,
        go,
        multipv: MVP_MULTIPV,
        signal: args.signal,
      });
      evals.push(buildPositionEval(fen, ply, result.lines));
      args.onProgress?.(ply + 1, fens.length);
    }

    return evals;
  }

  dispose(): void {
    this.session?.dispose();
    this.session = null;
    this.initialized = false;
  }

  private async requireSession(): Promise<StockfishSession> {
    await this.init();
    if (!this.session) {
      throw new Error("Engine session is not available");
    }
    return this.session;
  }
}

export function createEnginePort(assetBase: string): EnginePort {
  return new StockfishEnginePort(assetBase);
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }
  return new DOMException("Aborted", "AbortError");
}

export { KIWIPETE_FEN };
