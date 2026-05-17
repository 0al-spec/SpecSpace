import { describe, expect, it } from "vitest";
import {
  createAgentRuntimeProjection,
  projectAgentRuntimeEvent,
  projectAgentRuntimeEvents,
  type AgentRuntimeEvent,
} from "../index";

describe("agent runtime event projection", () => {
  it("projects streaming text, tool calls, outputs, and completion into stable turns", () => {
    const events: AgentRuntimeEvent[] = [
      { kind: "turn_started", turn_id: "turn-1", role: "agent" },
      { kind: "text_delta", turn_id: "turn-1", text: "Review " },
      { kind: "text_delta", turn_id: "turn-1", text: "complete." },
      {
        kind: "tool_call",
        turn_id: "turn-1",
        tool_call_id: "tool-1",
        tool_name: "attach_context",
        title: "Attach graph context",
      },
      {
        kind: "output_created",
        turn_id: "turn-1",
        output_id: "out-1",
        output_kind: "analysis",
      },
      { kind: "turn_completed", turn_id: "turn-1" },
    ];

    expect(projectAgentRuntimeEvents(events)).toEqual({
      turns: [
        {
          turn_id: "turn-1",
          role: "agent",
          text: "Review complete.",
          tool_calls: [
            {
              tool_call_id: "tool-1",
              tool_name: "attach_context",
              title: "Attach graph context",
            },
          ],
          outputs: [
            {
              output_id: "out-1",
              output_kind: "analysis",
            },
          ],
          completed: true,
        },
      ],
    });
  });

  it("ignores deltas for unknown turns instead of creating malformed rows", () => {
    const projected = projectAgentRuntimeEvent(createAgentRuntimeProjection(), {
      kind: "text_delta",
      turn_id: "missing-turn",
      text: "orphan",
    });

    expect(projected.turns).toEqual([]);
  });
});
