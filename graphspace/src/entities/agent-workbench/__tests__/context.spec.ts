import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  agentContextItemKey,
  createAgentContextDraft,
  createSpecNodeContextItem,
  removeAgentContextItem,
  serializeAgentContextSet,
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

  it("removes context items by key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecNodeContextItem(node());
    const withNode = addAgentContextItem(draft, item);

    expect(removeAgentContextItem(withNode, agentContextItemKey(item)).items).toEqual([]);
  });
});
