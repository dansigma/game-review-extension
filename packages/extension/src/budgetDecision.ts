/** Default engine for Side Panel analysis and IndexedDB cache key. */
export const MVP_ENGINE_ID = "sf_18";
export const MVP_NODES_PER_POSITION = 400_000;
export const MVP_GO_COMMAND = `nodes ${MVP_NODES_PER_POSITION}`;
export const MVP_MULTIPV = 2;
export const MVP_THREADS = 1;

/**
 * `go nodes` keeps wall-clock predictable in the Chrome Side Panel (Threads=1).
 * Default 400k nodes uses sf_18 full NNUE; fast/deep presets trade speed vs strength.
 * Cache key includes nodesPerPosition.
 */
export const ENGINE_HOST = "side-panel" as const;

export type EngineQualityPresetId = "fast" | "standard" | "deep";

export const DEFAULT_ENGINE_PRESET: EngineQualityPresetId = "standard";

export const ENGINE_QUALITY_PRESETS: Record<
  EngineQualityPresetId,
  { id: EngineQualityPresetId; labelPt: string; nodes: number }
> = {
  fast: { id: "fast", labelPt: "Rápido", nodes: 80_000 },
  standard: {
    id: "standard",
    labelPt: "Padrão",
    nodes: MVP_NODES_PER_POSITION,
  },
  deep: { id: "deep", labelPt: "Profundo", nodes: 1_500_000 },
};

export function nodesForPreset(presetId: EngineQualityPresetId): number {
  return ENGINE_QUALITY_PRESETS[presetId].nodes;
}

/** Compact PT node count for UI: 80k, 400k, 1,5M. */
export function formatNodesLabel(nodes: number): string {
  if (nodes >= 1_000_000) {
    const millions = nodes / 1_000_000;
    const text =
      Number.isInteger(millions) ? String(millions) : millions.toFixed(1).replace(".", ",");
    return `${text}M`;
  }
  if (nodes >= 1_000) {
    return `${Math.round(nodes / 1_000)}k`;
  }
  return String(nodes);
}

export function presetSelectLabel(presetId: EngineQualityPresetId): string {
  const preset = ENGINE_QUALITY_PRESETS[presetId];
  return `${preset.labelPt} (${formatNodesLabel(preset.nodes)})`;
}

export function isEngineQualityPresetId(
  value: string,
): value is EngineQualityPresetId {
  return value in ENGINE_QUALITY_PRESETS;
}
