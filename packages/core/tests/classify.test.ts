import { describe, expect, it } from "vitest";
import { classifyMove } from "../src/classify.ts";
import { EPL_THRESHOLDS, HOPELESS_WIN_PERCENT } from "../src/types.ts";

function baseArgs(
  overrides: Partial<Parameters<typeof classifyMove>[0]> = {},
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

describe("classifyMove", () => {
  it("marks hopeless positions Forced", () => {
    expect(
      classifyMove(
        baseArgs({
          playerWinPercentBefore: HOPELESS_WIN_PERCENT,
          epl: 0.4,
          playedIsBest: false,
        }),
      ),
    ).toBe("forced");
  });

  it("classifies Miss when opponent blundered and player drops win%", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: false,
          epl: 0.2,
          playerWinPercentBefore: 70,
          playerWinPercentAfter: 55,
          previousOpponentEpl: EPL_THRESHOLDS.inaccuracy,
        }),
      ),
    ).toBe("miss");
  });

  it("does not classify Miss when previous opponent EPL is below inaccuracy", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: false,
          epl: 0.2,
          playerWinPercentBefore: 70,
          playerWinPercentAfter: 55,
          previousOpponentEpl: EPL_THRESHOLDS.inaccuracy - 0.01,
        }),
      ),
    ).toBe("blunder");
  });

  it("classifies Brilliant on sacrifice with best quality", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: true,
          isSacrifice: true,
          playerWinPercentBefore: 60,
          playerWinPercentAfter: 40,
          isOnlyMove: false,
        }),
      ),
    ).toBe("brilliant");
  });

  it("blocks Brilliant when sacrifice is the only good move", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: true,
          isSacrifice: true,
          playerWinPercentBefore: 60,
          playerWinPercentAfter: 40,
          isOnlyMove: true,
        }),
      ),
    ).toBe("great");
  });

  it("blocks Brilliant when win% before exceeds 90", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: true,
          isSacrifice: true,
          playerWinPercentBefore: 91,
          playerWinPercentAfter: 50,
          isOnlyMove: false,
        }),
      ),
    ).toBe("best");
  });

  it("classifies Great on only-move with best quality", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: true,
          isOnlyMove: true,
        }),
      ),
    ).toBe("great");
  });

  it("classifies Great on rescue from low win%", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: true,
          playerWinPercentBefore: 30,
          playerWinPercentAfter: 55,
        }),
      ),
    ).toBe("great");
  });

  it("classifies Great on equal-to-winning swing", () => {
    expect(
      classifyMove(
        baseArgs({
          playedIsBest: true,
          playerWinPercentBefore: 50,
          playerWinPercentAfter: 72,
        }),
      ),
    ).toBe("great");
  });

  it("maps EPL to Best / Good / Imprecisão / Erro / Blunder", () => {
    expect(
      classifyMove(baseArgs({ epl: 0, playedIsBest: true })),
    ).toBe("best");
    expect(
      classifyMove(
        baseArgs({ epl: 0.03, playedIsBest: false, playerWinPercentAfter: 47 }),
      ),
    ).toBe("good");
    expect(
      classifyMove(
        baseArgs({ epl: 0.08, playedIsBest: false, playerWinPercentAfter: 42 }),
      ),
    ).toBe("inaccuracy");
    expect(
      classifyMove(
        baseArgs({ epl: 0.12, playedIsBest: false, playerWinPercentAfter: 38 }),
      ),
    ).toBe("mistake");
    expect(
      classifyMove(
        baseArgs({ epl: 0.2, playedIsBest: false, playerWinPercentAfter: 30 }),
      ),
    ).toBe("blunder");
  });
});
