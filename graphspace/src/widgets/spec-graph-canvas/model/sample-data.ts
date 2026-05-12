import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphResponse, SpecGraphSummary } from "@/shared/spec-graph-contract";

const SAMPLE_NODES: SpecNode[] = [
  {
    node_id: "SG-SPEC-SAMPLE-ROOT",
    file_name: "SG-SPEC-SAMPLE-ROOT.yaml",
    title: "SpecGraph canvas root",
    kind: "spec",
    status: "linked",
    maturity: 0.78,
    acceptance_count: 3,
    decisions_count: 2,
    evidence_gap: 1,
    input_gap: 0,
    execution_gap: 0,
    gap_count: 1,
    depends_on: ["SG-SPEC-SAMPLE-RUNTIME"],
    refines: [],
    relates_to: ["SG-SPEC-SAMPLE-EVIDENCE"],
    diagnostics: [],
    updated_at: "2026-05-12T10:00:00+00:00",
    presence_state: "canonical",
  },
  {
    node_id: "SG-SPEC-SAMPLE-RUNTIME",
    file_name: "SG-SPEC-SAMPLE-RUNTIME.yaml",
    title: "Runtime capability contract",
    kind: "requirement",
    status: "specified",
    maturity: 0.64,
    acceptance_count: 2,
    decisions_count: 1,
    evidence_gap: 0,
    input_gap: 1,
    execution_gap: 1,
    gap_count: 2,
    depends_on: [],
    refines: ["SG-SPEC-SAMPLE-ROOT"],
    relates_to: [],
    diagnostics: [],
    updated_at: "2026-05-12T09:20:00+00:00",
    presence_state: null,
  },
  {
    node_id: "SG-SPEC-SAMPLE-EVIDENCE",
    file_name: "SG-SPEC-SAMPLE-EVIDENCE.yaml",
    title: "Evidence registry bridge",
    kind: "decision",
    status: "outlined",
    maturity: 0.42,
    acceptance_count: 1,
    decisions_count: 1,
    evidence_gap: 0,
    input_gap: 0,
    execution_gap: 1,
    gap_count: 1,
    depends_on: [],
    refines: [],
    relates_to: [],
    diagnostics: [],
    updated_at: "2026-05-11T18:30:00+00:00",
    presence_state: null,
  },
];

const SAMPLE_EDGES: SpecEdge[] = [
  {
    edge_id: "SG-SPEC-SAMPLE-ROOT__depends_on__SG-SPEC-SAMPLE-RUNTIME",
    edge_kind: "depends_on",
    source_id: "SG-SPEC-SAMPLE-ROOT",
    target_id: "SG-SPEC-SAMPLE-RUNTIME",
    status: "resolved",
  },
  {
    edge_id: "SG-SPEC-SAMPLE-RUNTIME__refines__SG-SPEC-SAMPLE-ROOT",
    edge_kind: "refines",
    source_id: "SG-SPEC-SAMPLE-RUNTIME",
    target_id: "SG-SPEC-SAMPLE-ROOT",
    status: "resolved",
  },
  {
    edge_id: "SG-SPEC-SAMPLE-ROOT__relates_to__SG-SPEC-SAMPLE-EVIDENCE",
    edge_kind: "relates_to",
    source_id: "SG-SPEC-SAMPLE-ROOT",
    target_id: "SG-SPEC-SAMPLE-EVIDENCE",
    status: "resolved",
  },
];

const SAMPLE_SUMMARY: SpecGraphSummary = {
  node_count: SAMPLE_NODES.length,
  edge_count: SAMPLE_EDGES.length,
  root_count: 2,
  blocked_file_count: 0,
  diagnostic_count: 0,
  broken_edge_count: 0,
};

export const SAMPLE_SPEC_GRAPH: SpecGraphResponse = {
  spec_dir: "sample://graphspace/specs/nodes",
  graph: {
    nodes: SAMPLE_NODES,
    edges: SAMPLE_EDGES,
    roots: ["SG-SPEC-SAMPLE-RUNTIME", "SG-SPEC-SAMPLE-EVIDENCE"],
    blocked_files: [],
    diagnostics: [],
    summary: SAMPLE_SUMMARY,
  },
  summary: SAMPLE_SUMMARY,
};
