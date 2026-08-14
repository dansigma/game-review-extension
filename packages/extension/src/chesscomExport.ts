export type ChesscomGameKind = "live" | "daily";

export const CHESSCOM_TAGGED_GAME_ID_RE = /^chesscom:(live|daily):(\d+)$/;

export interface ChesscomGameRef {
  kind: ChesscomGameKind;
  id: string;
}

export interface ChesscomPgnHeaders {
  White?: string;
  Black?: string;
  Date?: string;
  Result?: string;
  FEN?: string;
  Variant?: string;
  SetUp?: string;
  WhiteElo?: string;
  BlackElo?: string;
  TimeControl?: string;
  [key: string]: string | undefined;
}

export interface ChesscomCallbackJson {
  game?: {
    isFinished?: boolean;
    pgnHeaders?: ChesscomPgnHeaders;
    type?: string;
    typeName?: string;
    moveList?: string;
  };
}

export interface ChesscomArchiveGame {
  url: string;
  pgn: string;
  rules: string;
  white?: { username?: string; rating?: number };
  black?: { username?: string; rating?: number };
}

export interface ChesscomArchiveJson {
  games?: ChesscomArchiveGame[];
}

export const ARCHIVE_NOT_READY_MESSAGE_PT =
  "Partida ainda não está no arquivo público do Chess.com — tente de novo em alguns minutos.";

export function chesscomCallbackUrl(kind: ChesscomGameKind, id: string): string {
  return `https://www.chess.com/callback/${kind}/game/${id}`;
}

export function chesscomArchiveUrl(username: string, year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${year}/${mm}`;
}

export function buildChesscomTaggedGameId(kind: ChesscomGameKind, id: string): string {
  return `chesscom:${kind}:${id}`;
}

export function parseChesscomTaggedGameId(
  gameId: string,
): { kind: ChesscomGameKind; id: string } | undefined {
  const match = CHESSCOM_TAGGED_GAME_ID_RE.exec(gameId.trim());
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return { kind: match[1] as ChesscomGameKind, id: match[2] };
}

export function isChesscomTaggedGameId(gameId: string | null): boolean {
  return gameId !== null && CHESSCOM_TAGGED_GAME_ID_RE.test(gameId);
}

const CHESSCOM_GAME_URL_RE =
  /(?:^|\/)game\/(live|daily)\/(\d+)(?:[/?#]|$)/i;

const CHESSCOM_ANALYSIS_URL_RE =
  /(?:^|\/)analysis\/game\/(live|daily)\/(\d+)(?:[/?#]|$)/i;

export function extractChesscomGameRef(input: string): ChesscomGameRef | undefined {
  const trimmed = input.trim();
  const tagged = parseChesscomTaggedGameId(trimmed);
  if (tagged) {
    return tagged;
  }

  for (const pattern of [CHESSCOM_GAME_URL_RE, CHESSCOM_ANALYSIS_URL_RE]) {
    const match = pattern.exec(trimmed);
    if (match?.[1] && match[2]) {
      return {
        kind: match[1].toLowerCase() as ChesscomGameKind,
        id: match[2],
      };
    }
  }

  return undefined;
}

export function gameUrlMatchesRef(
  gameUrl: string,
  kind: ChesscomGameKind,
  id: string,
): boolean {
  const lower = gameUrl.toLowerCase();
  return (
    lower.includes(`/game/${kind}/${id}`) ||
    lower.includes(`/analysis/game/${kind}/${id}`) ||
    lower.endsWith(`/${id}`)
  );
}

export function parseArchiveDate(dateHeader: string | undefined): { year: number; month: number } | undefined {
  if (!dateHeader) {
    return undefined;
  }
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(dateHeader.trim());
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return undefined;
  }
  return { year, month };
}

export function formatChesscomArchiveHttpError(status: number): string {
  if (status === 404) {
    return "Arquivo mensal do Chess.com não encontrado";
  }
  if (status === 403) {
    return "Chess.com bloqueou o acesso ao arquivo público — tente novamente mais tarde";
  }
  if (status === 429) {
    return "Muitas requisições — tente novamente mais tarde";
  }
  return `Erro ao carregar arquivo Chess.com (HTTP ${status})`;
}

export function formatChesscomCallbackHttpError(status: number): string {
  if (status === 404) {
    return "Partida não encontrada no Chess.com";
  }
  if (status === 429) {
    return "Muitas requisições — tente novamente mais tarde";
  }
  return `Erro ao carregar partida Chess.com (HTTP ${status})`;
}

export async function fetchChesscomCallback(
  kind: ChesscomGameKind,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChesscomCallbackJson> {
  let response: Response;
  try {
    response = await fetchImpl(chesscomCallbackUrl(kind, id), {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Falha de rede");
  }
  if (!response.ok) {
    throw new Error(formatChesscomCallbackHttpError(response.status));
  }
  return (await response.json()) as ChesscomCallbackJson;
}

export async function fetchChesscomArchive(
  username: string,
  year: number,
  month: number,
  fetchImpl: typeof fetch = fetch,
): Promise<ChesscomArchiveJson> {
  const url = chesscomArchiveUrl(username, year, month);
  const headers = {
    Accept: "application/json",
    "X-Game-Review-Client": "Game-Review-Extension/0.1.0 (GPL-3.0; contact: github)",
  };

  let response: Response;
  try {
    response = await fetchImpl(url, { headers });
  } catch {
    throw new Error("Falha de rede");
  }

  if (response.status === 403) {
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        },
      });
    } catch {
      throw new Error("Falha de rede");
    }
  }

  if (!response.ok) {
    throw new Error(formatChesscomArchiveHttpError(response.status));
  }

  return (await response.json()) as ChesscomArchiveJson;
}

export function findArchiveGame(
  archive: ChesscomArchiveJson,
  kind: ChesscomGameKind,
  id: string,
): ChesscomArchiveGame | undefined {
  return archive.games?.find((game) => gameUrlMatchesRef(game.url, kind, id));
}
