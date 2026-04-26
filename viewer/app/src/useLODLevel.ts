import { useStore } from "@xyflow/react";

export type LODLevel = "minimal" | "compact" | "full";

/**
 * Discrete zoom-driven LOD selector. Returns "minimal" (z<0.3),
 * "compact" (0.3≤z<0.6), or "full" (z≥0.6). Re-renders only when
 * crossing a threshold, not on every zoom tick.
 */
export function useLODLevel(): LODLevel {
  return useStore((s) => {
    const z = s.transform[2];
    if (z < 0.3) return "minimal";
    if (z < 0.6) return "compact";
    return "full";
  });
}
