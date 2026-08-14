import { describe, expect, it } from "vitest";
import {
  aggregateAccuracy,
  harmonicMean,
  moveAccuracy,
  trimmedMean,
} from "../src/accuracy.ts";
import { classifyMove } from "../src/classify.ts";
import { HOPELESS_WIN_PERCENT } from "../src/types.ts";
import { expectedPointsLost, playerWinPercent } from "../src/winPercent.ts";

describe("epl-v1 accuracy", () => {
  it("uses 100*(1-EPL)^1.2 and not the Lichess 103.1668 curve", () => {
    expect(moveAccuracy(0)).toBe(100);
    expect(moveAccuracy(1)).toBe(0);
    expect(moveAccuracy(0.1)).toBeCloseTo(100 * 0.9 ** 1.2, 8);
    expect(moveAccuracy(0.2)).toBeCloseTo(100 * 0.8 ** 1.2, 8);
    expect(moveAccuracy(0.1)).not.toBeCloseTo(
      103.1668 * Math.exp(-0.04354 * 10) - 3.1669,
      0,
    );
  });

  it("aggregates with 0.5 trimmed mean + 0.5 harmonic mean", () => {
    const values = [100, 100, 90, 80, 70];
    expect(aggregateAccuracy(values)).toBeCloseTo(
      0.5 * trimmedMean(values) + 0.5 * harmonicMean(values),
      8,
    );
  });

  it("harmonic mean is 0 when a counted move scored 0", () => {
    expect(harmonicMean([100, 0, 90])).toBe(0);
  });
});

describe("classification thresholds", () => {
  it("maps EPL to Best / Good / Imprecisão / Erro / Blunder", () => {
    expect(
      classifyMove({ epl: 0, playedIsBest: true, playerWinPercentBefore: 50 }),
    ).toBe("best");
    expect(
      classifyMove({
        epl: 0.03,
        playedIsBest: false,
        playerWinPercentBefore: 50,
      }),
    ).toBe("good");
    expect(
      classifyMove({
        epl: 0.08,
        playedIsBest: false,
        playerWinPercentBefore: 50,
      }),
    ).toBe("inaccuracy");
    expect(
      classifyMove({
        epl: 0.15,
        playedIsBest: false,
        playerWinPercentBefore: 50,
      }),
    ).toBe("mistake");
    expect(
      classifyMove({
        epl: 0.25,
        playedIsBest: false,
        playerWinPercentBefore: 50,
      }),
    ).toBe("blunder");
  });

  it("marks hopeless positions Forced even if the move matches PV1", () => {
    expect(
      classifyMove({
        epl: 0,
        playedIsBest: true,
        playerWinPercentBefore: HOPELESS_WIN_PERCENT,
      }),
    ).toBe("forced");
    expect(
      classifyMove({
        epl: 0.4,
        playedIsBest: false,
        playerWinPercentBefore: 5,
      }),
    ).toBe("forced");
  });

  it("treats mate scores as 0 or 100 win percent", () => {
    expect(playerWinPercent({ type: "mate", value: 3 })).toBe(100);
    expect(playerWinPercent({ type: "mate", value: -2 })).toBe(0);
    expect(playerWinPercent({ type: "mate", value: 0 })).toBe(0);
  });

  it("never reports negative EPL", () => {
    expect(expectedPointsLost(40, 55)).toBe(0);
  });
});
