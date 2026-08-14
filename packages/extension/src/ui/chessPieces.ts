import wP from "./pieces/cburnett/wP.svg?raw";
import wN from "./pieces/cburnett/wN.svg?raw";
import wB from "./pieces/cburnett/wB.svg?raw";
import wR from "./pieces/cburnett/wR.svg?raw";
import wQ from "./pieces/cburnett/wQ.svg?raw";
import wK from "./pieces/cburnett/wK.svg?raw";
import bP from "./pieces/cburnett/bP.svg?raw";
import bN from "./pieces/cburnett/bN.svg?raw";
import bB from "./pieces/cburnett/bB.svg?raw";
import bR from "./pieces/cburnett/bR.svg?raw";
import bQ from "./pieces/cburnett/bQ.svg?raw";
import bK from "./pieces/cburnett/bK.svg?raw";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

/** Cburnett SVGs (GPL/CC BY-SA). Not chessground. */
export const CBURNETT_SVG: Record<string, string> = {
  wp: wP,
  wn: wN,
  wb: wB,
  wr: wR,
  wq: wQ,
  wk: wK,
  bp: bP,
  bn: bN,
  bb: bB,
  br: bR,
  bq: bQ,
  bk: bK,
};

export function pieceSvg(color: "w" | "b", type: PieceType): string | undefined {
  return CBURNETT_SVG[`${color}${type}`];
}
