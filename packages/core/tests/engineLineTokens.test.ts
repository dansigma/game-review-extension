import { describe, expect, it } from "vitest";
import { tokenizeEngineLine } from "../src/engineLineTokens.ts";

describe("tokenizeEngineLine", () => {
  it("numbers a white-start line like compact PGN", () => {
    const sans = ["e4", "e5", "Nf3", "Nc6", "Bb5"];
    const tokens = tokenizeEngineLine(sans, 0, "white");

    expect(tokens).toEqual([
      { kind: "num", text: "1." },
      { kind: "san", san: "e4", index: 0 },
      { kind: "san", san: "e5", index: 1 },
      { kind: "num", text: "2." },
      { kind: "san", san: "Nf3", index: 2 },
      { kind: "san", san: "Nc6", index: 3 },
      { kind: "num", text: "3." },
      { kind: "san", san: "Bb5", index: 4 },
    ]);
  });

  it("numbers a black-start line like compact PGN", () => {
    const sans = ["e5", "Nf3"];
    const tokens = tokenizeEngineLine(sans, 1, "black");

    expect(tokens).toEqual([
      { kind: "num", text: "1..." },
      { kind: "san", san: "e5", index: 0 },
      { kind: "num", text: "2." },
      { kind: "san", san: "Nf3", index: 1 },
    ]);
  });

  it("numbers mid-game black alternatives", () => {
    const sans = ["Nd3", "Bxd3", "cxd3", "Rd1", "d2"];
    const tokens = tokenizeEngineLine(sans, 64, "black");

    expect(tokens).toEqual([
      { kind: "num", text: "33..." },
      { kind: "san", san: "Nd3", index: 0 },
      { kind: "num", text: "34." },
      { kind: "san", san: "Bxd3", index: 1 },
      { kind: "san", san: "cxd3", index: 2 },
      { kind: "num", text: "35." },
      { kind: "san", san: "Rd1", index: 3 },
      { kind: "san", san: "d2", index: 4 },
    ]);
  });

  it("returns empty for empty sans", () => {
    expect(tokenizeEngineLine([], 0, "white")).toEqual([]);
    expect(tokenizeEngineLine([], 65, "black")).toEqual([]);
  });
});
