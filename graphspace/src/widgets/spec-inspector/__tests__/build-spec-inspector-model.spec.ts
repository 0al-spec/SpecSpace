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
      specDir: "/tmp/specs/nodes",
      node: nodes[0],
      nodes,
      edges,
    });

    expect(model.maturityLabel).toBe("50%");
    expect(model.filePath).toBe("/tmp/specs/nodes/SG-SPEC-ROOT.yaml");
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
      specDir: "/tmp/specs/nodes/",
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

  it("extracts rich spec detail without losing compact metadata", () => {
    const selected = node({ node_id: "SG-SPEC-ROOT" });

    const model = buildSpecInspectorModel(
      {
        specDir: "/tmp/specs/nodes",
        node: selected,
        nodes: [selected],
        edges: [],
      },
      {
        id: "SG-SPEC-ROOT",
        created_at: "2026-04-03T12:19:31Z",
        updated_at: "2026-05-11T09:47:49Z",
        acceptance: [
          "Defines objective",
          { malformed: "criterion" },
        ],
        acceptance_evidence: [
          {
            criterion: "Defines objective",
            evidence: "specification.objective is present",
          },
        ],
        inputs: ["README.md"],
        outputs: ["specs/nodes/SG-SPEC-ROOT.yaml"],
        allowed_paths: ["specs/nodes/*.yaml"],
        prompt: "Refine this spec.",
        gate_state: "review_pending",
        specification: {
          objective: "Define the root ontology.",
          scope: {
            in: ["Node taxonomy"],
            out: ["Storage engine"],
          },
          terminology: {
            node: "A governed record.",
          },
          decisions: [
            {
              id: "D1",
              statement: "Keep YAML canonical.",
              rationale: "Humans can review it.",
            },
          ],
          invariants: [
            {
              id: "INV-1",
              statement: "Every node has a stable id.",
            },
          ],
        },
      },
    );

    expect(model.node.node_id).toBe("SG-SPEC-ROOT");
    expect(model.detail?.objective).toBe("Define the root ontology.");
    expect(model.detail?.scope?.in).toEqual(["Node taxonomy"]);
    expect(model.detail?.scope?.out).toEqual(["Storage engine"]);
    expect(model.detail?.acceptance[0]).toMatchObject({
      text: "Defines objective",
      malformed: false,
      hasEvidence: true,
    });
    expect(model.detail?.acceptance[1].malformed).toBe(true);
    expect(model.detail?.terminology).toEqual([
      { term: "node", definition: "A governed record." },
    ]);
    expect(model.detail?.decisions[0]).toEqual({
      id: "D1",
      statement: "Keep YAML canonical.",
      rationale: "Humans can review it.",
    });
    expect(model.detail?.invariants[0].id).toBe("INV-1");
    expect(model.detail?.inputs).toEqual(["README.md"]);
    expect(model.detail?.runtime).toEqual([
      { label: "Gate state", value: "review_pending" },
    ]);
  });

  it("normalizes loose raw detail fields after permissive parsing", () => {
    const selected = node({ node_id: "SG-SPEC-ROOT" });

    const model = buildSpecInspectorModel(
      {
        specDir: "/tmp/specs/nodes",
        node: selected,
        nodes: [selected],
        edges: [],
      },
      {
        id: "SG-SPEC-ROOT",
        acceptance: "Scalar acceptance criterion",
        acceptance_evidence: "Manual evidence note",
        inputs: "README.md",
        outputs: [{ path: "dist/spec.md" }],
        specification: null,
      },
    );

    expect(model.detail?.acceptance).toEqual([
      {
        text: "Scalar acceptance criterion",
        malformed: false,
        hasEvidence: false,
      },
    ]);
    expect(model.detail?.evidence).toEqual([
      { criterion: "Manual evidence note", evidence: null },
    ]);
    expect(model.detail?.inputs).toEqual(["README.md"]);
    expect(model.detail?.outputs).toEqual(['{\n  "path": "dist/spec.md"\n}']);
    expect(model.detail?.rawSpecification).toBeNull();
  });
});
