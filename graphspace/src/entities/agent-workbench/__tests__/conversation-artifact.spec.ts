import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  createAgentContextDraft,
  createAgentConversationArtifactSnapshot,
  createAgentConversationIndexArtifact,
  createSpecMarkdownContextItem,
  type AgentConversationArtifactSource,
  type AgentRuntimeEvent,
} from "../index";

describe("agent conversation artifact snapshots", () => {
  it("builds a SpecSpace-owned conversation artifact from runtime history", () => {
    const context = addAgentContextItem(
      createAgentContextDraft("2026-05-21T08:59:00Z"),
      createSpecMarkdownContextItem({
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        scope: "node",
        source_kind: "hyperprompt_compile",
        download_filename: "SG-SPEC-0001.compiled.md",
        node_count: 1,
        markdown: "# SG-SPEC-0001\n\nRaw source markdown body.",
        compile: {
          exit_code: 0,
          compiled_md: "# SG-SPEC-0001\n\nRaw compiled markdown body.",
          manifest_json: "/tmp/specspace/manifest.json",
          root_hc: "/tmp/specspace/root.hc",
        },
      }),
    );
    const artifact = createAgentConversationArtifactSnapshot({
      ref: {
        conversation_id: "awb-conv-0001",
        title: "Review compiled spec",
        status: "active",
      },
      context_set: context,
      created_at: "2026-05-21T09:00:00Z",
      updated_at: "2026-05-21T09:05:00Z",
      turn_count: 2,
      event_count: fixtureEvents.length,
      events: fixtureEvents,
    });

    expect(artifact).toMatchObject({
      api_version: "v1",
      artifact_kind: "specspace_agent_conversation",
      schema_version: 1,
      conversation_id: "awb-conv-0001",
      title: "Review compiled spec",
      storage: {
        owner: "specspace",
        mutation_authority: "specspace_workbench_only",
      },
      context_sets: [
        {
          context_set_id: "ctx-draft",
          items: [
            {
              kind: "spec_markdown",
              markdown: "",
              compile: {
                compiled_md: null,
              },
            },
          ],
        },
      ],
      turns: [
        {
          turn_id: "turn-operator",
          role: "operator",
          content: [{ kind: "text", text: "Review attached context" }],
          context_set_ids: ["ctx-draft"],
        },
        {
          turn_id: "turn-agent",
          role: "agent",
          context_set_ids: ["ctx-draft"],
        },
      ],
      outputs: [
        {
          output_id: "out-analysis",
          kind: "analysis",
          origin_turn_id: "turn-agent",
          context_set_ids: ["ctx-draft"],
        },
        {
          output_id: "out-proposal",
          kind: "proposal_draft",
          origin_turn_id: "turn-agent",
          context_set_ids: ["ctx-draft"],
        },
      ],
      parent_refs: [],
    });
  });

  it("creates sorted index entries with output and context counts", () => {
    const older = createAgentConversationArtifactSnapshot(
      createSource("awb-conv-0001", "Older", "2026-05-21T09:00:00Z", []),
    );
    const newer = createAgentConversationArtifactSnapshot(
      createSource("awb-conv-0002", "Newer", "2026-05-21T10:00:00Z", fixtureEvents),
    );

    expect(createAgentConversationIndexArtifact([older, newer], "2026-05-21T10:01:00Z"))
      .toEqual({
        api_version: "v1",
        artifact_kind: "specspace_agent_conversation_index",
        schema_version: 1,
        generated_at: "2026-05-21T10:01:00Z",
        entry_count: 2,
        entries: [
          {
            conversation_id: "awb-conv-0002",
            title: "Newer",
            status: "active",
            updated_at: "2026-05-21T10:00:00Z",
            turn_count: 2,
            context_item_count: 0,
            output_count: 2,
            proposal_output_count: 1,
          },
          {
            conversation_id: "awb-conv-0001",
            title: "Older",
            status: "active",
            updated_at: "2026-05-21T09:00:00Z",
            turn_count: 0,
            context_item_count: 0,
            output_count: 0,
            proposal_output_count: 0,
          },
        ],
      });
  });
});

const fixtureEvents: AgentRuntimeEvent[] = [
  { kind: "turn_started", turn_id: "turn-operator", role: "operator" },
  { kind: "text_delta", turn_id: "turn-operator", text: "Review attached context" },
  { kind: "turn_completed", turn_id: "turn-operator" },
  { kind: "turn_started", turn_id: "turn-agent", role: "agent" },
  { kind: "text_delta", turn_id: "turn-agent", text: "I found one candidate." },
  {
    kind: "output_created",
    turn_id: "turn-agent",
    output_id: "out-analysis",
    output_kind: "analysis",
  },
  {
    kind: "output_created",
    turn_id: "turn-agent",
    output_id: "out-proposal",
    output_kind: "proposal_draft",
  },
  { kind: "turn_completed", turn_id: "turn-agent" },
];

function createSource(
  conversationId: string,
  title: string,
  updatedAt: string,
  events: AgentRuntimeEvent[],
): AgentConversationArtifactSource {
  return {
    ref: {
      conversation_id: conversationId,
      title,
      status: "active",
    },
    context_set: createAgentContextDraft("2026-05-21T08:59:00Z"),
    created_at: "2026-05-21T08:59:00Z",
    updated_at: updatedAt,
    turn_count: events.filter((event) => event.kind === "turn_started").length,
    event_count: events.length,
    events,
  };
}
