import type { SpecEdge } from "@/entities/spec-edge";
import {
  DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
  type SpecGraphCanvasLayoutPreset,
} from "./layout-presets";

export const SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODES = [
  "auto",
  "primary",
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
  "hierarchy";

export const SPEC_GRAPH_CANVAS_EDGE_DETAIL_LABELS: Record<
  SpecGraphCanvasEdgeDetailMode,
  string
> = {
  auto: "Auto",
  primary: "Main",
  hierarchy: "Core",
  structural: "Links",
  full: "All",
};

export const SPEC_GRAPH_CANVAS_EFFECTIVE_EDGE_DETAIL_LABELS: Record<
  SpecGraphCanvasEffectiveEdgeDetailMode,
  string
> = {
  primary: "Main",
  hierarchy: "Core",
  structural: "Links",
  full: "All",
};

export const SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODES = [
  "curved",
  "orthogonal",
] as const;

export type SpecGraphCanvasEdgeRouteMode =
  (typeof SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODES)[number];

export const DEFAULT_SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODE: SpecGraphCanvasEdgeRouteMode =
  "curved";

export const SPEC_GRAPH_CANVAS_EDGE_ROUTE_LABELS: Record<
  SpecGraphCanvasEdgeRouteMode,
  string
> = {
  curved: "Curve",
  orthogonal: "Rect",
};

export type SpecGraphCanvasEdgeDetailStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

const EDGE_DETAIL_STORAGE_KEY = "specspace:spec-graph-canvas-edge-detail:v2";
const EDGE_ROUTE_STORAGE_KEY = "specspace:spec-graph-canvas-edge-route:v1";
const AUTO_STRUCTURAL_ZOOM = 0.36;
const AUTO_FULL_ZOOM = 0.72;
const AUTO_EDGE_DETAIL_PROFILES: Record<
  SpecGraphCanvasLayoutPreset,
  {
    structuralZoom: number;
    fullZoom: number;
  }
> = {
  tree: {
    structuralZoom: AUTO_STRUCTURAL_ZOOM,
    fullZoom: AUTO_FULL_ZOOM,
  },
  linear: {
    structuralZoom: 0.42,
    fullZoom: 0.84,
  },
  spine: {
    structuralZoom: 0.56,
    fullZoom: 1.05,
  },
  canonical: {
    structuralZoom: AUTO_STRUCTURAL_ZOOM,
    fullZoom: AUTO_FULL_ZOOM,
  },
  "status-columns": {
    structuralZoom: 0.5,
    fullZoom: 1,
  },
};

export function normalizeSpecGraphCanvasEdgeDetailMode(
  value: unknown,
): SpecGraphCanvasEdgeDetailMode | null {
  return typeof value === "string" &&
    (SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODES as readonly string[]).includes(value)
    ? (value as SpecGraphCanvasEdgeDetailMode)
    : null;
}

export function normalizeSpecGraphCanvasEdgeRouteMode(
  value: unknown,
): SpecGraphCanvasEdgeRouteMode | null {
  return typeof value === "string" &&
    (SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODES as readonly string[]).includes(value)
    ? (value as SpecGraphCanvasEdgeRouteMode)
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
  try {
    storage.setItem(EDGE_DETAIL_STORAGE_KEY, mode);
  } catch {
    // Storage persistence is optional; keep canvas controls usable when writes fail.
  }
}

export function readSpecGraphCanvasEdgeRouteMode(
  storage: SpecGraphCanvasEdgeDetailStorage | null,
): SpecGraphCanvasEdgeRouteMode {
  if (!storage) return DEFAULT_SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODE;
  try {
    return (
      normalizeSpecGraphCanvasEdgeRouteMode(
        storage.getItem(EDGE_ROUTE_STORAGE_KEY),
      ) ?? DEFAULT_SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODE
    );
  } catch {
    return DEFAULT_SPEC_GRAPH_CANVAS_EDGE_ROUTE_MODE;
  }
}

export function writeSpecGraphCanvasEdgeRouteMode(
  storage: SpecGraphCanvasEdgeDetailStorage | null,
  mode: SpecGraphCanvasEdgeRouteMode,
) {
  if (!storage) return;
  try {
    storage.setItem(EDGE_ROUTE_STORAGE_KEY, mode);
  } catch {
    // Storage persistence is optional; keep canvas controls usable when writes fail.
  }
}

export function resolveSpecGraphCanvasEdgeDetailMode(
  mode: SpecGraphCanvasEdgeDetailMode,
  zoom: number,
  layoutPreset: SpecGraphCanvasLayoutPreset = DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
): SpecGraphCanvasEffectiveEdgeDetailMode {
  if (mode !== "auto") return mode;
  const profile = AUTO_EDGE_DETAIL_PROFILES[layoutPreset];
  if (zoom >= profile.fullZoom) return "full";
  if (zoom >= profile.structuralZoom) return "structural";
  return "primary";
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
  if (effectiveMode === "primary") return edge.edge_kind === "depends_on";
  return edge.edge_kind === "refines";
}
