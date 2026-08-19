import { ENGINE_QUALITY_PRESETS } from "./budgetDecision.ts";

const FAST_NODES = ENGINE_QUALITY_PRESETS.fast.nodes;
const STANDARD_NODES = ENGINE_QUALITY_PRESETS.standard.nodes;
const DEEP_NODES = ENGINE_QUALITY_PRESETS.deep.nodes;

/**
 * Pass-2 node budget for a pass-1 preset. Returns null when pass 2 is skipped
 * (already Deep) or when pass 1 is unknown and not below Deep.
 */
export function pass2NodesFor(pass1Nodes: number): number | null {
  if (pass1Nodes >= DEEP_NODES) {
    return null;
  }
  if (pass1Nodes === FAST_NODES) {
    return STANDARD_NODES;
  }
  if (pass1Nodes === STANDARD_NODES) {
    return DEEP_NODES;
  }
  // Unknown pass-1 budget: same mapping as Standard → Deep.
  return DEEP_NODES;
}

export function usesTwoPassCacheKey(pass1Nodes: number): boolean {
  return pass2NodesFor(pass1Nodes) !== null;
}
