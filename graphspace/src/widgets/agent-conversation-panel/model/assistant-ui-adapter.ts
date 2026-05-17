import type { ExternalStoreAdapter, ThreadMessageLike } from "@assistant-ui/react";
import type {
  AgentRuntimeProjection,
  AgentRuntimeTurnProjection,
} from "@/entities/agent-workbench";

export type AssistantUiAgentMessage = ThreadMessageLike & {
  readonly metadata: NonNullable<ThreadMessageLike["metadata"]> & {
    readonly custom: {
      readonly specspace_turn_id: string;
      readonly specspace_role: AgentRuntimeTurnProjection["role"];
    };
  };
};

export type AssistantUiExternalStoreAdapterOptions = {
  projection: AgentRuntimeProjection;
  is_running?: boolean;
  on_new?: ExternalStoreAdapter<ThreadMessageLike>["onNew"];
};

export function createAssistantUiExternalStoreAdapter({
  projection,
  is_running = false,
  on_new = noopOnNew,
}: AssistantUiExternalStoreAdapterOptions): ExternalStoreAdapter<ThreadMessageLike> {
  return {
    messages: mapAgentProjectionToAssistantUiMessages(projection),
    isRunning: is_running,
    onNew: on_new,
    convertMessage: (message) => message,
  };
}

export function mapAgentProjectionToAssistantUiMessages(
  projection: AgentRuntimeProjection,
): AssistantUiAgentMessage[] {
  return projection.turns.map(mapAgentTurnToAssistantUiMessage);
}

export function mapAgentTurnToAssistantUiMessage(
  turn: AgentRuntimeTurnProjection,
): AssistantUiAgentMessage {
  return {
    id: turn.turn_id,
    role: mapAgentRoleToAssistantUiRole(turn.role),
    content: buildAssistantUiContent(turn),
    status: turn.completed ? { type: "complete", reason: "stop" } : { type: "running" },
    metadata: {
      custom: {
        specspace_turn_id: turn.turn_id,
        specspace_role: turn.role,
      },
    },
  };
}

function buildAssistantUiContent(turn: AgentRuntimeTurnProjection): ThreadMessageLike["content"] {
  type AssistantUiContent = Exclude<ThreadMessageLike["content"], string>;
  const content: AssistantUiContent[number][] = [
    {
      type: "text",
      text: turn.text,
    },
  ];

  for (const toolCall of turn.tool_calls) {
    content.push({
      type: "tool-call",
      toolCallId: toolCall.tool_call_id,
      toolName: toolCall.tool_name,
      args: {
        title: toolCall.title,
      },
      argsText: toolCall.title,
      result: {
        title: toolCall.title,
      },
    });
  }

  for (const output of turn.outputs) {
    content.push({
      type: "data",
      name: "specspace.output",
      data: {
        output_id: output.output_id,
        output_kind: output.output_kind,
      },
    });
  }

  return content;
}

function mapAgentRoleToAssistantUiRole(
  role: AgentRuntimeTurnProjection["role"],
): ThreadMessageLike["role"] {
  if (role === "operator") return "user";
  if (role === "system") return "system";
  return "assistant";
}

async function noopOnNew(): Promise<void> {
  // The first adapter spike is read-only. Sending still flows through SpecSpace runtime.
}
