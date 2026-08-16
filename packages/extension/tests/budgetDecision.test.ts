import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENGINE_PRESET,
  ENGINE_QUALITY_PRESETS,
  formatNodesLabel,
  MVP_NODES_PER_POSITION,
  nodesForPreset,
  presetSelectLabel,
} from "../src/budgetDecision.ts";

describe("engine quality presets", () => {
  it("maps fast, standard and deep to go nodes budgets", () => {
    expect(nodesForPreset("fast")).toBe(80_000);
    expect(nodesForPreset("standard")).toBe(400_000);
    expect(nodesForPreset("deep")).toBe(1_500_000);
  });

  it("defaults to standard at 400k nodes", () => {
    expect(DEFAULT_ENGINE_PRESET).toBe("standard");
    expect(nodesForPreset(DEFAULT_ENGINE_PRESET)).toBe(MVP_NODES_PER_POSITION);
    expect(MVP_NODES_PER_POSITION).toBe(400_000);
  });

  it("exposes Portuguese labels for the side panel", () => {
    expect(ENGINE_QUALITY_PRESETS.fast.labelPt).toBe("Rápido");
    expect(ENGINE_QUALITY_PRESETS.standard.labelPt).toBe("Padrão");
    expect(ENGINE_QUALITY_PRESETS.deep.labelPt).toBe("Profundo");
    expect(presetSelectLabel("fast")).toBe("Rápido (80k)");
    expect(presetSelectLabel("standard")).toBe("Padrão (400k)");
    expect(presetSelectLabel("deep")).toBe("Profundo (1,5M)");
    expect(formatNodesLabel(1_500_000)).toBe("1,5M");
  });
});
