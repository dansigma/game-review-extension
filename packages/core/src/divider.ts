import { Chess } from "chess.js";

const FIRST_RANK = 0xffn;
const LAST_RANK = 0xff00000000000000n;

const SMALL_SQUARE = 0x0303n;

const MIXEDNESS_REGIONS: readonly bigint[] = (() => {
  const regions: bigint[] = [];
  for (let y = 0; y <= 6; y += 1) {
    for (let x = 0; x <= 6; x += 1) {
      regions.push(SMALL_SQUARE << BigInt(x + 8 * y));
    }
  }
  return regions;
})();

export interface Division {
  middle?: number;
  end?: number;
  plies: number;
}

interface Bitboards {
  occupied: bigint;
  kings: bigint;
  pawns: bigint;
  white: bigint;
  black: bigint;
}

function bitCount(bb: bigint): number {
  let count = 0;
  let n = bb;
  while (n > 0n) {
    count += Number(n & 1n);
    n >>= 1n;
  }
  return count;
}

function fenToBitboards(fen: string): Bitboards {
  const chess = new Chess(fen);
  let occupied = 0n;
  let kings = 0n;
  let pawns = 0n;
  let white = 0n;
  let black = 0n;

  const board = chess.board();
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row]?.[col];
      if (!piece) {
        continue;
      }
      const rank = 8 - row;
      const bit = BigInt((rank - 1) * 8 + col);
      const mask = 1n << bit;
      occupied |= mask;
      if (piece.type === "k") {
        kings |= mask;
      }
      if (piece.type === "p") {
        pawns |= mask;
      }
      if (piece.color === "w") {
        white |= mask;
      } else {
        black |= mask;
      }
    }
  }

  return { occupied, kings, pawns, white, black };
}

function majorsAndMinors(board: Bitboards): number {
  return bitCount(board.occupied & ~(board.kings | board.pawns));
}

function backrankSparse(board: Bitboards): boolean {
  return (
    bitCount(FIRST_RANK & board.white) < 4 ||
    bitCount(LAST_RANK & board.black) < 4
  );
}

function score(y: number, white: number, black: number): number {
  switch (white) {
    case 0:
      switch (black) {
        case 1:
          return 1 + y;
        case 2:
          return y < 6 ? 2 + (6 - y) : 0;
        case 3:
          return y < 7 ? 3 + (7 - y) : 0;
        case 4:
          return y < 7 ? 3 + (7 - y) : 0;
        default:
          return 0;
      }
    case 1:
      switch (black) {
        case 0:
          return 1 + (8 - y);
        case 1:
          return 5 + Math.abs(4 - y);
        case 2:
          return 4 + (7 - y);
        case 3:
          return 5 + (7 - y);
        default:
          return 0;
      }
    case 2:
      switch (black) {
        case 0:
          return y > 2 ? 2 + (y - 2) : 0;
        case 1:
          return 4 + (y - 1);
        case 2:
          return 7;
        default:
          return 0;
      }
    case 3:
      switch (black) {
        case 0:
          return y > 1 ? 3 + (y - 1) : 0;
        case 1:
          return 5 + (y - 1);
        default:
          return 0;
      }
    case 4:
      switch (black) {
        case 0:
          // group of 4 on the homerow = 0
          return y > 1 ? 3 + (y - 1) : 0;
        default:
          return 0;
      }
    default:
      return 0;
  }
}

function mixedness(board: Bitboards): number {
  let acc = 0;
  for (let i = 0; i < MIXEDNESS_REGIONS.length; i += 1) {
    const region = MIXEDNESS_REGIONS[i]!;
    const y = Math.floor(i / 7) + 1;
    acc += score(
      y,
      bitCount(board.white & region),
      bitCount(board.black & region),
    );
  }
  return acc;
}

function isMiddleTrigger(board: Bitboards): boolean {
  return (
    majorsAndMinors(board) <= 10 ||
    backrankSparse(board) ||
    mixedness(board) > 150
  );
}

/**
 * Lichess scalachess Divider: middlegame/endgame indices from fenAfter per ply.
 * Index `i` matches 0-based `NormalizedMove.ply`.
 */
export function divideGame(fensAfter: readonly string[]): Division {
  const plies = fensAfter.length;

  let middle: number | undefined;
  for (let index = 0; index < fensAfter.length; index += 1) {
    const fen = fensAfter[index];
    if (!fen) {
      continue;
    }
    if (isMiddleTrigger(fenToBitboards(fen))) {
      middle = index;
      break;
    }
  }

  let end: number | undefined;
  if (middle !== undefined) {
    for (let index = middle; index < fensAfter.length; index += 1) {
      const fen = fensAfter[index];
      if (!fen) {
        continue;
      }
      if (majorsAndMinors(fenToBitboards(fen)) <= 6) {
        end = index;
        break;
      }
    }
  }

  const filteredMiddle =
    middle !== undefined && (end === undefined || middle < end)
      ? middle
      : undefined;

  return {
    middle: filteredMiddle,
    end,
    plies,
  };
}

export function isOpeningPly(division: Division, ply: number): boolean {
  return division.middle === undefined || ply < division.middle;
}

/** @internal Exported for unit tests. */
export function dividerStats(fen: string): {
  majorsAndMinors: number;
  backrankSparse: boolean;
  mixedness: number;
} {
  const board = fenToBitboards(fen);
  return {
    majorsAndMinors: majorsAndMinors(board),
    backrankSparse: backrankSparse(board),
    mixedness: mixedness(board),
  };
}
