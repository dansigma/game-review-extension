import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALGO_VERSION, type EngineLine, type PositionEval } from "../src/types.ts";
import { parsePgn } from "../src/parsePgn.ts";
import { isOnlyMove } from "../src/onlyMove.ts";
import { reviewGame } from "../src/reviewEngine.ts";
import { ENGINE_PV_SAN_MAX } from "../src/pvSan.ts";
import { whiteScore } from "../src/evalDisplay.ts";
import { playerWinPercent } from "../src/winPercent.ts";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

const SLOPE = 0.00368208;

function cpFromWinPercent(winPercent: number): number {
  const p = Math.min(99.5, Math.max(0.5, winPercent)) / 100;
  return -Math.log(1 / p - 1) / SLOPE;
}

function line(
  multipv: number,
  score: EngineLine["score"],
  pv: string | string[],
): EngineLine {
  return { multipv, depth: 16, score, pv: Array.isArray(pv) ? pv : [pv] };
}

describe("reviewGame on PGN fixtures", () => {
  it("covers Best / Imprecisão / Erro / Blunder from classification-coverage.pgn", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    expect(game.moves.map((move) => move.uci)).toEqual([
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
      "f1b5",
      "a7a6",
    ]);

    const stmWin = [55, 45, 58, 50, 64, 60, 40];
    const pvs = [
      "e2e4",
      "c7c5",
      "d2d4",
      "g8f6",
      "d2d4",
      "a7a6",
      "d2d4",
    ];
    const alt = "a2a3";

    const evals: PositionEval[] = stmWin.map((wp, ply) => {
      const fen =
        ply === 0 ? game.initialFen : (game.moves[ply - 1]?.fenAfter ?? "");
      const pv = pvs[ply] ?? alt;
      return {
        fen,
        ply,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(wp) }, pv),
          line(2, { type: "cp", value: cpFromWinPercent(wp) - 15 }, alt),
        ],
      };
    });

    const review = reviewGame({
      game,
      evals,
      engineId: "sf_18",
      nodesPerPosition: 400_000,
    });

    expect(review.algoVersion).toBe(ALGO_VERSION);
    expect(review.moves.map((move) => move.classification)).toEqual([
      "opening",
      "opening",
      "inaccuracy",
      "mistake",
      "miss",
      "opening",
    ]);
    expect(review.moves.map((move) => move.classificationLabel)).toEqual([
      "Abertura",
      "Abertura",
      "Imprecisão",
      "Erro",
      "Miss",
      "Abertura",
    ]);
    expect(review.moves[0]?.playedIsBest).toBe(true);
    expect(review.moves[1]?.playedIsBest).toBe(false);
    expect(review.moves[4]?.epl).toBeGreaterThanOrEqual(0.15);
    expect(review.graph).toHaveLength(game.moves.length + 1);
    expect(review.white.movesCounted).toBeGreaterThan(0);
    expect(review.black.movesCounted).toBeGreaterThan(0);
    expect(review.moves.every((move) => !isOnlyMove(move))).toBe(true);

    const offBook = review.moves.filter((move) => !move.playedIsBest);
    expect(offBook.length).toBeGreaterThan(0);
    expect(
      offBook.some(
        (move) =>
          move.bestSan !== undefined &&
          !/^[a-h][1-8][a-h][1-8]/.test(move.bestSan),
      ),
    ).toBe(true);
  });

  it("marks hopeless plies Forced but still computes accuracy", () => {
    const game = parsePgn(fixture("hopeless.pgn"));
    expect(game.moves).toHaveLength(2);

    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "mate", value: -4 }, "h1g2"),
          line(2, { type: "mate", value: -4 }, "h1g1"),
        ],
      },
      {
        fen: game.moves[0]?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "mate", value: 3 }, "e1e2"),
          line(2, { type: "cp", value: 800 }, "e1d1"),
        ],
      },
      {
        fen: game.moves[1]?.fenAfter ?? "",
        ply: 2,
        lines: [
          line(1, { type: "mate", value: -2 }, "g2g3"),
          line(2, { type: "mate", value: -2 }, "g2h3"),
        ],
      },
    ];

    const review = reviewGame({
      game,
      evals,
      engineId: "sf_18",
    });

    expect(playerWinPercent({ type: "mate", value: -4 })).toBeLessThanOrEqual(
      10,
    );
    expect(review.moves[0]?.classification).toBe("forced");
    expect(review.moves[0]?.classificationLabel).toBe("Forced");
    expect(typeof review.moves[0]?.accuracy).toBe("number");
    expect(review.moves[0]?.accuracy).toBeGreaterThan(0);
    expect(review.white.movesCounted).toBe(1);
    expect(review.white.movesExcludedForced).toBe(1);
    expect(review.white.accuracy).toBeGreaterThan(0);
  });

  it("reviews Scholar's Mate including the mating ply", () => {
    const game = parsePgn(fixture("scholars-mate.pgn"));
    const evals: PositionEval[] = [];
    for (let ply = 0; ply <= game.moves.length; ply += 1) {
      const fen =
        ply === 0 ? game.initialFen : (game.moves[ply - 1]?.fenAfter ?? "");
      const move = game.moves[ply];
      const isMatePosition = ply === game.moves.length;
      evals.push({
        fen,
        ply,
        lines: [
          line(
            1,
            isMatePosition
              ? { type: "mate", value: 0 }
              : { type: "cp", value: ply % 2 === 0 ? 30 : -30 },
            move?.uci ?? "a7a6",
          ),
          line(2, { type: "cp", value: 0 }, "a2a3"),
        ],
      });
    }

    const review = reviewGame({
      game,
      evals,
      engineId: "sf_18",
    });
    expect(review.gameId).toBe("fixture1");
    expect(review.moves).toHaveLength(7);
    expect(review.moves[6]?.san).toBe("Qxf7#");
    expect(review.moves[6]?.classification).toBe("opening");
  });

  it("rejects a wrong number of evals", () => {
    const game = parsePgn(fixture("hopeless.pgn"));
    expect(() =>
      reviewGame({
        game,
        evals: [],
        engineId: "sf_18",
      }),
    ).toThrow(/Expected 3 position evals/);
  });

  it("persists alternativePlayerWinPercent and flags only-move when PV2 is clearly worse", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const pv1Win = 62;
    const pv2Win = 48;
    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(pv1Win) }, "e2e4"),
          line(2, { type: "cp", value: cpFromWinPercent(pv2Win) }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(50) }, "e7e5"),
          line(2, { type: "cp", value: cpFromWinPercent(49) }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    expect(review.moves[0]?.alternativePlayerWinPercent).toBeCloseTo(pv2Win, 5);
    expect(review.moves[0]?.playerWinPercentBefore).toBeCloseTo(pv1Win, 5);
    expect(review.moves[0]?.onlyMove).toBe(true);
    expect(isOnlyMove(review.moves[0]!)).toBe(true);
    expect(review.moves[0]?.classification).toBe("opening");
  });

  it("does not flag only-move when PV1 and PV2 win% are close", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const pv1Win = 55;
    const pv2Win = 54;
    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(pv1Win) }, "e2e4"),
          line(2, { type: "cp", value: cpFromWinPercent(pv2Win) }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(50) }, "e7e5"),
          line(2, { type: "cp", value: cpFromWinPercent(49) }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    expect(isOnlyMove(review.moves[0]!)).toBe(false);
  });

  it("stores whiteScoreAfter and whiteScoreBefore in White POV", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: 50 }, "e2e4"),
          line(2, { type: "cp", value: 30 }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: 220 }, "e7e5"),
          line(2, { type: "cp", value: 100 }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    const move = review.moves[0];
    expect(move?.whiteScoreBefore).toEqual({ type: "cp", value: 50 });
    expect(move?.whiteScoreAfter).toEqual({ type: "cp", value: -220 });
    expect(move?.whiteScoreAfter).toEqual(
      whiteScore({ type: "cp", value: 220 }, "black"),
    );
  });

  it("stores whiteScore on every graph point alongside whiteWinPercent", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: 50 }, "e2e4"),
          line(2, { type: "cp", value: 30 }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: 220 }, "e7e5"),
          line(2, { type: "cp", value: 100 }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    expect(review.graph).toHaveLength(2);
    expect(review.graph[0]).toMatchObject({
      ply: -1,
      whiteScore: { type: "cp", value: 50 },
    });
    expect(review.graph[0]?.whiteWinPercent).toBeGreaterThan(0);
    expect(review.graph[1]).toMatchObject({
      ply: 0,
      whiteScore: { type: "cp", value: -220 },
    });
    expect(review.graph[1]?.whiteWinPercent).toBeGreaterThan(0);
  });

  it("persists bestLineSan from PV1 before the ply", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const pv = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"];
    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: 50 }, pv),
          line(2, { type: "cp", value: 30 }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: 220 }, "e7e5"),
          line(2, { type: "cp", value: 100 }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    expect(review.moves[0]?.bestSan).toBe("e4");
    expect(review.moves[0]?.bestLineSan).toBe("e4 e5 Nf3 Nc6 Bb5");
  });

  it("persists replyLineSan from PV1 after the ply", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: 50 }, "e2e4"),
          line(2, { type: "cp", value: 30 }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: 40 }, ["e7e5", "g1f3", "b8c6"]),
          line(2, { type: "cp", value: 20 }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    expect(review.moves[0]?.replyLineSan).toBe("e5 Nf3 Nc6");
    expect(review.moves[0]?.replyLineSan).not.toMatch(/[a-h][1-8][a-h][1-8]/);
    expect(review.moves[0]?.fenAfter).toBe(firstMove?.fenAfter);
  });

  it(`caps bestLineSan at ${ENGINE_PV_SAN_MAX} SAN plies`, () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const pv = [
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
      "f1b5",
      "a7a6",
      "b5a4",
    ];
    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: 50 }, pv),
          line(2, { type: "cp", value: 30 }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: 220 }, "e7e5"),
          line(2, { type: "cp", value: 100 }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    expect(review.moves[0]?.bestLineSan?.split(" ")).toHaveLength(
      ENGINE_PV_SAN_MAX,
    );
  });

  it("stores only the SAN prefix when a later PV UCI fails to convert", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    expect(firstMove).toBeDefined();

    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: 50 }, ["e2e4", "notauci", "g1f3"]),
          line(2, { type: "cp", value: 30 }, "d2d4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: 220 }, "e7e5"),
          line(2, { type: "cp", value: 100 }, "c7c5"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 1) },
      evals,
      engineId: "sf_18",
    });

    expect(review.moves[0]?.bestLineSan).toBe("e4");
    expect(review.moves[0]?.bestLineSan).not.toMatch(/[a-h][1-8][a-h][1-8]/);
  });

  it("classifies Miss when opponent blundered and player drops 15% off-book", () => {
    const game = parsePgn(fixture("classification-coverage.pgn"));
    const firstMove = game.moves[0];
    const secondMove = game.moves[1];
    expect(firstMove?.uci).toBe("e2e4");
    expect(secondMove?.uci).toBe("e7e5");

    const whiteBefore = 65;
    const blackBefore = 70;
    const blackAfter = 55;

    const evals: PositionEval[] = [
      {
        fen: game.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(whiteBefore) }, "d2d4"),
          line(2, { type: "cp", value: cpFromWinPercent(whiteBefore) - 5 }, "e2e4"),
        ],
      },
      {
        fen: firstMove?.fenAfter ?? "",
        ply: 1,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(blackBefore) }, "c7c5"),
          line(2, { type: "cp", value: cpFromWinPercent(blackBefore) - 5 }, "e7e5"),
        ],
      },
      {
        fen: secondMove?.fenAfter ?? "",
        ply: 2,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(100 - blackAfter) }, "g1f3"),
          line(2, { type: "cp", value: cpFromWinPercent(100 - blackAfter) - 5 }, "b8c6"),
        ],
      },
    ];

    const review = reviewGame({
      game: { ...game, moves: game.moves.slice(0, 2) },
      evals,
      engineId: "sf_18",
    });

    expect(review.moves[0]?.classification).not.toBe("miss");
    expect(review.moves[0]?.epl).toBeGreaterThanOrEqual(0.1);
    expect(review.moves[1]?.classification).toBe("miss");
    expect(review.moves[1]?.playerWinPercentBefore).toBeCloseTo(blackBefore, 4);
    expect(review.moves[1]?.playerWinPercentAfter).toBeCloseTo(blackAfter, 4);
  });

  it("does not flag only-move or Great for trivial recapture despite large PV gap", () => {
    const game = parsePgn(`[Event "recapture"]
[White "w"]
[Black "b"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4`);
    const blackCapture = game.moves[5];
    const whiteRecapture = game.moves[6];
    expect(blackCapture?.uci).toBe("e5d4");
    expect(whiteRecapture?.uci).toBe("f3d4");

    const subsetGame = {
      ...game,
      initialFen: game.moves[4]!.fenAfter,
      moves: [blackCapture!, whiteRecapture!],
    };

    const pv1Win = 62;
    const pv2Win = 48;
    const afterWin = 64;
    const evals: PositionEval[] = [
      {
        fen: subsetGame.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(50) }, "e5d4"),
          line(2, { type: "cp", value: cpFromWinPercent(49) }, "c7c5"),
        ],
      },
      {
        fen: whiteRecapture!.fenBefore,
        ply: 1,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(pv1Win) }, "f3d4"),
          line(2, { type: "cp", value: cpFromWinPercent(pv2Win) }, "c2c3"),
        ],
      },
      {
        fen: whiteRecapture!.fenAfter,
        ply: 2,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(100 - afterWin) }, "g8f6"),
          line(2, { type: "cp", value: cpFromWinPercent(100 - afterWin - 5) }, "d7d6"),
        ],
      },
    ];

    const review = reviewGame({
      game: subsetGame,
      evals,
      engineId: "sf_18",
    });

    const recaptureMove = review.moves[1];
    expect(recaptureMove?.playedIsBest).toBe(true);
    expect(recaptureMove?.onlyMove).toBe(false);
    expect(isOnlyMove(recaptureMove!)).toBe(false);
    expect(recaptureMove?.classification).toBe("opening");
    expect(recaptureMove?.classification).not.toBe("great");
  });

  it("does not flag only-move or Great for trivial hanging capture despite large PV gap", () => {
    const game = parsePgn(`[SetUp "1"]
[FEN "rnbqkb1r/pppp1ppp/5n2/8/8/5B2/PPPP1PPP/RNBQK1NR b KQkq - 0 5"]
[White "w"]
[Black "b"]

1. Ne4 Bxe4`);
    const blackHang = game.moves[0];
    const whiteCapture = game.moves[1];
    expect(blackHang?.uci).toBe("f6e4");
    expect(whiteCapture?.uci).toBe("f3e4");

    const subsetGame = {
      ...game,
      initialFen: game.initialFen,
      moves: [blackHang!, whiteCapture!],
    };

    const pv1Win = 62;
    const pv2Win = 48;
    const afterWin = 64;
    const evals: PositionEval[] = [
      {
        fen: subsetGame.initialFen,
        ply: 0,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(50) }, "f6e4"),
          line(2, { type: "cp", value: cpFromWinPercent(49) }, "c7c5"),
        ],
      },
      {
        fen: whiteCapture!.fenBefore,
        ply: 1,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(pv1Win) }, "f3e4"),
          line(2, { type: "cp", value: cpFromWinPercent(pv2Win) }, "c2c3"),
        ],
      },
      {
        fen: whiteCapture!.fenAfter,
        ply: 2,
        lines: [
          line(1, { type: "cp", value: cpFromWinPercent(100 - afterWin) }, "g8f6"),
          line(2, { type: "cp", value: cpFromWinPercent(100 - afterWin - 5) }, "d7d6"),
        ],
      },
    ];

    const review = reviewGame({
      game: subsetGame,
      evals,
      engineId: "sf_18",
    });

    const captureMove = review.moves[1];
    expect(captureMove?.playedIsBest).toBe(true);
    expect(captureMove?.onlyMove).toBe(false);
    expect(isOnlyMove(captureMove!)).toBe(false);
    expect(captureMove?.classification).toBe("opening");
    expect(captureMove?.classification).not.toBe("great");
  });

  describe("opening phase filter", () => {
    it("rewrites a first-ply Best to opening from the standard start", () => {
      const game = parsePgn(`[Event "opening"]
[White "w"]
[Black "b"]

1. d4`);
      const firstMove = game.moves[0];
      expect(firstMove?.uci).toBe("d2d4");

      const evals: PositionEval[] = [
        {
          fen: game.initialFen,
          ply: 0,
          lines: [
            line(1, { type: "cp", value: cpFromWinPercent(55) }, "d2d4"),
            line(2, { type: "cp", value: cpFromWinPercent(54) }, "e2e4"),
          ],
        },
        {
          fen: firstMove?.fenAfter ?? "",
          ply: 1,
          lines: [
            line(1, { type: "cp", value: cpFromWinPercent(50) }, "d7d5"),
            line(2, { type: "cp", value: cpFromWinPercent(49) }, "g8f6"),
          ],
        },
      ];

      const review = reviewGame({ game, evals, engineId: "sf_18" });
      expect(review.moves[0]?.playedIsBest).toBe(true);
      expect(review.moves[0]?.classification).toBe("opening");
      expect(review.moves[0]?.classificationLabel).toBe("Abertura");
    });

    it("keeps a first-ply blunder during the opening phase", () => {
      const game = parsePgn(`[Event "opening-blunder"]
[White "w"]
[Black "b"]

1. f3`);
      const firstMove = game.moves[0];
      expect(firstMove?.uci).toBe("f2f3");

      const evals: PositionEval[] = [
        {
          fen: game.initialFen,
          ply: 0,
          lines: [
            line(1, { type: "cp", value: cpFromWinPercent(55) }, "e2e4"),
            line(2, { type: "cp", value: cpFromWinPercent(54) }, "d2d4"),
          ],
        },
        {
          fen: firstMove?.fenAfter ?? "",
          ply: 1,
          lines: [
            line(1, { type: "cp", value: cpFromWinPercent(62) }, "e7e5"),
            line(2, { type: "cp", value: cpFromWinPercent(60) }, "d7d5"),
          ],
        },
      ];

      const review = reviewGame({ game, evals, engineId: "sf_18" });
      expect(review.moves[0]?.classification).toBe("blunder");
    });

    it("keeps Best after the Divider marks middlegame", () => {
      const middlegameStart =
        "rnbqk2r/pppp1ppp/5n2/8/8/5N2/PPPP1PPP/3RK2R w KQkq - 4 4";
      const game = parsePgn(`[SetUp "1"]
[FEN "${middlegameStart}"]
[White "w"]
[Black "b"]

1. h3`);
      const firstMove = game.moves[0];
      expect(firstMove?.fenBefore).toBe(middlegameStart);
      expect(firstMove?.uci).toBe("h2h3");

      const evals: PositionEval[] = [
        {
          fen: game.initialFen,
          ply: 0,
          lines: [
            line(1, { type: "cp", value: cpFromWinPercent(55) }, "h2h3"),
            line(2, { type: "cp", value: cpFromWinPercent(54) }, "f1c4"),
          ],
        },
        {
          fen: firstMove?.fenAfter ?? "",
          ply: 1,
          lines: [
            line(1, { type: "cp", value: cpFromWinPercent(50) }, "d7d6"),
            line(2, { type: "cp", value: cpFromWinPercent(49) }, "g8f6"),
          ],
        },
      ];

      const review = reviewGame({ game, evals, engineId: "sf_18" });
      expect(review.moves[0]?.playedIsBest).toBe(true);
      expect(review.moves[0]?.classification).toBe("best");
      expect(review.moves[0]?.classificationLabel).toBe("Best");
    });
  });
});
