import type { SpecNode, SpecNodeGapKind } from "@/entities/spec-node";
import { getSpecNodeGapCount } from "@/entities/spec-node";

export type SpecGraphCanvasGapFilter = "all" | "any" | SpecNodeGapKind;

export type SpecGraphCanvasGapFilterCounts = Record<SpecGraphCanvasGapFilter, number>;

export const SPEC_GRAPH_CANVAS_GAP_FILTERS: SpecGraphCanvasGapFilter[] = [
  "all",
  "any",
  "evidence",
  "input",
  "execution",
];

export const SPEC_GRAPH_CANVAS_GAP_FILTER_LABELS: Record<
  SpecGraphCanvasGapFilter,
  string
> = {
  all: "All",
  any: "Gaps",
  evidence: "Evidence",
  input: "Input",
  execution: "Execution",
};

export function matchesSpecGraphCanvasGapFilter(
  node: SpecNode,
  filter: SpecGraphCanvasGapFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "any") return node.gap_count > 0;
  return getSpecNodeGapCount(node, filter) > 0;
}

export function filterSpecGraphCanvasNodes(
  nodes: readonly SpecNode[],
  filter: SpecGraphCanvasGapFilter,
): SpecNode[] {
  return nodes.filter((node) => matchesSpecGraphCanvasGapFilter(node, filter));
}

export function countSpecGraphCanvasGapFilters(
  nodes: readonly SpecNode[],
): SpecGraphCanvasGapFilterCounts {
  return {
    all: nodes.length,
    any: nodes.filter((node) => node.gap_count > 0).length,
    evidence: nodes.filter((node) => node.evidence_gap > 0).length,
    input: nodes.filter((node) => node.input_gap > 0).length,
    execution: nodes.filter((node) => node.execution_gap > 0).length,
  };
}
