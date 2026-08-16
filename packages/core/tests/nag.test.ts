import { describe, expect, it } from "vitest";
import {
  classificationGlyph,
  formatSanWithGlyph,
  judgementComment,
} from "../src/nag.ts";
import type { MoveClass } from "../src/types.ts";

const ALL_CLASSES: MoveClass[] = [
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
  "forced",
];

describe("classificationGlyph", () => {
  it("maps all move classes to NAG glyphs", () => {
    expect(classificationGlyph("best")).toBe("!!");
    expect(classificationGlyph("good")).toBe("!");
    expect(classificationGlyph("inaccuracy")).toBe("?!");
    expect(classificationGlyph("mistake")).toBe("?");
    expect(classificationGlyph("blunder")).toBe("??");
    expect(classificationGlyph("forced")).toBe("");
  });

  it("covers every MoveClass", () => {
    for (const moveClass of ALL_CLASSES) {
      expect(typeof classificationGlyph(moveClass)).toBe("string");
    }
  });
});

describe("formatSanWithGlyph", () => {
  it("appends the glyph after SAN", () => {
    expect(formatSanWithGlyph("Be2", "inaccuracy")).toBe("Be2?!");
    expect(formatSanWithGlyph("Nf3", "good")).toBe("Nf3!");
    expect(formatSanWithGlyph("Qxf7#", "best")).toBe("Qxf7#!!");
  });

  it("leaves forced moves without a glyph suffix", () => {
    expect(formatSanWithGlyph("Kf1", "forced")).toBe("Kf1");
  });
});

describe("judgementComment", () => {
  it("returns fixed sentences for best and good", () => {
    expect(
      judgementComment({ classification: "best", playedIsBest: true }),
    ).toBe("Melhor lance.");
    expect(
      judgementComment({ classification: "good", playedIsBest: false }),
    ).toBe("Bom lance.");
  });

  it("includes bestSan for inaccuracy when not playedIsBest", () => {
    expect(
      judgementComment({
        classification: "inaccuracy",
        bestSan: "Ne7",
        playedIsBest: false,
      }),
    ).toBe("Imprecisão. Melhor era Ne7.");
  });

  it("omits bestSan for inaccuracy when playedIsBest", () => {
    expect(
      judgementComment({
        classification: "inaccuracy",
        bestSan: "Ne7",
        playedIsBest: true,
      }),
    ).toBe("Imprecisão.");
  });

  it("falls back when bestSan is missing", () => {
    expect(
      judgementComment({
        classification: "inaccuracy",
        playedIsBest: false,
      }),
    ).toBe("Imprecisão.");
    expect(
      judgementComment({ classification: "mistake", playedIsBest: false }),
    ).toBe("Erro.");
    expect(
      judgementComment({ classification: "blunder", playedIsBest: false }),
    ).toBe("Blunder.");
  });

  it("includes bestSan for mistake and blunder", () => {
    expect(
      judgementComment({
        classification: "mistake",
        bestSan: "d4",
        playedIsBest: false,
      }),
    ).toBe("Erro. Melhor era d4.");
    expect(
      judgementComment({
        classification: "blunder",
        bestSan: "Qh5",
        playedIsBest: false,
      }),
    ).toBe("Blunder. Melhor era Qh5.");
  });

  it("returns forced copy", () => {
    expect(
      judgementComment({ classification: "forced", playedIsBest: true }),
    ).toBe("Lance forçado.");
  });
});
