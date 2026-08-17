import { describe, expect, it } from "vitest";
import {
  classificationGlyph,
  formatSanWithGlyph,
  judgementComment,
} from "../src/nag.ts";
import type { MoveClass } from "../src/types.ts";

const ALL_CLASSES: MoveClass[] = [
  "brilliant",
  "great",
  "best",
  "opening",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
  "forced",
];

describe("classificationGlyph", () => {
  it("maps all move classes to NAG glyphs", () => {
    expect(classificationGlyph("brilliant")).toBe("!!");
    expect(classificationGlyph("great")).toBe("!");
    expect(classificationGlyph("best")).toBe("★");
    expect(classificationGlyph("inaccuracy")).toBe("?!");
    expect(classificationGlyph("mistake")).toBe("?");
    expect(classificationGlyph("miss")).toBe("");
    expect(classificationGlyph("blunder")).toBe("??");
    expect(classificationGlyph("forced")).toBe("");
    expect(classificationGlyph("opening")).toBe("");
  });

  it("uses !! only for Brilliant", () => {
    for (const moveClass of ALL_CLASSES) {
      const glyph = classificationGlyph(moveClass);
      if (moveClass === "brilliant") {
        expect(glyph).toBe("!!");
      } else {
        expect(glyph).not.toBe("!!");
      }
      expect(typeof glyph).toBe("string");
    }
  });
});

describe("formatSanWithGlyph", () => {
  it("appends the glyph after SAN", () => {
    expect(formatSanWithGlyph("Be2", "mistake")).toBe("Be2?");
    expect(formatSanWithGlyph("Nf3", "great")).toBe("Nf3!");
    expect(formatSanWithGlyph("Qxf7#", "best")).toBe("Qxf7#★");
    expect(formatSanWithGlyph("Qg5", "brilliant")).toBe("Qg5!!");
  });

  it("leaves best, miss and forced moves without a glyph suffix when empty", () => {
    expect(formatSanWithGlyph("d4", "best")).toBe("d4★");
    expect(formatSanWithGlyph("Kf1", "forced")).toBe("Kf1");
    expect(formatSanWithGlyph("Qh5", "miss")).toBe("Qh5");
  });
});

describe("judgementComment", () => {
  it("returns fixed sentences for brilliant, great and best", () => {
    expect(
      judgementComment({ classification: "brilliant", playedIsBest: true }),
    ).toBe("Lance brilhante.");
    expect(
      judgementComment({ classification: "great", playedIsBest: true }),
    ).toBe("Ótimo lance.");
    expect(
      judgementComment({ classification: "best", playedIsBest: true }),
    ).toBe("Melhor lance.");
  });

  it("falls back when bestSan is missing", () => {
    expect(
      judgementComment({ classification: "inaccuracy", playedIsBest: false }),
    ).toBe("Imprecisão.");
    expect(
      judgementComment({ classification: "mistake", playedIsBest: false }),
    ).toBe("Erro.");
    expect(
      judgementComment({ classification: "miss", playedIsBest: false }),
    ).toBe("Miss.");
    expect(
      judgementComment({ classification: "blunder", playedIsBest: false }),
    ).toBe("Blunder.");
  });

  it("includes bestSan for inaccuracy, mistake, miss and blunder", () => {
    expect(
      judgementComment({
        classification: "inaccuracy",
        bestSan: "Nc3",
        playedIsBest: false,
      }),
    ).toBe("Imprecisão. Melhor era Nc3.");
    expect(
      judgementComment({
        classification: "mistake",
        bestSan: "d4",
        playedIsBest: false,
      }),
    ).toBe("Erro. Melhor era d4.");
    expect(
      judgementComment({
        classification: "miss",
        bestSan: "Nf3",
        playedIsBest: false,
      }),
    ).toBe("Miss. Melhor era Nf3.");
    expect(
      judgementComment({
        classification: "blunder",
        bestSan: "Qh5",
        playedIsBest: false,
      }),
    ).toBe("Blunder. Melhor era Qh5.");
  });

  it("returns opening copy", () => {
    expect(
      judgementComment({ classification: "opening", playedIsBest: true }),
    ).toBe("Lance de abertura.");
  });

  it("returns forced copy", () => {
    expect(
      judgementComment({ classification: "forced", playedIsBest: true }),
    ).toBe("Lance forçado.");
  });
});
