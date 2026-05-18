import { describe, expect, it } from "vitest";
import type { SpecNode } from "@/entities/spec-node";
import {
  countSpecGraphCanvasGapFilters,
  filterSpecGraphCanvasNodes,
} from "../model/gap-filter";

const makeNode = (
  overrides: Partial<SpecNode> & Pick<SpecNode, "node_id">,
): SpecNode => {
  const { node_id, ...rest } = overrides;
  return {
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
    refines: [],
    relates_to: [],
    diagnostics: [],
    ...rest,
  };
};

describe("filterSpecGraphCanvasNodes", () => {
  const nodes = [
    makeNode({ node_id: "SG-SPEC-0001" }),
    makeNode({
      node_id: "SG-SPEC-0002",
      evidence_gap: 2,
      gap_count: 2,
    }),
    makeNode({
      node_id: "SG-SPEC-0003",
      input_gap: 1,
      execution_gap: 1,
      gap_count: 2,
    }),
  ];

  it("keeps all nodes for the default filter", () => {
    expect(filterSpecGraphCanvasNodes(nodes, "all").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0001",
      "SG-SPEC-0002",
      "SG-SPEC-0003",
    ]);
  });

  it("filters by any gap and by individual gap kind", () => {
    expect(filterSpecGraphCanvasNodes(nodes, "any").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0002",
      "SG-SPEC-0003",
    ]);
    expect(filterSpecGraphCanvasNodes(nodes, "evidence").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0002",
    ]);
    expect(filterSpecGraphCanvasNodes(nodes, "execution").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0003",
    ]);
  });
});

describe("countSpecGraphCanvasGapFilters", () => {
  it("counts all filter buckets", () => {
    expect(countSpecGraphCanvasGapFilters([
      makeNode({ node_id: "SG-SPEC-0001" }),
      makeNode({ node_id: "SG-SPEC-0002", evidence_gap: 1, gap_count: 1 }),
      makeNode({ node_id: "SG-SPEC-0003", input_gap: 1, execution_gap: 1, gap_count: 2 }),
    ])).toEqual({
      all: 3,
      any: 2,
      evidence: 1,
      input: 1,
      execution: 1,
    });
  });
});
