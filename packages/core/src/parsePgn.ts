import { Chess, type Move } from "chess.js";
import type { GameResult, NormalizedGame, PlayerColor } from "./types.ts";

const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const STANDARD_VARIANTS = new Set(["", "standard", "chess"]);

export class PgnParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PgnParseError";
  }
}

function headerValue(
  headers: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const direct = headers[key];
  if (direct) {
    return direct;
  }
  const found = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === key.toLowerCase(),
  );
  return found?.[1];
}

function parseResult(raw: string | undefined): GameResult {
  if (raw === "1-0" || raw === "0-1" || raw === "1/2-1/2" || raw === "*") {
    return raw;
  }
  return "*";
}

function parseTimeControl(
  raw: string | undefined,
): NormalizedGame["timeControl"] {
  if (!raw || raw === "-" || raw === "?") {
    return undefined;
  }
  const match = /^(\d+)(?:\+(\d+))?$/.exec(raw.trim());
  if (!match) {
    return undefined;
  }
  const initial = match[1];
  const increment = match[2];
  if (!initial) {
    return undefined;
  }
  return {
    initialSeconds: Number(initial),
    incrementSeconds: increment ? Number(increment) : 0,
  };
}

function parseRating(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function toColor(chessColor: Move["color"]): PlayerColor {
  return chessColor === "w" ? "white" : "black";
}

function toUci(move: Move): string {
  const promotion = move.promotion ?? "";
  return `${move.from}${move.to}${promotion}`;
}

function deriveGameId(headers: Record<string, string | undefined>): string {
  const explicit = headerValue(headers, "GameId") ?? headerValue(headers, "GameId8");
  if (explicit) {
    return explicit;
  }
  const site = headerValue(headers, "Site") ?? "";
  const lichess = /lichess\.org\/(?:game\/)?([a-zA-Z0-9]{8})/.exec(site);
  if (lichess?.[1]) {
    return lichess[1];
  }
  const white = headerValue(headers, "White") ?? "white";
  const black = headerValue(headers, "Black") ?? "black";
  const date = headerValue(headers, "Date") ?? "undated";
  return `pgn:${white}-vs-${black}:${date}`;
}

function assertStandardVariant(headers: Record<string, string | undefined>): void {
  const variant = (headerValue(headers, "Variant") ?? "standard").toLowerCase();
  if (variant === "chess960" || variant === "fischerandom") {
    throw new PgnParseError("Only standard chess is supported in the MVP");
  }
  if (!STANDARD_VARIANTS.has(variant)) {
    throw new PgnParseError(`Unsupported variant: ${variant}`);
  }
}

export function parsePgn(pgn: string): NormalizedGame {
  const trimmed = pgn.trim();
  if (!trimmed) {
    throw new PgnParseError("PGN is empty");
  }

  const chess = new Chess();
  try {
    chess.loadPgn(trimmed, { strict: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid PGN";
    throw new PgnParseError(message);
  }

  const headers = chess.getHeaders() as Record<string, string | undefined>;
  assertStandardVariant(headers);

  const history = chess.history({ verbose: true });
  const initialFen = headerValue(headers, "FEN") ?? STANDARD_START_FEN;

  return {
    gameId: deriveGameId(headers),
    variant: "standard",
    result: parseResult(headerValue(headers, "Result")),
    players: {
      white: {
        name: headerValue(headers, "White") ?? "White",
        rating: parseRating(headerValue(headers, "WhiteElo")),
        title: headerValue(headers, "WhiteTitle"),
      },
      black: {
        name: headerValue(headers, "Black") ?? "Black",
        rating: parseRating(headerValue(headers, "BlackElo")),
        title: headerValue(headers, "BlackTitle"),
      },
    },
    timeControl: parseTimeControl(headerValue(headers, "TimeControl")),
    initialFen,
    termination: headerValue(headers, "Termination"),
    moves: history.map((move, ply) => ({
      ply,
      san: move.san,
      uci: toUci(move),
      fenBefore: move.before,
      fenAfter: move.after,
      color: toColor(move.color),
    })),
  };
}

export { STANDARD_START_FEN };
