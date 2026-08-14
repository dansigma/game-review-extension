import { describe, expect, it } from "vitest";
import type { UciInfo } from "../src/uci.ts";
import {
  buildPositionEval,
  uciInfosToEngineLines,
} from "../src/uciToPositionEval.ts";

const KIWIPETE =
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

describe("uciInfosToEngineLines", () => {
  it("keeps the latest info per multipv and sorts by multipv", () => {
    const infos: UciInfo[] = [
      {
        depth: 10,
        multipv: 1,
        score: { type: "cp", value: 20 },
        pv: ["e1g1", "e8g8"],
      },
      {
        depth: 12,
        multipv: 2,
        score: { type: "cp", value: 10 },
        pv: ["d5e6"],
      },
      {
        depth: 14,
        multipv: 1,
        nodes: 50_000,
        score: { type: "cp", value: 34 },
        pv: ["g2g3", "g7g6"],
      },
    ];

    expect(uciInfosToEngineLines(infos)).toEqual([
      {
        multipv: 1,
        depth: 14,
        nodes: 50_000,
        score: { type: "cp", value: 34 },
        pv: ["g2g3", "g7g6"],
      },
      {
        multipv: 2,
        depth: 12,
        score: { type: "cp", value: 10 },
        pv: ["d5e6"],
      },
    ]);
  });

  it("maps mate scores", () => {
    const lines = uciInfosToEngineLines([
      {
        depth: 20,
        multipv: 1,
        score: { type: "mate", value: 3 },
        pv: ["h3g4"],
      },
    ]);
    expect(lines[0]?.score).toEqual({ type: "mate", value: 3 });
  });
});

describe("buildPositionEval", () => {
  it("returns a core PositionEval with fen and ply", () => {
    const eval_ = buildPositionEval(KIWIPETE, 0, [
      {
        depth: 16,
        multipv: 1,
        score: { type: "cp", value: 15 },
        pv: ["e1g1"],
      },
      {
        depth: 16,
        multipv: 2,
        score: { type: "cp", value: 5 },
        pv: ["d5e6"],
      },
    ]);

    expect(eval_).toEqual({
      fen: KIWIPETE,
      ply: 0,
      lines: [
        {
          multipv: 1,
          depth: 16,
          score: { type: "cp", value: 15 },
          pv: ["e1g1"],
        },
        {
          multipv: 2,
          depth: 16,
          score: { type: "cp", value: 5 },
          pv: ["d5e6"],
        },
      ],
    });
  });
});
