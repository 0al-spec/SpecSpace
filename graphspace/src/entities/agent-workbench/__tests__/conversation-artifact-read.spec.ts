import { describe, expect, it } from "vitest";
import {
  fetchAgentConversationArtifact,
  fetchAgentConversationIndex,
  parseAgentConversationArtifact,
  parseAgentConversationIndexArtifact,
  projectAgentConversationArtifactToProjection,
} from "../index";

const indexFixture = {
  api_version: "v1",
  artifact_kind: "specspace_agent_conversation_index",
  schema_version: 1,
  generated_at: "2026-05-17T16:06:00Z",
  entry_count: 1,
  entries: [
    {
      conversation_id: "awb-conv-0001",
      title: "Review SIB metric gaps",
      status: "active",
      updated_at: "2026-05-17T16:05:00Z",
      turn_count: 2,
      context_item_count: 6,
      output_count: 1,
      proposal_output_count: 1,
    },
  ],
};

const conversationFixture = {
  api_version: "v1",
  artifact_kind: "specspace_agent_conversation",
  schema_version: 1,
  conversation_id: "awb-conv-0001",
  title: "Review SIB metric gaps",
  status: "active",
  created_at: "2026-05-17T16:00:00Z",
  updated_at: "2026-05-17T16:05:00Z",
  storage: {
    owner: "specspace",
    mutation_authority: "specspace_workbench_only",
  },
  participants: [],
  context_sets: [
    {
      context_set_id: "ctx-0001",
      created_at: "2026-05-17T16:00:30Z",
      label: "SIB graph context",
      items: [
        {
          kind: "spec_node",
          node_id: "SG-SPEC-0001",
          title: "SpecGraph - The Executable Product Ontology",
        },
        {
          kind: "spec_edge",
          source_node_id: "SG-SPEC-0001",
          target_node_id: "SG-SPEC-0021",
          edge_kind: "relates_to",
        },
        {
          kind: "gap",
          node_id: "SG-SPEC-0021",
          gap_id: "gap-metric-threshold-authority",
          path: "specification.gaps[0]",
        },
      ],
    },
  ],
  turns: [
    {
      turn_id: "turn-0001",
      role: "operator",
      created_at: "2026-05-17T16:01:00Z",
      content: [{ kind: "markdown", text: "Analyze why SIB is below threshold." }],
      context_set_ids: ["ctx-0001"],
    },
    {
      turn_id: "turn-0002",
      role: "agent",
      created_at: "2026-05-17T16:04:00Z",
      content: [
        {
          kind: "markdown",
          text: "SIB needs explicit threshold authority before promotion.",
        },
      ],
      context_set_ids: ["ctx-0001"],
    },
  ],
  outputs: [
    {
      output_id: "out-0001",
      kind: "proposal_draft",
      created_at: "2026-05-17T16:05:00Z",
      origin_turn_id: "turn-0002",
      context_set_ids: ["ctx-0001"],
      proposal: {
        proposal_key: "agent-proposal::awb-conv-0001::out-0001",
        title: "Attach SIB threshold authority",
        status: "draft",
        target_spec_ids: ["SG-SPEC-0021"],
      },
    },
  ],
  parent_refs: [],
};

describe("Agent Workbench conversation artifact reads", () => {
  it("parses the readonly conversation index contract", () => {
    expect(parseAgentConversationIndexArtifact(indexFixture)).toEqual({
      kind: "ok",
      data: indexFixture,
    });
  });

  it("normalizes stored conversation artifacts and projects transcript turns", () => {
    const parsed = parseAgentConversationArtifact(conversationFixture);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.context_sets[0].items).toMatchObject([
      {
        kind: "spec_node",
        node_id: "SG-SPEC-0001",
        status: "unknown",
        file_name: "SG-SPEC-0001.yaml",
      },
      {
        kind: "spec_edge",
        edge_id: "SG-SPEC-0001->SG-SPEC-0021:relates_to",
      },
      {
        kind: "gap",
        gap_kind: "evidence",
        gap_count: 0,
      },
    ]);
    expect(projectAgentConversationArtifactToProjection(parsed.data)).toEqual({
      turns: [
        {
          turn_id: "turn-0001",
          role: "operator",
          text: "Analyze why SIB is below threshold.",
          tool_calls: [],
          outputs: [],
          completed: true,
        },
        {
          turn_id: "turn-0002",
          role: "agent",
          text: "SIB needs explicit threshold authority before promotion.",
          tool_calls: [],
          outputs: [{ output_id: "out-0001", output_kind: "proposal_draft" }],
          completed: true,
        },
      ],
    });
  });

  it("fetches the conversation index through the v1 API wrapper", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          api_version: "v1",
          source: {
            name: "agent_workbench_conversations",
            path: "/tmp/workbench/conversations",
            status: "ok",
            item_count: 1,
          },
          data: indexFixture,
        }),
        { status: 200 },
      );

    const result = await fetchAgentConversationIndex({ fetcher });

    expect(result).toEqual({
      kind: "ok",
      data: indexFixture,
      source: {
        name: "agent_workbench_conversations",
        path: "/tmp/workbench/conversations",
        status: "ok",
        item_count: 1,
      },
    });
  });

  it("fetches a selected conversation with encoded id", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({
          api_version: "v1",
          conversation_id: "awb conv",
          source: null,
          data: { ...conversationFixture, conversation_id: "awb conv" },
        }),
        { status: 200 },
      );
    };

    const result = await fetchAgentConversationArtifact({
      conversationId: "awb conv",
      fetcher,
    });

    expect(calls).toEqual(["/api/v1/agent-workbench/conversations/awb%20conv"]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.data.conversation_id).toBe("awb conv");
    }
  });

  it("keeps unconfigured stores as bounded HTTP diagnostics", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          api_version: "v1",
          reason: "agent_workbench_store_unavailable",
        }),
        { status: 503, statusText: "Service Unavailable" },
      );

    expect(await fetchAgentConversationIndex({ fetcher })).toMatchObject({
      kind: "http-error",
      status: 503,
      body: {
        reason: "agent_workbench_store_unavailable",
      },
    });
  });
});
