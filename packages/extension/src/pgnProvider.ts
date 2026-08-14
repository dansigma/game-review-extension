import { parsePgn, PgnParseError, type NormalizedGame } from "@game-review/core";
import { LICHESS_GAME_ID_RE } from "./lichessExport.ts";

export class PgnProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PgnProviderError";
  }
}

export const EMPTY_PGN_MESSAGE_PT = "PGN vazio";
export const MULTI_GAME_MESSAGE_PT =
  "Arquivo com várias partidas — cole apenas uma partida por vez";
export const NO_MOVES_MESSAGE_PT = "PGN sem jogadas";

function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function headerTagValue(pgn: string, tag: string): string | undefined {
  const re = new RegExp(`\\[${tag}\\s+"([^"]*)"]`, "i");
  return re.exec(pgn)?.[1];
}

function lichessIdFromPgn(trimmedPgn: string): string | undefined {
  const gameId = headerTagValue(trimmedPgn, "GameId");
  if (gameId && LICHESS_GAME_ID_RE.test(gameId)) {
    return gameId;
  }
  const site = headerTagValue(trimmedPgn, "Site") ?? "";
  const fromSite = /lichess\.org\/(?:game\/)?([a-zA-Z0-9]{8})/.exec(site);
  return fromSite?.[1];
}

function assignGameId(trimmedPgn: string, parsed: NormalizedGame): string {
  const lichessId = lichessIdFromPgn(trimmedPgn);
  if (lichessId) {
    return lichessId;
  }
  if (LICHESS_GAME_ID_RE.test(parsed.gameId) && !parsed.gameId.startsWith("pgn:")) {
    return parsed.gameId;
  }
  return `pgn:${fnv1aHex(trimmedPgn)}`;
}

/** chess.js loadPgn keeps only the first game — detect a second header block. */
export function containsMultipleGames(pgn: string): boolean {
  const trimmed = pgn.trim();
  if (!trimmed) {
    return false;
  }

  const blocks = trimmed.split(/\r?\n\r?\n(?=\[)/);
  const gameBlocks = blocks.filter((block) => {
    const text = block.trim();
    if (!text.startsWith("[")) {
      return false;
    }
    const hasMoves =
      /\d+\./.test(text) || /\b(1-0|0-1|1\/2-1\/2)\b/.test(text);
    return hasMoves;
  });

  return gameBlocks.length > 1;
}

export function loadPgnGame(pgn: string): NormalizedGame {
  const trimmed = pgn.trim();
  if (!trimmed) {
    throw new PgnProviderError(EMPTY_PGN_MESSAGE_PT);
  }

  if (containsMultipleGames(trimmed)) {
    throw new PgnProviderError(MULTI_GAME_MESSAGE_PT);
  }

  let game: NormalizedGame;
  try {
    game = parsePgn(trimmed);
  } catch (error) {
    if (error instanceof PgnParseError) {
      throw error;
    }
    throw error;
  }

  if (game.moves.length === 0) {
    throw new PgnProviderError(NO_MOVES_MESSAGE_PT);
  }

  return {
    ...game,
    gameId: assignGameId(trimmed, game),
  };
}
