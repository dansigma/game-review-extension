import { Chess } from "chess.js";
import { parsePgn, type GameResult, type NormalizedGame } from "@game-review/core";
import {
  exportLichessGame,
  isLiveStatus,
  LICHESS_GAME_ID_RE,
  type LichessExportJson,
} from "./lichessExport.ts";

export const LIVE_GAME_MESSAGE_PT = "Partida em andamento — análise indisponível";

const STANDARD_VARIANTS = new Set(["standard"]);

const DRAW_STATUSES = new Set([
  "draw",
  "stalemate",
  "outoftime",
  "insufficientMaterialClaim",
]);

export class LichessProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LichessProviderError";
  }
}

export function assertReviewableLichessExport(json: LichessExportJson): void {
  if (isLiveStatus(json.status)) {
    throw new LichessProviderError(LIVE_GAME_MESSAGE_PT);
  }
  const variant = (json.variant ?? "standard").toLowerCase();
  if (!STANDARD_VARIANTS.has(variant)) {
    throw new LichessProviderError(`Variante não suportada: ${variant}`);
  }
}

function pgnHeader(key: string, value: string): string {
  return `[${key} "${value.replace(/"/g, '\\"')}"]`;
}

function deriveResult(json: LichessExportJson): GameResult {
  if (json.winner === "white") {
    return "1-0";
  }
  if (json.winner === "black") {
    return "0-1";
  }
  if (DRAW_STATUSES.has(json.status)) {
    return "1/2-1/2";
  }
  return "*";
}

function deriveTermination(status: string): string | undefined {
  switch (status) {
    case "mate":
      return "Checkmate";
    case "resign":
      return "Resignation";
    case "stalemate":
      return "Stalemate";
    case "draw":
      return "Agreement";
    case "timeout":
    case "outoftime":
      return "Time forfeit";
    default:
      return undefined;
  }
}

function formatTimeControl(json: LichessExportJson): string | undefined {
  const initial = json.clock?.initial;
  if (initial === undefined) {
    return undefined;
  }
  const increment = json.clock?.increment ?? 0;
  return increment > 0 ? `${initial}+${increment}` : String(initial);
}

function formatPgnDate(createdAtMs: number | undefined): string | undefined {
  if (createdAtMs === undefined) {
    return undefined;
  }
  return new Date(createdAtMs).toISOString().slice(0, 10).replace(/-/g, ".");
}

function playerName(
  side: { user?: { name?: string } } | undefined,
  fallback: string,
): string {
  const name = side?.user?.name?.trim();
  return name && name.length > 0 ? name : fallback;
}

function uciMovesToMovetext(moves: string, result: GameResult): string {
  const chess = new Chess();
  const tokens = moves.trim().split(/\s+/).filter(Boolean);
  const parts: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const uci = tokens[i];
    if (!uci) {
      continue;
    }
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion });
    if (!move) {
      throw new LichessProviderError(`Jogada UCI inválida: ${uci}`);
    }
    if (i % 2 === 0) {
      parts.push(`${Math.floor(i / 2) + 1}.`, move.san);
    } else {
      parts.push(move.san);
    }
  }

  parts.push(result);
  return parts.join(" ");
}

export function buildPgnFromLichessExport(json: LichessExportJson): string {
  assertReviewableLichessExport(json);

  const result = deriveResult(json);
  const headers: string[] = [
    pgnHeader("GameId", json.id),
    pgnHeader("Site", `https://lichess.org/${json.id}`),
    pgnHeader("White", playerName(json.players?.white, "White")),
    pgnHeader("Black", playerName(json.players?.black, "Black")),
    pgnHeader("Result", result),
    pgnHeader("Variant", "Standard"),
  ];

  const date = formatPgnDate(json.createdAt);
  if (date) {
    headers.push(pgnHeader("Date", date));
  }

  const whiteRating = json.players?.white?.rating;
  if (whiteRating !== undefined) {
    headers.push(pgnHeader("WhiteElo", String(whiteRating)));
  }

  const blackRating = json.players?.black?.rating;
  if (blackRating !== undefined) {
    headers.push(pgnHeader("BlackElo", String(blackRating)));
  }

  const timeControl = formatTimeControl(json);
  if (timeControl) {
    headers.push(pgnHeader("TimeControl", timeControl));
  }

  const termination = deriveTermination(json.status);
  if (termination) {
    headers.push(pgnHeader("Termination", termination));
  }

  const movetext = json.moves?.trim()
    ? uciMovesToMovetext(json.moves, result)
    : result;

  return `${headers.join("\n")}\n\n${movetext}`;
}

export function lichessExportToNormalizedGame(json: LichessExportJson): NormalizedGame {
  return parsePgn(buildPgnFromLichessExport(json));
}

export async function loadLichessGame(
  gameId: string,
  fetchExport: (id: string) => Promise<LichessExportJson> = exportLichessGame,
): Promise<NormalizedGame> {
  if (!LICHESS_GAME_ID_RE.test(gameId)) {
    throw new LichessProviderError("ID de partida Lichess deve ter 8 caracteres");
  }
  const json = await fetchExport(gameId);
  return lichessExportToNormalizedGame(json);
}
