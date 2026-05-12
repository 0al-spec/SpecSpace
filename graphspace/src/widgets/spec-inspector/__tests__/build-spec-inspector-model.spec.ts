import { describe, expect, it } from "vitest";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import { buildSpecInspectorModel } from "../model";

const node = (overrides: Partial<SpecNode>): SpecNode => ({
  node_id: "SG-SPEC-ROOT",
  file_name: "SG-SPEC-ROOT.yaml",
  title: "Root spec",
  kind: "spec",
  status: "linked",
  maturity: 0.5,
  acceptance_count: 1,
  decisions_count: 2,
  evidence_gap: 0,
  input_gap: 1,
  execution_gap: 0,
  gap_count: 1,
  depends_on: [],
  refines: [],
  relates_to: [],
  diagnostics: [],
  ...overrides,
});

describe("buildSpecInspectorModel", () => {
  it("derives direct dependency, refinement, and related groups", () => {
    const nodes = [
      node({
        node_id: "SG-SPEC-ROOT",
        depends_on: ["SG-SPEC-RUNTIME"],
        relates_to: ["SG-SPEC-EVIDENCE"],
      }),
      node({
        node_id: "SG-SPEC-RUNTIME",
        title: "Runtime contract",
        refines: ["SG-SPEC-ROOT"],
      }),
      node({ node_id: "SG-SPEC-EVIDENCE", title: "Evidence bridge" }),
    ];
    const edges: SpecEdge[] = [
      {
        edge_id: "depends",
        edge_kind: "depends_on",
        source_id: "SG-SPEC-ROOT",
        target_id: "SG-SPEC-RUNTIME",
        status: "resolved",
      },
      {
        edge_id: "refines",
        edge_kind: "refines",
        source_id: "SG-SPEC-RUNTIME",
        target_id: "SG-SPEC-ROOT",
        status: "resolved",
      },
      {
        edge_id: "relates",
        edge_kind: "relates_to",
        source_id: "SG-SPEC-ROOT",
        target_id: "SG-SPEC-EVIDENCE",
        status: "resolved",
      },
    ];

    const model = buildSpecInspectorModel({
      node: nodes[0],
      nodes,
      edges,
    });

    expect(model.maturityLabel).toBe("50%");
    expect(model.relationGroups.map((group) => group.id)).toEqual([
      "depends_on",
      "refines",
      "refined_by",
      "relates_to",
    ]);
    expect(model.relationGroups[0].items.map((item) => item.nodeId)).toEqual([
      "SG-SPEC-RUNTIME",
    ]);
    expect(model.relationGroups[2].items.map((item) => item.nodeId)).toEqual([
      "SG-SPEC-RUNTIME",
    ]);
    expect(model.relationGroups[3].items.map((item) => item.nodeId)).toEqual([
      "SG-SPEC-EVIDENCE",
    ]);
  });

  it("marks missing relation endpoints as broken", () => {
    const selected = node({
      node_id: "SG-SPEC-ROOT",
      depends_on: ["SG-SPEC-MISSING"],
      maturity: null,
    });

    const model = buildSpecInspectorModel({
      node: selected,
      nodes: [selected],
      edges: [],
    });

    expect(model.maturityLabel).toBe("n/a");
    expect(model.relationGroups[0].items).toEqual([
      {
        nodeId: "SG-SPEC-MISSING",
        title: null,
        status: "broken",
        edgeId: null,
      },
    ]);
  });
});
