import { describe, expect, it } from "vitest";
import type {
  SpecGraphEdge,
  SpecGraphNode,
  SpecGraphResponse,
} from "@/shared/spec-graph-contract";
import { buildSpecGraphCanvasSubtreeCollapseModel } from "../model/subtree-collapse";

const node = (node_id: string, refines: string[] = []): SpecGraphNode => ({
  node_id,
  file_name: `${node_id}.yaml`,
  title: node_id,
  kind: "spec",
  status: "linked",
  maturity: 1,
  acceptance_count: 0,
  decisions_count: 0,
  evidence_gap: 0,
  input_gap: 0,
  execution_gap: 0,
  gap_count: 0,
  depends_on: [],
  refines,
  relates_to: [],
  diagnostics: [],
});

const edge = (
  edge_id: string,
  edge_kind: SpecGraphEdge["edge_kind"],
  source_id: string,
  target_id: string,
): SpecGraphEdge => ({
  edge_id,
  edge_kind,
  source_id,
  target_id,
  status: "resolved",
});

const response = {
  spec_dir: "/specs",
  graph: {
    nodes: [
      node("ROOT"),
      node("A", ["ROOT"]),
      node("A1", ["A"]),
      node("B", ["ROOT"]),
      node("C"),
    ],
    edges: [
      edge("A-refines-ROOT", "refines", "A", "ROOT"),
      edge("A1-refines-A", "refines", "A1", "A"),
      edge("B-refines-ROOT", "refines", "B", "ROOT"),
      edge("ROOT-depends-C", "depends_on", "ROOT", "C"),
      edge("A1-depends-C", "depends_on", "A1", "C"),
    ],
    roots: ["ROOT", "C"],
    blocked_files: [],
    diagnostics: [],
    summary: {
      node_count: 5,
      edge_count: 5,
      root_count: 2,
      blocked_file_count: 0,
      diagnostic_count: 0,
      broken_edge_count: 0,
    },
  },
  summary: {
    node_count: 5,
    edge_count: 5,
    root_count: 2,
    blocked_file_count: 0,
    diagnostic_count: 0,
    broken_edge_count: 0,
  },
} satisfies SpecGraphResponse;

describe("SpecGraph canvas subtree collapse", () => {
  it("hides collapsed descendants and incident edges", () => {
    const model = buildSpecGraphCanvasSubtreeCollapseModel(
      response,
      new Set(["A"]),
    );

    expect(model.response.graph.nodes.map((spec) => spec.node_id)).toEqual([
      "ROOT",
      "A",
      "B",
      "C",
    ]);
    expect(model.response.graph.edges.map((item) => item.edge_id)).toEqual([
      "A-refines-ROOT",
      "B-refines-ROOT",
      "ROOT-depends-C",
    ]);
    expect(model.hiddenNodeIds.has("A1")).toBe(true);
    expect(model.hiddenDescendantCountsByNodeId.get("A")).toBe(1);
    expect(model.response.graph.summary).toMatchObject({
      node_count: 4,
      edge_count: 3,
      root_count: 2,
    });
  });

  it("reports direct child counts and full hidden descendant counts", () => {
    const model = buildSpecGraphCanvasSubtreeCollapseModel(
      response,
      new Set(["ROOT"]),
    );

    expect(model.childCountsByNodeId.get("ROOT")).toBe(2);
    expect(model.childCountsByNodeId.get("A")).toBe(1);
    expect(model.descendantCountsByNodeId.get("ROOT")).toBe(3);
    expect(model.descendantCountsByNodeId.get("A")).toBe(1);
    expect(model.hiddenDescendantCountsByNodeId.get("ROOT")).toBe(3);
    expect(model.response.graph.nodes.map((spec) => spec.node_id)).toEqual([
      "ROOT",
      "C",
    ]);
  });

  it("reports only visible collapsed subtrees", () => {
    const model = buildSpecGraphCanvasSubtreeCollapseModel(
      response,
      new Set(["ROOT", "A"]),
    );

    expect([...model.visibleCollapsedNodeIds]).toEqual(["ROOT"]);
    expect(model.hiddenDescendantCountsByNodeId.get("ROOT")).toBe(3);
    expect(model.hiddenDescendantCountsByNodeId.get("A")).toBe(1);
  });

  it("keeps cyclic refines traversal bounded", () => {
    const cyclicResponse: SpecGraphResponse = {
      ...response,
      graph: {
        ...response.graph,
        edges: [
          ...response.graph.edges,
          edge("ROOT-refines-A1", "refines", "ROOT", "A1"),
        ],
      },
    };

    const model = buildSpecGraphCanvasSubtreeCollapseModel(
      cyclicResponse,
      new Set(["ROOT"]),
    );

    expect(model.hiddenDescendantCountsByNodeId.get("ROOT")).toBe(3);
    expect(model.response.graph.nodes.map((spec) => spec.node_id)).toEqual([
      "ROOT",
      "C",
    ]);
  });
});
