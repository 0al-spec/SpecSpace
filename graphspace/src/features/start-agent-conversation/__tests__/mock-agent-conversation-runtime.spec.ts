import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  createAgentContextDraft,
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
          text: 'Mock agent received "Summarize current gaps" with 1 context item.',
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
});

async function collectAsyncIterable<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}
