import { describe, expect, it } from "vitest";
import {
  estimateRemainingMs,
  formatAnalysisProgressLabel,
  formatRemainingPt,
} from "../src/analysisEta.ts";

describe("estimateRemainingMs", () => {
  it("returns null when no plies are done", () => {
    expect(estimateRemainingMs(5000, 0, 81)).toBeNull();
  });

  it("estimates remaining time from average ms per ply", () => {
    expect(estimateRemainingMs(10_000, 10, 81)).toBe(71_000);
  });

  it("returns 0 when all plies are done", () => {
    expect(estimateRemainingMs(90_000, 81, 81)).toBe(0);
  });
});

describe("formatRemainingPt", () => {
  it("formats sub-minute remaining time", () => {
    expect(formatRemainingPt(45_000)).toBe("~45s restantes");
  });

  it("formats a single minute in singular", () => {
    expect(formatRemainingPt(60_000)).toBe("~1 min restante");
  });

  it("formats multiple minutes", () => {
    expect(formatRemainingPt(150_000)).toBe("~3 min restantes");
  });

  it("formats zero as ~0s restantes", () => {
    expect(formatRemainingPt(0)).toBe("~0s restantes");
  });
});

describe("formatAnalysisProgressLabel", () => {
  it("shows ply progress without ETA before the first ply", () => {
    expect(formatAnalysisProgressLabel(0, 81, null)).toBe("Analisando… 0/81");
  });

  it("includes ETA when remaining time is known", () => {
    expect(formatAnalysisProgressLabel(12, 81, 45_000)).toBe(
      "Analisando… 12/81 · ~45s restantes",
    );
  });
});
