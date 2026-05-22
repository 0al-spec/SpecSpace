import type { SpecEdge } from "@/entities/spec-edge";

export const SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODES = [
  "auto",
  "hierarchy",
  "structural",
  "full",
] as const;

export type SpecGraphCanvasEdgeDetailMode =
  (typeof SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODES)[number];

export type SpecGraphCanvasEffectiveEdgeDetailMode = Exclude<
  SpecGraphCanvasEdgeDetailMode,
  "auto"
>;

export const DEFAULT_SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODE: SpecGraphCanvasEdgeDetailMode =
  "auto";

export const SPEC_GRAPH_CANVAS_EDGE_DETAIL_LABELS: Record<
  SpecGraphCanvasEdgeDetailMode,
  string
> = {
  auto: "Auto",
  hierarchy: "Core",
  structural: "Links",
  full: "All",
};

export const SPEC_GRAPH_CANVAS_EFFECTIVE_EDGE_DETAIL_LABELS: Record<
  SpecGraphCanvasEffectiveEdgeDetailMode,
  string
> = {
  hierarchy: "Core",
  structural: "Links",
  full: "All",
};

export type SpecGraphCanvasEdgeDetailStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

const EDGE_DETAIL_STORAGE_KEY = "specspace:spec-graph-canvas-edge-detail:v1";
const AUTO_STRUCTURAL_ZOOM = 0.36;
const AUTO_FULL_ZOOM = 0.72;

export function normalizeSpecGraphCanvasEdgeDetailMode(
  value: unknown,
): SpecGraphCanvasEdgeDetailMode | null {
  return typeof value === "string" &&
    (SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODES as readonly string[]).includes(value)
    ? (value as SpecGraphCanvasEdgeDetailMode)
    : null;
}

export function getSpecGraphCanvasEdgeDetailStorage():
  | SpecGraphCanvasEdgeDetailStorage
  | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSpecGraphCanvasEdgeDetailMode(
  storage: SpecGraphCanvasEdgeDetailStorage | null,
): SpecGraphCanvasEdgeDetailMode {
  if (!storage) return DEFAULT_SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODE;
  try {
    return (
      normalizeSpecGraphCanvasEdgeDetailMode(
        storage.getItem(EDGE_DETAIL_STORAGE_KEY),
      ) ?? DEFAULT_SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODE
    );
  } catch {
    return DEFAULT_SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODE;
  }
}

export function writeSpecGraphCanvasEdgeDetailMode(
  storage: SpecGraphCanvasEdgeDetailStorage | null,
  mode: SpecGraphCanvasEdgeDetailMode,
) {
  if (!storage) return;
  storage.setItem(EDGE_DETAIL_STORAGE_KEY, mode);
}

export function resolveSpecGraphCanvasEdgeDetailMode(
  mode: SpecGraphCanvasEdgeDetailMode,
  zoom: number,
): SpecGraphCanvasEffectiveEdgeDetailMode {
  if (mode !== "auto") return mode;
  if (zoom >= AUTO_FULL_ZOOM) return "full";
  if (zoom >= AUTO_STRUCTURAL_ZOOM) return "structural";
  return "hierarchy";
}

export function isSpecGraphCanvasEdgeVisible(
  edge: SpecEdge,
  effectiveMode: SpecGraphCanvasEffectiveEdgeDetailMode,
  context: {
    selectedEdgeId?: string | null;
    selectedNodeId?: string | null;
  } = {},
): boolean {
  if (edge.edge_id === context.selectedEdgeId) return true;
  if (
    context.selectedNodeId &&
    (edge.source_id === context.selectedNodeId || edge.target_id === context.selectedNodeId)
  ) {
    return true;
  }
  if (edge.status === "broken") return true;
  if (effectiveMode === "full") return true;
  if (effectiveMode === "structural") return edge.edge_kind !== "relates_to";
  return edge.edge_kind === "refines";
}
