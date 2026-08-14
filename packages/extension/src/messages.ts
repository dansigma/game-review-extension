import type { ChesscomGameKind } from "./chesscomExport.ts";

export type BackgroundRequest =
  | { type: "lichess-export"; gameId: string }
  | { type: "lichess-tv" }
  | { type: "chesscom-callback"; kind: ChesscomGameKind; id: string }
  | {
      type: "chesscom-archive";
      username: string;
      year: number;
      month: number;
    }
  | { type: "open-review"; gameId: string }
  | { type: "get-active-game" };

export type BackgroundResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type ActiveGameData = {
  gameId: string;
};
