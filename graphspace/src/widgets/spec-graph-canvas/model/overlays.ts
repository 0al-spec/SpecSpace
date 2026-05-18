import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { MetricsIndexEntry } from "@/shared/metrics-viewer-contract";
import type { ProposalIndexEntry } from "@/shared/proposal-viewer-contract";

export type SpecGraphCanvasOverlayKind = "proposal" | "metric";

export type SpecGraphCanvasOverlaySummary = {
  proposalCount: number;
  metricCount: number;
};

export type SpecGraphCanvasOverlays = {
  nodesById: ReadonlyMap<string, SpecGraphCanvasOverlaySummary>;
  edgesById: ReadonlyMap<string, SpecGraphCanvasOverlaySummary>;
};

type BuildSpecGraphCanvasOverlaysInput = {
  nodes: readonly SpecNode[];
  edges: readonly SpecEdge[];
  proposals: readonly ProposalIndexEntry[];
  metrics: readonly MetricsIndexEntry[];
};

const emptySummary = (): SpecGraphCanvasOverlaySummary => ({
  proposalCount: 0,
  metricCount: 0,
});

function increment(
  map: Map<string, SpecGraphCanvasOverlaySummary>,
  id: string,
  kind: SpecGraphCanvasOverlayKind,
) {
  const summary = map.get(id) ?? emptySummary();
  if (kind === "proposal") summary.proposalCount += 1;
  if (kind === "metric") summary.metricCount += 1;
  map.set(id, summary);
}

function referencesId(reference: string, id: string): boolean {
  return reference === id || reference.includes(id);
}

export function buildSpecGraphCanvasOverlays({
  nodes,
  edges,
  proposals,
  metrics,
}: BuildSpecGraphCanvasOverlaysInput): SpecGraphCanvasOverlays {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  const edgeIds = new Set(edges.map((edge) => edge.edge_id));
  const nodesById = new Map<string, SpecGraphCanvasOverlaySummary>();
  const edgesById = new Map<string, SpecGraphCanvasOverlaySummary>();

  for (const proposal of proposals) {
    for (const specId of proposal.affected_spec_ids) {
      if (!nodeIds.has(specId)) continue;
      increment(nodesById, specId, "proposal");
    }
  }

  for (const metric of metrics) {
    for (const reference of metric.reference_texts) {
      for (const nodeId of nodeIds) {
        if (referencesId(reference, nodeId)) {
          increment(nodesById, nodeId, "metric");
        }
      }
      for (const edgeId of edgeIds) {
        if (referencesId(reference, edgeId)) {
          increment(edgesById, edgeId, "metric");
        }
      }
    }
  }

  return {
    nodesById,
    edgesById,
  };
}
