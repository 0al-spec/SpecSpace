import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  createAgentContextDraft,
  createAgentConversationArtifactSnapshot,
  createAgentConversationIndexArtifact,
  createSpecGapContextItem,
  createSpecMarkdownContextItem,
  createSpecNodeContextItem,
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
    const events = fixtureEvents(context);
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
      event_count: events.length,
      events,
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
              kind: "external_link",
              artifact_path: "SG-SPEC-0001.compiled.md",
              source_kind: "hyperprompt_compile",
              node_id: "SG-SPEC-0001",
              scope: "node",
              node_count: 1,
            },
          ],
        },
      ],
      turns: [
        {
          turn_id: "turn-operator",
          role: "operator",
          created_at: "2026-05-21T09:01:00Z",
          content: [{ kind: "text", text: "Review attached context" }],
          context_set_ids: ["ctx-draft"],
        },
        {
          turn_id: "turn-agent",
          role: "agent",
          created_at: "2026-05-21T09:02:00Z",
          context_set_ids: ["ctx-draft"],
        },
      ],
      outputs: [
        {
          output_id: "out-analysis",
          kind: "analysis",
          created_at: "2026-05-21T09:02:10Z",
          origin_turn_id: "turn-agent",
          context_set_ids: ["ctx-draft"],
        },
        {
          output_id: "out-proposal",
          kind: "proposal_draft",
          created_at: "2026-05-21T09:02:15Z",
          origin_turn_id: "turn-agent",
          context_set_ids: ["ctx-draft"],
        },
      ],
      parent_refs: [],
    });
    expect(JSON.stringify(artifact)).not.toContain("Raw source markdown body");
    expect(JSON.stringify(artifact)).not.toContain("Raw compiled markdown body");
  });

  it("preserves per-turn context sets when context changes mid-conversation", () => {
    const firstContext = addAgentContextItem(
      createAgentContextDraft("2026-05-21T09:00:00Z"),
      createSpecNodeContextItem({
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        status: "linked",
        file_name: "SG-SPEC-0001.yaml",
      }),
    );
    const secondContext = addAgentContextItem(
      createAgentContextDraft("2026-05-21T09:03:00Z"),
      createSpecGapContextItem({
        node_id: "SG-SPEC-0002",
        title: "SpecGraph - Spec Refinement and Linkage Policy",
        gap_kind: "evidence",
        gap_count: 2,
      }),
    );

    const artifact = createAgentConversationArtifactSnapshot({
      ref: {
        conversation_id: "awb-conv-0002",
        title: "Context changed",
        status: "active",
      },
      context_set: secondContext,
      created_at: "2026-05-21T09:00:00Z",
      updated_at: "2026-05-21T09:04:00Z",
      turn_count: 2,
      event_count: 4,
      events: [
        {
          kind: "turn_started",
          turn_id: "turn-first",
          role: "operator",
          created_at: "2026-05-21T09:01:00Z",
          context_set: firstContext,
        },
        { kind: "turn_completed", turn_id: "turn-first", created_at: "2026-05-21T09:01:10Z" },
        {
          kind: "turn_started",
          turn_id: "turn-second",
          role: "agent",
          created_at: "2026-05-21T09:04:00Z",
          context_set: secondContext,
        },
        {
          kind: "output_created",
          turn_id: "turn-second",
          output_id: "out-second",
          output_kind: "analysis",
          created_at: "2026-05-21T09:04:05Z",
        },
      ],
    });

    expect(artifact.context_sets).toMatchObject([
      {
        context_set_id: "ctx-draft",
        items: [{ kind: "gap", node_id: "SG-SPEC-0002" }],
      },
      {
        context_set_id: "ctx-draft-2",
        items: [{ kind: "spec_node", node_id: "SG-SPEC-0001" }],
      },
    ]);
    expect(artifact.turns).toMatchObject([
      {
        turn_id: "turn-first",
        created_at: "2026-05-21T09:01:00Z",
        context_set_ids: ["ctx-draft-2"],
      },
      {
        turn_id: "turn-second",
        created_at: "2026-05-21T09:04:00Z",
        context_set_ids: ["ctx-draft"],
      },
    ]);
    expect(artifact.outputs).toMatchObject([
      {
        output_id: "out-second",
        created_at: "2026-05-21T09:04:05Z",
        context_set_ids: ["ctx-draft"],
      },
    ]);
  });

  it("preserves distinct context snapshots with matching labels and items", () => {
    const sharedItem = createSpecNodeContextItem({
      node_id: "SG-SPEC-0001",
      title: "SpecGraph - The Executable Product Ontology",
      status: "linked",
      file_name: "SG-SPEC-0001.yaml",
    });
    const firstContext = {
      ...addAgentContextItem(createAgentContextDraft("2026-05-21T09:00:00Z"), sharedItem),
      context_set_id: "ctx-first",
    };
    const secondContext = {
      ...addAgentContextItem(createAgentContextDraft("2026-05-21T09:03:00Z"), sharedItem),
      context_set_id: "ctx-second",
    };

    const artifact = createAgentConversationArtifactSnapshot({
      ref: {
        conversation_id: "awb-conv-0003",
        title: "Matching content snapshots",
        status: "active",
      },
      context_set: secondContext,
      created_at: "2026-05-21T09:00:00Z",
      updated_at: "2026-05-21T09:04:00Z",
      turn_count: 2,
      event_count: 2,
      events: [
        {
          kind: "turn_started",
          turn_id: "turn-first",
          role: "operator",
          created_at: "2026-05-21T09:01:00Z",
          context_set: firstContext,
        },
        {
          kind: "turn_started",
          turn_id: "turn-second",
          role: "agent",
          created_at: "2026-05-21T09:04:00Z",
          context_set: secondContext,
        },
      ],
    });

    expect(artifact.context_sets).toMatchObject([
      {
        context_set_id: "ctx-second",
        created_at: "2026-05-21T09:03:00Z",
        items: [{ kind: "spec_node", node_id: "SG-SPEC-0001" }],
      },
      {
        context_set_id: "ctx-first",
        created_at: "2026-05-21T09:00:00Z",
        items: [{ kind: "spec_node", node_id: "SG-SPEC-0001" }],
      },
    ]);
    expect(artifact.turns).toMatchObject([
      {
        turn_id: "turn-first",
        context_set_ids: ["ctx-first"],
      },
      {
        turn_id: "turn-second",
        context_set_ids: ["ctx-second"],
      },
    ]);
  });

  it("creates sorted index entries with output and context counts", () => {
    const older = createAgentConversationArtifactSnapshot(
      createSource("awb-conv-0001", "Older", "2026-05-21T09:00:00Z", []),
    );
    const newer = createAgentConversationArtifactSnapshot(
      createSource(
        "awb-conv-0002",
        "Newer",
        "2026-05-21T10:00:00Z",
        fixtureEvents(createAgentContextDraft("2026-05-21T08:59:00Z")),
      ),
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

function fixtureEvents(
  contextSet: AgentConversationArtifactSource["context_set"],
): AgentRuntimeEvent[] {
  return [
    {
      kind: "turn_started",
      turn_id: "turn-operator",
      role: "operator",
      created_at: "2026-05-21T09:01:00Z",
      context_set: contextSet,
    },
    {
      kind: "text_delta",
      turn_id: "turn-operator",
      text: "Review attached context",
      created_at: "2026-05-21T09:01:05Z",
    },
    {
      kind: "turn_completed",
      turn_id: "turn-operator",
      created_at: "2026-05-21T09:01:10Z",
    },
    {
      kind: "turn_started",
      turn_id: "turn-agent",
      role: "agent",
      created_at: "2026-05-21T09:02:00Z",
      context_set: contextSet,
    },
    {
      kind: "text_delta",
      turn_id: "turn-agent",
      text: "I found one candidate.",
      created_at: "2026-05-21T09:02:05Z",
    },
    {
      kind: "output_created",
      turn_id: "turn-agent",
      output_id: "out-analysis",
      output_kind: "analysis",
      created_at: "2026-05-21T09:02:10Z",
    },
    {
      kind: "output_created",
      turn_id: "turn-agent",
      output_id: "out-proposal",
      output_kind: "proposal_draft",
      created_at: "2026-05-21T09:02:15Z",
    },
    {
      kind: "turn_completed",
      turn_id: "turn-agent",
      created_at: "2026-05-21T09:02:20Z",
    },
  ];
}

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
