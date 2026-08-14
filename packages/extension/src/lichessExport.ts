export const LICHESS_EXPORT_URL = "https://lichess.org/game/export";

export const LICHESS_GAME_ID_RE = /^[a-zA-Z0-9]{8}$/;

export type LichessGameStatus = string;

export interface LichessExportJson {
  id: string;
  variant?: string;
  speed?: string;
  status: LichessGameStatus;
  winner?: string;
  /** Space-separated SAN (Lichess JSON). Not UCI. */
  moves?: string;
  /** Present when the export is requested with `pgnInJson=true`. */
  pgn?: string;
  createdAt?: number;
  clock?: {
    initial?: number;
    increment?: number;
  };
  players?: {
    white?: { user?: { name?: string }; rating?: number };
    black?: { user?: { name?: string }; rating?: number };
  };
}

export function isLiveStatus(status: string): boolean {
  return status === "started";
}

export function extractGameId(input: string): string | undefined {
  const trimmed = input.trim();
  if (LICHESS_GAME_ID_RE.test(trimmed)) {
    return trimmed;
  }
  const match = /lichess\.org\/(?:game\/)?([a-zA-Z0-9]{8})/.exec(trimmed);
  return match?.[1];
}

export function lichessExportUrl(
  gameId: string,
  options: { pgnInJson?: boolean } = {},
): string {
  const url = new URL(`${LICHESS_EXPORT_URL}/${gameId}`);
  if (options.pgnInJson) {
    url.searchParams.set("pgnInJson", "true");
  }
  return url.toString();
}

export async function exportLichessGame(gameId: string): Promise<LichessExportJson> {
  if (!LICHESS_GAME_ID_RE.test(gameId)) {
    throw new Error("Lichess game id must be 8 characters");
  }
  const response = await fetch(lichessExportUrl(gameId, { pgnInJson: true }), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Lichess export failed: ${response.status}`);
  }
  return (await response.json()) as LichessExportJson;
}

export function summarizeExport(game: LichessExportJson): {
  id: string;
  status: string;
  finished: boolean;
  variant: string;
  plyCount: number;
  winner?: string;
} {
  const plyCount = game.moves ? game.moves.trim().split(/\s+/).filter(Boolean).length : 0;
  return {
    id: game.id,
    status: game.status,
    finished: !isLiveStatus(game.status),
    variant: game.variant ?? "unknown",
    plyCount,
    winner: game.winner,
  };
}
