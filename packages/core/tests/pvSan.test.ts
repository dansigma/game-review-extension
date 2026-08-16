import { describe, expect, it } from "vitest";
import {
  ENGINE_PV_SAN_MAX,
  uciPvToSan,
} from "../src/pvSan.ts";
import { STANDARD_START_FEN } from "../src/parsePgn.ts";

describe("uciPvToSan", () => {
  it("converts a multi-ply PV from the starting position", () => {
    const result = uciPvToSan(STANDARD_START_FEN, [
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
      "f1b5",
    ]);
    expect(result).toBe("e4 e5 Nf3 Nc6 Bb5");
  });

  it(`caps at ${ENGINE_PV_SAN_MAX} plies`, () => {
    const result = uciPvToSan(STANDARD_START_FEN, [
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
      "f1b5",
      "a7a6",
      "b5a4",
    ]);
    expect(result).toBe("e4 e5 Nf3 Nc6 Bb5");
    expect(result?.split(" ")).toHaveLength(ENGINE_PV_SAN_MAX);
  });

  it("stops at the first failed conversion and never emits UCI", () => {
    const result = uciPvToSan(STANDARD_START_FEN, ["e2e4", "notauci", "g1f3"]);
    expect(result).toBe("e4");
    expect(result).not.toMatch(/[a-h][1-8][a-h][1-8]/);
  });

  it("returns undefined when no plies convert", () => {
    expect(uciPvToSan(STANDARD_START_FEN, [])).toBeUndefined();
    expect(uciPvToSan(STANDARD_START_FEN, ["zzzzzz"])).toBeUndefined();
  });
});
