import { describe, expect, it } from "vitest";
import type { MetricsIndexEntry } from "@/shared/metrics-viewer-contract";
import type { ProposalIndexEntry } from "@/shared/proposal-viewer-contract";
import { buildSpecGraphCanvasOverlays, SAMPLE_SPEC_GRAPH } from "../index";

const proposal = (
  overrides: Partial<ProposalIndexEntry> = {},
): ProposalIndexEntry => ({
  proposal_key: "proposal::0001",
  proposal_id: "0001",
  proposal_handle: null,
  title: "Proposal",
  status: "Draft proposal",
  proposal_path: "docs/proposals/0001.md",
  markdown: {
    available: true,
    file_name: "0001.md",
    relative_path: "docs/proposals/0001.md",
    mtime_iso: null,
    content_excerpt: null,
    content_preview: null,
  },
  authority_state: null,
  proposal_type: null,
  runtime_state: null,
  runtime_posture: null,
  promotion_status: null,
  trace_status: null,
  next_gap: null,
  affected_spec_ids: [],
  source_kinds: [],
  ...overrides,
});

const metric = (
  overrides: Partial<MetricsIndexEntry> = {},
): MetricsIndexEntry => ({
  metric_key: "metric::sib",
  category: "metric_score",
  item_id: "sib",
  title: "Specification-Implementation Balance",
  status: "healthy",
  secondary_status: null,
  score: 0.74,
  minimum_score: 0.6,
  value: null,
  next_gap: null,
  source_kind: "graph_dashboard",
  reference_texts: [],
  summary: {},
  ...overrides,
});

describe("buildSpecGraphCanvasOverlays", () => {
  it("counts proposal and metric indicators for graph nodes", () => {
    const overlays = buildSpecGraphCanvasOverlays({
      nodes: SAMPLE_SPEC_GRAPH.graph.nodes,
      edges: SAMPLE_SPEC_GRAPH.graph.edges,
      proposals: [
        proposal({ affected_spec_ids: ["SG-SPEC-SAMPLE-ROOT", "SG-SPEC-MISSING"] }),
      ],
      metrics: [
        metric({ reference_texts: ["SG-SPEC-SAMPLE-ROOT"] }),
      ],
    });

    expect(overlays.nodesById.get("SG-SPEC-SAMPLE-ROOT")).toEqual({
      proposalCount: 1,
      metricCount: 1,
    });
    expect(overlays.nodesById.has("SG-SPEC-MISSING")).toBe(false);
  });

  it("counts metric indicators for explicit graph edge references", () => {
    const edgeId = "SG-SPEC-SAMPLE-ROOT__depends_on__SG-SPEC-SAMPLE-RUNTIME";
    const overlays = buildSpecGraphCanvasOverlays({
      nodes: SAMPLE_SPEC_GRAPH.graph.nodes,
      edges: SAMPLE_SPEC_GRAPH.graph.edges,
      proposals: [],
      metrics: [
        metric({ reference_texts: [`edge ${edgeId}`] }),
      ],
    });

    expect(overlays.edgesById.get(edgeId)).toEqual({
      proposalCount: 0,
      metricCount: 1,
    });
    expect(overlays.nodesById.has("SG-SPEC-SAMPLE-ROOT")).toBe(false);
    expect(overlays.nodesById.has("SG-SPEC-SAMPLE-RUNTIME")).toBe(false);
  });

  it("does not match ids by substring and counts each metric once per target", () => {
    const edgeId = "SG-SPEC-SAMPLE-ROOT__depends_on__SG-SPEC-SAMPLE-RUNTIME";
    const overlays = buildSpecGraphCanvasOverlays({
      nodes: SAMPLE_SPEC_GRAPH.graph.nodes,
      edges: SAMPLE_SPEC_GRAPH.graph.edges,
      proposals: [],
      metrics: [
        metric({
          metric_key: "metric::root",
          reference_texts: [
            "SG-SPEC-SAMPLE-ROOT",
            "again SG-SPEC-SAMPLE-ROOT",
          ],
        }),
        metric({
          metric_key: "metric::edge",
          reference_texts: [
            edgeId,
            `duplicate ${edgeId}`,
          ],
        }),
      ],
    });

    expect(overlays.nodesById.get("SG-SPEC-SAMPLE-ROOT")).toEqual({
      proposalCount: 0,
      metricCount: 1,
    });
    expect(overlays.edgesById.get(edgeId)).toEqual({
      proposalCount: 0,
      metricCount: 1,
    });
  });
});
