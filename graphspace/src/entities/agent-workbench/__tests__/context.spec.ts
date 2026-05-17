import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  agentContextItemKey,
  createAgentContextDraft,
  createSpecEdgeContextItem,
  createProposalContextItem,
  createSpecNodeContextItem,
  removeAgentContextItem,
  serializeAgentContextSet,
  type ProposalContextSource,
  type SpecEdgeContextSource,
  type SpecNodeContextSource,
} from "../index";

const node = (
  overrides: Partial<SpecNodeContextSource> = {},
): SpecNodeContextSource => ({
  node_id: "SG-SPEC-0001",
  file_name: "SG-SPEC-0001.yaml",
  title: "SpecGraph - The Executable Product Ontology",
  status: "linked",
  ...overrides,
});

const proposal = (
  overrides: Partial<ProposalContextSource> = {},
): ProposalContextSource => ({
  proposal_key: "proposal::0042",
  proposal_id: "0042",
  title: "Agent Context Bridge",
  status: "Draft proposal",
  proposal_path: "docs/proposals/0042_agent_context.md",
  affected_spec_ids: ["SG-SPEC-0001"],
  ...overrides,
});

const edge = (
  overrides: Partial<SpecEdgeContextSource> = {},
): SpecEdgeContextSource => ({
  edge_id: "SG-SPEC-0002-refines-SG-SPEC-0001",
  edge_kind: "refines",
  status: "resolved",
  source_id: "SG-SPEC-0002",
  target_id: "SG-SPEC-0001",
  source_title: "Child spec",
  target_title: "Parent spec",
  ...overrides,
});

describe("agent context draft", () => {
  it("serializes selected spec nodes into the workbench context_set shape", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const withNode = addAgentContextItem(draft, createSpecNodeContextItem(node()));
    const serialized = serializeAgentContextSet(withNode);

    expect(serialized).toEqual({
      context_set_id: "ctx-draft",
      created_at: "2026-05-17T16:00:00Z",
      label: "Graph context draft",
      items: [
        {
          kind: "spec_node",
          node_id: "SG-SPEC-0001",
          title: "SpecGraph - The Executable Product Ontology",
          status: "linked",
          file_name: "SG-SPEC-0001.yaml",
        },
      ],
    });
  });

  it("deduplicates context items by stable kind and id", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecNodeContextItem(node());

    const withDuplicate = addAgentContextItem(addAgentContextItem(draft, item), item);

    expect(withDuplicate.items).toHaveLength(1);
    expect(agentContextItemKey(item)).toBe("spec_node:SG-SPEC-0001");
  });

  it("serializes selected graph edges into the workbench context_set shape", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecEdgeContextItem(edge());
    const withEdge = addAgentContextItem(draft, item);

    expect(agentContextItemKey(item)).toBe("spec_edge:SG-SPEC-0002-refines-SG-SPEC-0001");
    expect(serializeAgentContextSet(withEdge).items).toEqual([
      {
        kind: "spec_edge",
        edge_id: "SG-SPEC-0002-refines-SG-SPEC-0001",
        edge_kind: "refines",
        status: "resolved",
        source_id: "SG-SPEC-0002",
        target_id: "SG-SPEC-0001",
        source_title: "Child spec",
        target_title: "Parent spec",
      },
    ]);
  });

  it("serializes proposal context items by stable proposal key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createProposalContextItem(proposal());
    const withProposal = addAgentContextItem(draft, item);
    const serialized = serializeAgentContextSet(withProposal);

    expect(agentContextItemKey(item)).toBe("proposal:proposal::0042");
    expect(serialized.items).toEqual([
      {
        kind: "proposal",
        proposal_key: "proposal::0042",
        proposal_id: "0042",
        title: "Agent Context Bridge",
        status: "Draft proposal",
        proposal_path: "docs/proposals/0042_agent_context.md",
        affected_spec_ids: ["SG-SPEC-0001"],
      },
    ]);

    const serializedProposal = serialized.items[0];
    if (serializedProposal.kind !== "proposal") {
      throw new Error("expected serialized proposal item");
    }
    serializedProposal.affected_spec_ids.push("SG-SPEC-0002");

    expect(withProposal.items[0]).toMatchObject({
      kind: "proposal",
      affected_spec_ids: ["SG-SPEC-0001"],
    });
  });

  it("removes context items by key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecNodeContextItem(node());
    const withNode = addAgentContextItem(draft, item);

    expect(removeAgentContextItem(withNode, agentContextItemKey(item)).items).toEqual([]);
  });
});
