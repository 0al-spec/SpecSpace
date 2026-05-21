import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  createAgentContextDraft,
  createSpecMarkdownContextItem,
  createSpecNodeContextItem,
  projectAgentRuntimeEvents,
} from "@/entities/agent-workbench";
import { createMockAgentConversationRuntime } from "../index";

describe("createMockAgentConversationRuntime", () => {
  it("starts deterministic conversations and streams operator plus agent turns", async () => {
    const runtime = createMockAgentConversationRuntime({
      id_prefix: "test-awb",
      now: () => "2026-05-17T18:30:00Z",
    });
    const context = addAgentContextItem(
      createAgentContextDraft("2026-05-17T18:29:00Z"),
      createSpecNodeContextItem({
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        status: "linked",
        file_name: "SG-SPEC-0001.yaml",
      }),
    );

    const conversation = await runtime.startConversation({
      title: " Review SG-SPEC-0001 ",
      context_set: context,
    });
    const events = await collectAsyncIterable(
      runtime.sendMessage({
        conversation_id: conversation.conversation_id,
        text: "Summarize current gaps",
      }),
    );

    expect(conversation).toEqual({
      conversation_id: "test-awb-conv-0001",
      title: "Review SG-SPEC-0001",
      status: "active",
    });
    expect(projectAgentRuntimeEvents(events)).toEqual({
      turns: [
        {
          turn_id: "test-awb-turn-0001",
          role: "operator",
          text: "Summarize current gaps",
          tool_calls: [],
          outputs: [],
          completed: true,
        },
        {
          turn_id: "test-awb-turn-0002",
          role: "agent",
          text:
            'Mock agent received "Summarize current gaps" with 1 context item.' +
            "\n\nAttached context:\n" +
            "- SG-SPEC-0001: spec node (linked, SG-SPEC-0001.yaml)",
          tool_calls: [
            {
              tool_call_id: "test-awb-turn-0002-tool-context",
              tool_name: "attach_context",
              title: "Attach 1 context item",
            },
          ],
          outputs: [
            {
              output_id: "test-awb-out-0001",
              output_kind: "analysis",
            },
          ],
          completed: true,
        },
      ],
    });
    expect(runtime.getConversation(conversation.conversation_id)).toMatchObject({
      created_at: "2026-05-17T18:30:00Z",
      updated_at: "2026-05-17T18:30:00Z",
      turn_count: 2,
    });
  });

  it("uses initial prompt as fallback title and rejects unknown conversations", async () => {
    const runtime = createMockAgentConversationRuntime({
      id_prefix: "test-awb",
      now: () => "2026-05-17T18:30:00Z",
    });

    const conversation = await runtime.startConversation({
      title: "",
      initial_prompt: "Investigate proposal drift",
      context_set: createAgentContextDraft("2026-05-17T18:29:00Z"),
    });

    await expect(
      collectAsyncIterable(
        runtime.sendMessage({
          conversation_id: "missing-conversation",
          text: "Hello",
        }),
      ),
    ).rejects.toThrow("Unknown mock Agent Workbench conversation");
    expect(conversation.title).toBe("Investigate proposal drift");
  });

  it("summarizes Spec Markdown context without rendering raw Markdown", async () => {
    const runtime = createMockAgentConversationRuntime({
      id_prefix: "test-awb",
      now: () => "2026-05-17T18:30:00Z",
    });
    const context = addAgentContextItem(
      createAgentContextDraft("2026-05-17T18:29:00Z"),
      createSpecMarkdownContextItem({
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        scope: "subtree",
        source_kind: "hyperprompt_compile",
        download_filename: "SG-SPEC-0001.compiled.md",
        node_count: 65,
        markdown: "# SG-SPEC-0001\n\nDo not render this raw body.",
        compile: {
          exit_code: 0,
          compiled_md: "/tmp/specspace/out.compiled.md",
          manifest_json: "/tmp/specspace/manifest.json",
          root_hc: "/tmp/specspace/root.hc",
        },
      }),
    );

    const conversation = await runtime.startConversation({
      title: "Review compiled markdown",
      context_set: context,
    });
    const events = await collectAsyncIterable(
      runtime.sendMessage({
        conversation_id: conversation.conversation_id,
        text: "Review attached artifact",
      }),
    );
    const agentTurn = projectAgentRuntimeEvents(events).turns.find(
      (turn) => turn.role === "agent",
    );

    expect(agentTurn?.text).toContain(
      "- SG-SPEC-0001 Hyperprompt compile: refinement subtree, 65 nodes, SG-SPEC-0001.compiled.md",
    );
    expect(agentTurn?.text).not.toContain("Do not render this raw body");
  });

  it("lists conversations newest first and replays stored transcript on resume", async () => {
    const timestamps = [
      "2026-05-17T18:30:00Z",
      "2026-05-17T18:31:00Z",
      "2026-05-17T18:32:00Z",
      "2026-05-17T18:33:00Z",
    ];
    const runtime = createMockAgentConversationRuntime({
      id_prefix: "test-awb",
      now: () => timestamps.shift() ?? "2026-05-17T18:34:00Z",
    });

    const first = await runtime.startConversation({
      title: "First context pass",
      context_set: createAgentContextDraft("2026-05-17T18:29:00Z"),
    });
    const firstEvents = await collectAsyncIterable(
      runtime.sendMessage({
        conversation_id: first.conversation_id,
        text: "Summarize first",
      }),
    );
    const second = await runtime.startConversation({
      title: "Second context pass",
      context_set: createAgentContextDraft("2026-05-17T18:29:00Z"),
    });
    await collectAsyncIterable(
      runtime.sendMessage({
        conversation_id: second.conversation_id,
        text: "Summarize second",
      }),
    );

    expect(runtime.listConversations().map((record) => record.ref.conversation_id)).toEqual([
      second.conversation_id,
      first.conversation_id,
    ]);
    expect(runtime.getConversation(first.conversation_id)).toMatchObject({
      updated_at: "2026-05-17T18:31:00Z",
      turn_count: 2,
      event_count: firstEvents.length,
    });

    const resumed = await collectAsyncIterable(runtime.resumeConversation(first.conversation_id));
    expect(resumed).toEqual(firstEvents);
    expect(projectAgentRuntimeEvents(resumed)).toEqual(projectAgentRuntimeEvents(firstEvents));
  });

  it("defensively clones conversation history records", async () => {
    const runtime = createMockAgentConversationRuntime({
      id_prefix: "test-awb",
      now: () => "2026-05-17T18:30:00Z",
    });
    const context = addAgentContextItem(
      createAgentContextDraft("2026-05-17T18:29:00Z"),
      createSpecNodeContextItem({
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        status: "linked",
        file_name: "SG-SPEC-0001.yaml",
      }),
    );
    const conversation = await runtime.startConversation({
      title: "Clone safety",
      context_set: context,
    });
    await collectAsyncIterable(
      runtime.sendMessage({
        conversation_id: conversation.conversation_id,
        text: "Inspect clone",
      }),
    );

    const clone = runtime.getConversation(conversation.conversation_id);
    expect(clone).not.toBeNull();
    clone!.context_set.items.length = 0;
    clone!.events.length = 0;

    const freshClone = runtime.getConversation(conversation.conversation_id);
    expect(freshClone?.context_set.items).toHaveLength(1);
    expect(freshClone?.events.length).toBeGreaterThan(0);
  });

  it("replays Spec Markdown summary without raw Markdown on resume", async () => {
    const runtime = createMockAgentConversationRuntime({
      id_prefix: "test-awb",
      now: () => "2026-05-17T18:30:00Z",
    });
    const context = addAgentContextItem(
      createAgentContextDraft("2026-05-17T18:29:00Z"),
      createSpecMarkdownContextItem({
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        scope: "node",
        source_kind: "hyperprompt_compile",
        download_filename: "SG-SPEC-0001.md",
        node_count: 1,
        markdown: "# SG-SPEC-0001\n\nRaw body must stay hidden after resume.",
        compile: {
          exit_code: 0,
          compiled_md: "# SG-SPEC-0001\n\nCompiled raw body must stay hidden too.",
          manifest_json: "/tmp/specspace/manifest.json",
          root_hc: "/tmp/specspace/root.hc",
        },
      }),
    );
    const conversation = await runtime.startConversation({
      title: "Resume markdown",
      context_set: context,
    });
    await collectAsyncIterable(
      runtime.sendMessage({
        conversation_id: conversation.conversation_id,
        text: "Review attached markdown",
      }),
    );

    const resumedProjection = projectAgentRuntimeEvents(
      await collectAsyncIterable(runtime.resumeConversation(conversation.conversation_id)),
    );
    const transcriptText = resumedProjection.turns.map((turn) => turn.text).join("\n");
    const historyMarkdown = runtime
      .getConversation(conversation.conversation_id)
      ?.context_set.items.find((item) => item.kind === "spec_markdown");

    expect(transcriptText).toContain("SG-SPEC-0001 Hyperprompt compile");
    expect(transcriptText).not.toContain("Raw body must stay hidden after resume");
    expect(transcriptText).not.toContain("Compiled raw body must stay hidden too");
    if (historyMarkdown?.kind === "spec_markdown") {
      expect(historyMarkdown.markdown).toBe("");
      expect(historyMarkdown.compile?.compiled_md).toBeNull();
    }
  });
});

async function collectAsyncIterable<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}
