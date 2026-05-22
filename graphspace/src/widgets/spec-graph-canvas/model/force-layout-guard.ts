export const SPEC_GRAPH_FORCE_LAYOUT_PRESET = "force" as const;

export type SpecGraphForceLayoutPreset = typeof SPEC_GRAPH_FORCE_LAYOUT_PRESET;

export const SPEC_GRAPH_FORCE_LAYOUT_NODE_LIMIT = 80;
export const SPEC_GRAPH_FORCE_LAYOUT_EDGE_LIMIT = 220;

export type SpecGraphForceLayoutGuardFailureReason =
  | "explicit_enable_required"
  | "node_limit_exceeded"
  | "edge_limit_exceeded";

export type SpecGraphForceLayoutGuardInput = {
  nodeCount: number;
  edgeCount: number;
  explicitEnabled: boolean;
  nodeLimit?: number;
  edgeLimit?: number;
};

export type SpecGraphForceLayoutGuardResult =
  | {
      available: true;
      preset: SpecGraphForceLayoutPreset;
      nodeCount: number;
      edgeCount: number;
      nodeLimit: number;
      edgeLimit: number;
    }
  | {
      available: false;
      preset: SpecGraphForceLayoutPreset;
      reason: SpecGraphForceLayoutGuardFailureReason;
      nodeCount: number;
      edgeCount: number;
      nodeLimit: number;
      edgeLimit: number;
    };

export function evaluateSpecGraphForceLayoutGuard(
  input: SpecGraphForceLayoutGuardInput,
): SpecGraphForceLayoutGuardResult {
  const nodeCount = normalizeGraphCount(input.nodeCount);
  const edgeCount = normalizeGraphCount(input.edgeCount);
  const nodeLimit = normalizeLimit(
    input.nodeLimit,
    SPEC_GRAPH_FORCE_LAYOUT_NODE_LIMIT,
  );
  const edgeLimit = normalizeLimit(
    input.edgeLimit,
    SPEC_GRAPH_FORCE_LAYOUT_EDGE_LIMIT,
  );

  if (!input.explicitEnabled) {
    return {
      available: false,
      preset: SPEC_GRAPH_FORCE_LAYOUT_PRESET,
      reason: "explicit_enable_required",
      nodeCount,
      edgeCount,
      nodeLimit,
      edgeLimit,
    };
  }

  if (nodeCount > nodeLimit) {
    return {
      available: false,
      preset: SPEC_GRAPH_FORCE_LAYOUT_PRESET,
      reason: "node_limit_exceeded",
      nodeCount,
      edgeCount,
      nodeLimit,
      edgeLimit,
    };
  }

  if (edgeCount > edgeLimit) {
    return {
      available: false,
      preset: SPEC_GRAPH_FORCE_LAYOUT_PRESET,
      reason: "edge_limit_exceeded",
      nodeCount,
      edgeCount,
      nodeLimit,
      edgeLimit,
    };
  }

  return {
    available: true,
    preset: SPEC_GRAPH_FORCE_LAYOUT_PRESET,
    nodeCount,
    edgeCount,
    nodeLimit,
    edgeLimit,
  };
}

function normalizeGraphCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}
