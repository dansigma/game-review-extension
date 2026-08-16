import { describe, expect, it } from "vitest";
import {
  gameAccuracy,
  harmonicMean,
  moveAccuracy,
  moveAccuracyFromWinPercents,
  standardDeviation,
  weightedMean,
} from "../src/accuracy.ts";
import { classifyMove } from "../src/classify.ts";
import { HOPELESS_WIN_PERCENT } from "../src/types.ts";

function ladderArgs(
  overrides: Partial<Parameters<typeof classifyMove>[0]>,
): Parameters<typeof classifyMove>[0] {
  return {
    epl: 0,
    playedIsBest: true,
    playerWinPercentBefore: 50,
    playerWinPercentAfter: 50,
    isOnlyMove: false,
    isSacrifice: false,
    ...overrides,
  };
}
import {
  expectedPointsLost,
  mateToCentipawns,
  playerWinPercent,
  winningChancesFromCp,
} from "../src/winPercent.ts";

const ACC_A = 103.1668100711649;
const ACC_K = 0.04354415386753951;
const ACC_B = -3.166924740191411;

describe("lila-v1 move accuracy", () => {
  it("returns 100 when win% does not drop", () => {
    expect(moveAccuracyFromWinPercents(55, 60)).toBe(100);
    expect(moveAccuracyFromWinPercents(40, 40)).toBe(100);
    expect(moveAccuracy(0)).toBe(100);
  });

  it("uses the Lichess exponential curve with +1 uncertainty bonus", () => {
    const winDiff = 10;
    const expected =
      ACC_A * Math.exp(-ACC_K * winDiff) + ACC_B + 1;
    expect(moveAccuracyFromWinPercents(60, 50)).toBeCloseTo(expected, 8);
    expect(moveAccuracy(0.1)).toBeCloseTo(expected, 8);
    expect(moveAccuracyFromWinPercents(60, 50)).not.toBeCloseTo(
      100 * 0.9 ** 1.2,
      0,
    );
  });

  it("clamps to [0, 100]", () => {
    expect(moveAccuracyFromWinPercents(10, 0)).toBeGreaterThanOrEqual(0);
    expect(moveAccuracyFromWinPercents(10, 0)).toBeLessThanOrEqual(100);
  });
});

describe("lila-v1 game accuracy", () => {
  it("uses population stdev for volatility weights", () => {
    expect(standardDeviation([50, 40])).toBeCloseTo(5, 8);
    expect(standardDeviation([40, 40])).toBe(0);
  });

  it("aggregates volatility-weighted mean and harmonic mean per color", () => {
    const allWhiteWinPercents = [50, 40, 40, 55];
    const windowSize = 2;
    const weights = [
      Math.max(0.5, standardDeviation(allWhiteWinPercents.slice(0, windowSize))),
      Math.max(0.5, standardDeviation(allWhiteWinPercents.slice(1, 3))),
      Math.max(0.5, standardDeviation(allWhiteWinPercents.slice(2, 4))),
    ];
    const whiteMove0 = moveAccuracyFromWinPercents(50, 40);
    const whiteMove2 = moveAccuracyFromWinPercents(40, 55);
    const whiteWeighted = weightedMean([
      [whiteMove0, weights[0]!],
      [whiteMove2, weights[2]!],
    ]);
    const whiteHarmonic = harmonicMean([whiteMove0, whiteMove2]);
    const expectedWhite = (whiteWeighted + whiteHarmonic) / 2;

    const result = gameAccuracy(allWhiteWinPercents, "white");
    expect(result.white).toBeCloseTo(expectedWhite, 8);
    expect(result.black).toBeCloseTo(100, 8);
  });
});

describe("classification thresholds", () => {
  it("maps EPL to Best / Good / Imprecisão / Erro / Blunder", () => {
    expect(
      classifyMove(ladderArgs({ epl: 0, playedIsBest: true })),
    ).toBe("best");
    expect(
      classifyMove(
        ladderArgs({
          epl: 0.03,
          playedIsBest: false,
          playerWinPercentAfter: 47,
        }),
      ),
    ).toBe("good");
    expect(
      classifyMove(
        ladderArgs({
          epl: 0.08,
          playedIsBest: false,
          playerWinPercentAfter: 42,
        }),
      ),
    ).toBe("inaccuracy");
    expect(
      classifyMove(
        ladderArgs({
          epl: 0.12,
          playedIsBest: false,
          playerWinPercentAfter: 38,
        }),
      ),
    ).toBe("mistake");
    expect(
      classifyMove(
        ladderArgs({
          epl: 0.2,
          playedIsBest: false,
          playerWinPercentAfter: 30,
        }),
      ),
    ).toBe("blunder");
  });

  it("marks hopeless positions Forced even if the move matches PV1", () => {
    expect(
      classifyMove(
        ladderArgs({
          epl: 0,
          playedIsBest: true,
          playerWinPercentBefore: HOPELESS_WIN_PERCENT,
        }),
      ),
    ).toBe("forced");
    expect(
      classifyMove(
        ladderArgs({
          epl: 0.4,
          playedIsBest: false,
          playerWinPercentBefore: 5,
        }),
      ),
    ).toBe("forced");
  });

  it("converts mate scores via cp logistic (not flat 0/100)", () => {
    const mate3Cp = mateToCentipawns(3);
    expect(mate3Cp).toBe(1800);
    const mate3Win =
      50 + 50 * winningChancesFromCp(Math.min(1000, mate3Cp));
    expect(playerWinPercent({ type: "mate", value: 3 })).toBeCloseTo(
      mate3Win,
      8,
    );
    expect(playerWinPercent({ type: "mate", value: -2 })).toBeLessThan(10);
    expect(playerWinPercent({ type: "mate", value: 0 })).toBe(0);
  });

  it("never reports negative EPL", () => {
    expect(expectedPointsLost(40, 55)).toBe(0);
  });
});
