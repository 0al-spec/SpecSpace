import { describe, expect, it } from "vitest";
import type { SpecGraphResponse } from "@/shared/spec-graph-contract";
import {
  SPEC_FLOW_NODE_INITIAL_HEIGHT,
  SPEC_FLOW_NODE_INITIAL_WIDTH,
  toSpecGraphFlowElements,
} from "../model/to-flow-elements";

const response = {
  spec_dir: "/specs",
  graph: {
    nodes: [
      {
        node_id: "SG-SPEC-0001",
        file_name: "SG-SPEC-0001.yaml",
        title: "SpecGraph - The Executable Product Ontology",
        kind: "spec",
        status: "linked",
        maturity: 1,
        acceptance_count: 1,
        decisions_count: 1,
        evidence_gap: 0,
        input_gap: 0,
        execution_gap: 0,
        gap_count: 0,
        depends_on: [],
        refines: [],
        relates_to: [],
        diagnostics: [],
      },
    ],
    edges: [],
    roots: ["SG-SPEC-0001"],
    blocked_files: [],
    diagnostics: [],
    summary: {
      node_count: 1,
      edge_count: 0,
      root_count: 1,
      blocked_file_count: 0,
      diagnostic_count: 0,
      broken_edge_count: 0,
    },
  },
  summary: {
    node_count: 1,
    edge_count: 0,
    root_count: 1,
    blocked_file_count: 0,
    diagnostic_count: 0,
    broken_edge_count: 0,
  },
} satisfies SpecGraphResponse;

describe("toSpecGraphFlowElements", () => {
  it("provides deterministic initial dimensions for minimap rendering", () => {
    const { nodes } = toSpecGraphFlowElements(response);

    expect(nodes[0]).toMatchObject({
      initialWidth: SPEC_FLOW_NODE_INITIAL_WIDTH,
      initialHeight: SPEC_FLOW_NODE_INITIAL_HEIGHT,
    });
  });
});
