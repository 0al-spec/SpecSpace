import { describe, expect, it } from "vitest";
import type { SpecNode } from "@/entities/spec-node";
import { filterSpecNodeNavigatorNodes } from "../model/filter";

const makeNode = (overrides: Partial<SpecNode> & Pick<SpecNode, "node_id" | "title" | "file_name">): SpecNode => ({
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
  ...overrides,
});

describe("filterSpecNodeNavigatorNodes", () => {
  const nodes = [
    makeNode({
      node_id: "SG-SPEC-0003",
      title: "Execution Boundary",
      file_name: "SG-SPEC-0003.yaml",
    }),
    makeNode({
      node_id: "SG-SPEC-0001",
      title: "SpecGraph Root Ontology",
      file_name: "SG-SPEC-0001.yaml",
    }),
    makeNode({
      node_id: "SG-SPEC-0002",
      title: "Runtime Contract",
      file_name: "runtime-contract.yaml",
    }),
  ];

  it("returns nodes in stable node id order for an empty query", () => {
    expect(filterSpecNodeNavigatorNodes(nodes, "").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0001",
      "SG-SPEC-0002",
      "SG-SPEC-0003",
    ]);
  });

  it("matches by node id, title, and file name", () => {
    expect(filterSpecNodeNavigatorNodes(nodes, "0002").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0002",
    ]);
    expect(filterSpecNodeNavigatorNodes(nodes, "root").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0001",
    ]);
    expect(filterSpecNodeNavigatorNodes(nodes, "runtime-contract").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0002",
    ]);
  });

  it("trims and lowercases the query", () => {
    expect(filterSpecNodeNavigatorNodes(nodes, "  EXECUTION  ").map((node) => node.node_id)).toEqual([
      "SG-SPEC-0003",
    ]);
  });
});
