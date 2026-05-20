import { describe, expect, it } from "vitest";
import {
  createAssistantUiExternalStoreAdapter,
  mapAgentProjectionToAssistantUiMessages,
} from "../model/assistant-ui-adapter";

describe("assistant-ui adapter", () => {
  it("maps SpecSpace runtime projection into assistant-ui external store messages", () => {
    const messages = mapAgentProjectionToAssistantUiMessages({
      turns: [
        {
          turn_id: "turn-operator",
          role: "operator",
          text: "Review SG-SPEC-0001",
          tool_calls: [],
          outputs: [],
          completed: true,
        },
        {
          turn_id: "turn-agent",
          role: "agent",
          text: "SG-SPEC-0001 has proposal context.",
          tool_calls: [
            {
              tool_call_id: "tool-context",
              tool_name: "attach_context",
              title: "Attach 1 context item",
            },
          ],
          outputs: [
            {
              output_id: "output-analysis",
              output_kind: "analysis",
            },
          ],
          completed: false,
        },
      ],
    });

    expect(messages).toMatchObject([
      {
        id: "turn-operator",
        role: "user",
        metadata: {
          custom: {
            specspace_turn_id: "turn-operator",
            specspace_role: "operator",
          },
        },
      },
      {
        id: "turn-agent",
        role: "assistant",
        status: { type: "running" },
        metadata: {
          custom: {
            specspace_turn_id: "turn-agent",
            specspace_role: "agent",
          },
        },
      },
    ]);
    expect(messages[0]).not.toHaveProperty("status");
    expect(messages[1]?.content).toEqual([
      {
        type: "text",
        text: "SG-SPEC-0001 has proposal context.",
      },
      {
        type: "tool-call",
        toolCallId: "tool-context",
        toolName: "attach_context",
        args: {
          title: "Attach 1 context item",
        },
        argsText: "Attach 1 context item",
        result: {
          title: "Attach 1 context item",
        },
      },
      {
        type: "data",
        name: "specspace.output",
        data: {
          output_id: "output-analysis",
          output_kind: "analysis",
        },
      },
    ]);
  });

  it("creates a read-only external store adapter without leaking assistant-ui types upstream", async () => {
    const adapter = createAssistantUiExternalStoreAdapter({
      projection: {
        turns: [
          {
            turn_id: "turn-system",
            role: "system",
            text: "System note",
            tool_calls: [],
            outputs: [],
            completed: true,
          },
        ],
      },
      is_running: true,
    });

    expect(adapter.isRunning).toBe(true);
    expect(adapter.messages).toHaveLength(1);
    expect(adapter.convertMessage?.(adapter.messages?.[0] ?? { role: "system", content: "" }, 0))
      .toEqual(adapter.messages?.[0]);
    await expect(
      adapter.onNew({
        role: "user",
        content: [{ type: "text", text: "noop" }],
        attachments: [],
        createdAt: new Date("2026-05-17T00:00:00Z"),
        metadata: { custom: {} },
        parentId: null,
        sourceId: null,
        runConfig: undefined,
      }),
    ).resolves.toBeUndefined();
  });
});
