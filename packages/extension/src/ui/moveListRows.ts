import type {
  JudgementCounts,
  PlayerColor,
  ReviewedMove,
} from "@game-review/core";

export interface MoveRow {
  number: number;
  white: ReviewedMove | null;
  black: ReviewedMove | null;
}

export type MoveListFilter = {
  color: PlayerColor;
  classification: keyof JudgementCounts;
} | null;

function pairMoves(moves: readonly ReviewedMove[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i] ?? null,
      black: moves[i + 1] ?? null,
    });
  }
  return rows;
}

function moveMatchesFilter(
  move: ReviewedMove | null,
  filter: NonNullable<MoveListFilter>,
): boolean {
  return (
    move !== null &&
    move.color === filter.color &&
    move.classification === filter.classification
  );
}

export function moveListRows(
  moves: readonly ReviewedMove[],
  filter: MoveListFilter,
): MoveRow[] {
  const paired = pairMoves(moves);
  if (filter === null) {
    return paired;
  }

  const filtered: MoveRow[] = [];
  for (const row of paired) {
    const sideMove = filter.color === "white" ? row.white : row.black;
    if (!moveMatchesFilter(sideMove, filter)) {
      continue;
    }
    filtered.push({
      number: row.number,
      white: filter.color === "white" ? row.white : null,
      black: filter.color === "black" ? row.black : null,
    });
  }
  return filtered;
}
