import type { AgentRuntimeEvent } from "./runtime";

export type AgentRuntimeToolCallProjection = {
  tool_call_id: string;
  tool_name: string;
  title: string;
};

export type AgentRuntimeOutputProjection = {
  output_id: string;
  output_kind: "analysis" | "proposal_draft" | "implementation_handoff" | "metric_note";
};

export type AgentRuntimeTurnProjection = {
  turn_id: string;
  role: "operator" | "agent" | "system" | "tool";
  text: string;
  tool_calls: AgentRuntimeToolCallProjection[];
  outputs: AgentRuntimeOutputProjection[];
  completed: boolean;
};

export type AgentRuntimeProjection = {
  turns: AgentRuntimeTurnProjection[];
};

export function createAgentRuntimeProjection(): AgentRuntimeProjection {
  return {
    turns: [],
  };
}

export function projectAgentRuntimeEvent(
  projection: AgentRuntimeProjection,
  event: AgentRuntimeEvent,
): AgentRuntimeProjection {
  if (event.kind === "turn_started") {
    if (projection.turns.some((turn) => turn.turn_id === event.turn_id)) {
      return projection;
    }
    return {
      turns: [
        ...projection.turns,
        {
          turn_id: event.turn_id,
          role: event.role,
          text: "",
          tool_calls: [],
          outputs: [],
          completed: false,
        },
      ],
    };
  }

  return updateTurn(projection, event.turn_id, (turn) => {
    switch (event.kind) {
      case "text_delta":
        return {
          ...turn,
          text: `${turn.text}${event.text}`,
        };
      case "tool_call":
        return {
          ...turn,
          tool_calls: [
            ...turn.tool_calls,
            {
              tool_call_id: event.tool_call_id,
              tool_name: event.tool_name,
              title: event.title,
            },
          ],
        };
      case "output_created":
        return {
          ...turn,
          outputs: [
            ...turn.outputs,
            {
              output_id: event.output_id,
              output_kind: event.output_kind,
            },
          ],
        };
      case "turn_completed":
        return {
          ...turn,
          completed: true,
        };
    }
  });
}

export function projectAgentRuntimeEvents(
  events: AgentRuntimeEvent[],
): AgentRuntimeProjection {
  return events.reduce(
    (projection, event) => projectAgentRuntimeEvent(projection, event),
    createAgentRuntimeProjection(),
  );
}

function updateTurn(
  projection: AgentRuntimeProjection,
  turnId: string,
  update: (turn: AgentRuntimeTurnProjection) => AgentRuntimeTurnProjection,
): AgentRuntimeProjection {
  let matched = false;
  const turns = projection.turns.map((turn) => {
    if (turn.turn_id !== turnId) {
      return turn;
    }
    matched = true;
    return update(turn);
  });

  if (!matched) {
    return projection;
  }
  return { turns };
}
