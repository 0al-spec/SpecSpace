import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  agentContextItemKey,
  createAgentContextDraft,
  createProposalContextItem,
  createSpecNodeContextItem,
  removeAgentContextItem,
  serializeAgentContextSet,
  type ProposalContextSource,
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

  it("serializes proposal context items by stable proposal key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createProposalContextItem(proposal());
    const withProposal = addAgentContextItem(draft, item);

    expect(agentContextItemKey(item)).toBe("proposal:proposal::0042");
    expect(serializeAgentContextSet(withProposal).items).toEqual([
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
  });

  it("removes context items by key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecNodeContextItem(node());
    const withNode = addAgentContextItem(draft, item);

    expect(removeAgentContextItem(withNode, agentContextItemKey(item)).items).toEqual([]);
  });
});
