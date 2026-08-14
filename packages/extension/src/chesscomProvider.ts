import { parsePgn, type NormalizedGame } from "@game-review/core";
import {
  ARCHIVE_NOT_READY_MESSAGE_PT,
  findArchiveGame,
  parseArchiveDate,
  type ChesscomArchiveGame,
  type ChesscomArchiveJson,
  type ChesscomCallbackJson,
  type ChesscomGameKind,
  type ChesscomGameRef,
  buildChesscomTaggedGameId,
  parseChesscomTaggedGameId,
  isChesscomTaggedGameId,
  fetchChesscomArchive,
  fetchChesscomCallback,
} from "./chesscomExport.ts";
import { LIVE_GAME_MESSAGE_PT } from "./lichessProvider.ts";

export { LIVE_GAME_MESSAGE_PT };

export class ChesscomProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChesscomProviderError";
  }
}

export function isLiveChesscomCallback(json: ChesscomCallbackJson): boolean {
  return json.game?.isFinished !== true;
}

function normalizeUsername(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isStandardChessCallback(json: ChesscomCallbackJson): boolean {
  const type = json.game?.type?.toLowerCase();
  if (type && type !== "chess") {
    return false;
  }

  const headers = json.game?.pgnHeaders;
  const variant = headers?.Variant?.trim().toLowerCase();
  if (variant && variant !== "standard") {
    return false;
  }

  const setup = headers?.SetUp?.trim();
  if (setup === "1") {
    return false;
  }

  return true;
}

export function assertReviewableChesscomCallback(json: ChesscomCallbackJson): void {
  if (isLiveChesscomCallback(json)) {
    throw new ChesscomProviderError(LIVE_GAME_MESSAGE_PT);
  }
  if (!isStandardChessCallback(json)) {
    const type = json.game?.type ?? json.game?.pgnHeaders?.Variant ?? "unknown";
    throw new ChesscomProviderError(`Variante não suportada: ${type}`);
  }
}

export function assertReviewableArchiveGame(game: ChesscomArchiveGame): void {
  if (game.rules !== "chess") {
    throw new ChesscomProviderError(`Variante não suportada: ${game.rules}`);
  }
  if (!game.pgn?.trim()) {
    throw new ChesscomProviderError("PGN ausente no arquivo público do Chess.com");
  }
}

export function archiveGameToNormalizedGame(
  archiveGame: ChesscomArchiveGame,
  taggedGameId: string,
): NormalizedGame {
  assertReviewableArchiveGame(archiveGame);
  const game = parsePgn(archiveGame.pgn);
  return { ...game, gameId: taggedGameId };
}

async function loadArchiveForPlayer(
  username: string,
  year: number,
  month: number,
  kind: ChesscomGameKind,
  id: string,
  fetchArchive: (
    username: string,
    year: number,
    month: number,
  ) => Promise<ChesscomArchiveJson>,
): Promise<ChesscomArchiveGame | undefined> {
  const archive = await fetchArchive(username, year, month);
  return findArchiveGame(archive, kind, id);
}

export async function loadChesscomGameFromSources(
  ref: ChesscomGameRef,
  fetchCallback: (kind: ChesscomGameKind, id: string) => Promise<ChesscomCallbackJson>,
  fetchArchive: (
    username: string,
    year: number,
    month: number,
  ) => Promise<ChesscomArchiveJson>,
): Promise<NormalizedGame> {
  const callback = await fetchCallback(ref.kind, ref.id);
  assertReviewableChesscomCallback(callback);

  const headers = callback.game?.pgnHeaders;
  const archiveDate = parseArchiveDate(headers?.Date);
  if (!archiveDate) {
    throw new ChesscomProviderError("Data da partida ausente no Chess.com");
  }

  const whiteUsername = normalizeUsername(headers?.White);
  const blackUsername = normalizeUsername(headers?.Black);
  const players = [whiteUsername, blackUsername].filter(
    (username): username is string => username !== undefined,
  );

  if (players.length === 0) {
    throw new ChesscomProviderError("Jogadores ausentes no Chess.com");
  }

  let archiveGame: ChesscomArchiveGame | undefined;
  for (const username of players) {
    archiveGame = await loadArchiveForPlayer(
      username,
      archiveDate.year,
      archiveDate.month,
      ref.kind,
      ref.id,
      fetchArchive,
    );
    if (archiveGame) {
      break;
    }
  }

  if (!archiveGame) {
    throw new ChesscomProviderError(ARCHIVE_NOT_READY_MESSAGE_PT);
  }

  const taggedGameId = buildChesscomTaggedGameId(ref.kind, ref.id);
  return archiveGameToNormalizedGame(archiveGame, taggedGameId);
}

export async function loadChesscomGame(
  gameId: string,
  fetchCallback: (kind: ChesscomGameKind, id: string) => Promise<ChesscomCallbackJson> = fetchChesscomCallback,
  fetchArchive: (
    username: string,
    year: number,
    month: number,
  ) => Promise<ChesscomArchiveJson> = fetchChesscomArchive,
): Promise<NormalizedGame> {
  const ref = parseChesscomTaggedGameId(gameId);
  if (!ref) {
    throw new ChesscomProviderError("ID de partida Chess.com inválido");
  }
  return loadChesscomGameFromSources(ref, fetchCallback, fetchArchive);
}

export { isChesscomTaggedGameId, parseChesscomTaggedGameId, buildChesscomTaggedGameId };
