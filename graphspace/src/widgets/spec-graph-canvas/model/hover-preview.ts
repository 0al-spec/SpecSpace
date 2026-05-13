import type { SpecNode } from "@/entities/spec-node";
import type { SpecNodeDetail } from "@/shared/spec-graph-contract";

export const SPEC_NODE_HOVER_PREVIEW_DELAY_MS = 300;

export const SPEC_NODE_HOVER_PREVIEW_SIZE = {
  width: 286,
  height: 154,
} as const;

const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;
const OBJECTIVE_PREVIEW_LIMIT = 80;

export type SpecNodeHoverPreview = {
  nodeId: string;
  title: string;
  objectivePreview: string | null;
  status: string;
  maturityPercent: number | null;
  maturityLabel: string | null;
  gapLabel: string;
};

export type HoverPreviewAnchor = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

export type HoverPreviewViewport = {
  width: number;
  height: number;
};

export type HoverPreviewSize = {
  width: number;
  height: number;
};

export type HoverPreviewPlacement = "right" | "left" | "bottom" | "top";

export type HoverPreviewPosition = {
  left: number;
  top: number;
  placement: HoverPreviewPlacement;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
};

const clamp = (value: number, min: number, max: number): number => {
  const boundedMax = Math.max(min, max);
  return Math.min(Math.max(value, min), boundedMax);
};

function truncateObjective(value: string): string {
  if (value.length <= OBJECTIVE_PREVIEW_LIMIT) return value;
  return `${value.slice(0, OBJECTIVE_PREVIEW_LIMIT - 3).trimEnd()}...`;
}

function maturityPercent(value: SpecNode["maturity"]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clamp(Math.round(value * 100), 0, 100);
}

function gapLabel(count: number): string {
  if (count === 1) return "1 gap";
  return `${count} gaps`;
}

export function extractSpecNodeObjective(
  detail: SpecNodeDetail | null | undefined,
): string | null {
  if (!detail) return null;
  const specification = asRecord(detail.specification);
  return asNonEmptyString(specification?.objective) ?? asNonEmptyString(detail.objective);
}

export function buildSpecNodeHoverPreview(
  node: SpecNode,
  detail: SpecNodeDetail | null = null,
): SpecNodeHoverPreview {
  const percent = maturityPercent(node.maturity);
  const objective = extractSpecNodeObjective(detail);

  return {
    nodeId: node.node_id,
    title: node.title,
    objectivePreview: objective ? truncateObjective(objective) : null,
    status: node.status,
    maturityPercent: percent,
    maturityLabel: percent === null ? null : `${percent}%`,
    gapLabel: gapLabel(node.gap_count),
  };
}

export function placeSpecNodeHoverPreview(
  anchor: HoverPreviewAnchor,
  viewport: HoverPreviewViewport,
  size: HoverPreviewSize = SPEC_NODE_HOVER_PREVIEW_SIZE,
): HoverPreviewPosition {
  const verticalCenter = anchor.top + (anchor.height - size.height) / 2;
  const horizontalCenter = anchor.left + (anchor.width - size.width) / 2;
  const maxLeft = viewport.width - size.width - VIEWPORT_MARGIN;
  const maxTop = viewport.height - size.height - VIEWPORT_MARGIN;

  if (anchor.right + ANCHOR_GAP + size.width <= viewport.width - VIEWPORT_MARGIN) {
    return {
      left: anchor.right + ANCHOR_GAP,
      top: clamp(verticalCenter, VIEWPORT_MARGIN, maxTop),
      placement: "right",
    };
  }

  if (anchor.left - ANCHOR_GAP - size.width >= VIEWPORT_MARGIN) {
    return {
      left: anchor.left - ANCHOR_GAP - size.width,
      top: clamp(verticalCenter, VIEWPORT_MARGIN, maxTop),
      placement: "left",
    };
  }

  if (anchor.bottom + ANCHOR_GAP + size.height <= viewport.height - VIEWPORT_MARGIN) {
    return {
      left: clamp(horizontalCenter, VIEWPORT_MARGIN, maxLeft),
      top: anchor.bottom + ANCHOR_GAP,
      placement: "bottom",
    };
  }

  return {
    left: clamp(horizontalCenter, VIEWPORT_MARGIN, maxLeft),
    top: clamp(anchor.top - ANCHOR_GAP - size.height, VIEWPORT_MARGIN, maxTop),
    placement: "top",
  };
}
