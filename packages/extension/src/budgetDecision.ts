/** Locked by SIG-652 PoC 3. Used by EnginePort (SIG-654) and IndexedDB cache key. */
export const MVP_ENGINE_ID = "sf_18_smallnet";
export const MVP_NODES_PER_POSITION = 80_000;
export const MVP_GO_COMMAND = `nodes ${MVP_NODES_PER_POSITION}`;
export const MVP_MULTIPV = 2;
export const MVP_THREADS = 1;

/**
 * Depth 16 is stronger per position but wall-clock varies with the tree.
 * On Node WASM, Kiwipete depth 16 was ~525ms (~450k nodes). 80 plies ≈ 42s
 * on a fast desktop; Chrome Side Panel is slower and can miss the 2 min target.
 *
 * `go nodes 80000` is ~100ms/pos on Node (~depth 14 on Kiwipete) and
 * extrapolates to well under 2 min for 40 and 80 plies even if the panel
 * is 3–4× slower. Cache key includes nodesPerPosition.
 */
export const ENGINE_HOST = "side-panel" as const;

export type EngineQualityPresetId = "fast" | "standard" | "deep";

export const DEFAULT_ENGINE_PRESET: EngineQualityPresetId = "standard";

export const ENGINE_QUALITY_PRESETS: Record<
  EngineQualityPresetId,
  { id: EngineQualityPresetId; labelPt: string; nodes: number }
> = {
  fast: { id: "fast", labelPt: "Rápido", nodes: 20_000 },
  standard: {
    id: "standard",
    labelPt: "Padrão",
    nodes: MVP_NODES_PER_POSITION,
  },
  deep: { id: "deep", labelPt: "Profundo", nodes: 200_000 },
};

export function nodesForPreset(presetId: EngineQualityPresetId): number {
  return ENGINE_QUALITY_PRESETS[presetId].nodes;
}

export function isEngineQualityPresetId(
  value: string,
): value is EngineQualityPresetId {
  return value in ENGINE_QUALITY_PRESETS;
}
