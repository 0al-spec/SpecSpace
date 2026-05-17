import { describe, expect, it } from "vitest";
import {
  agentContextItemKey,
  createAgentContextDraft,
} from "@/entities/agent-workbench";
import type { SpecNode } from "@/entities/spec-node";
import { addSpecNodeToAgentContext } from "../index";

const node = (overrides: Partial<SpecNode> = {}): SpecNode => ({
  node_id: "SG-SPEC-0001",
  file_name: "SG-SPEC-0001.yaml",
  title: "SpecGraph - The Executable Product Ontology",
  kind: "spec",
  status: "linked",
  maturity: 1,
  acceptance_count: 9,
  decisions_count: 7,
  evidence_gap: 0,
  input_gap: 1,
  execution_gap: 2,
  gap_count: 3,
  depends_on: [],
  refines: [],
  relates_to: [],
  diagnostics: [],
  ...overrides,
});

describe("addSpecNodeToAgentContext", () => {
  it("maps the selected SpecGraph node through the Agent Workbench entity boundary", () => {
    const draft = createAgentContextDraft("2026-05-17T17:00:00Z");

    const next = addSpecNodeToAgentContext(draft, node());

    expect(next.items).toEqual([
      {
        kind: "spec_node",
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        status: "linked",
        file_name: "SG-SPEC-0001.yaml",
      },
    ]);
    expect(agentContextItemKey(next.items[0])).toBe("spec_node:SG-SPEC-0001");
  });
});
