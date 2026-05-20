import type { AgentContextDraft } from "./context";

export type AgentConversationId = string;
export type AgentTurnId = string;

export type AgentConversationRef = {
  conversation_id: AgentConversationId;
  title: string;
  status: "active" | "archived" | "superseded";
};

export type StartAgentConversationInput = {
  title: string;
  context_set: AgentContextDraft;
  initial_prompt?: string;
};

export type SendAgentMessageInput = {
  conversation_id: AgentConversationId;
  text: string;
  context_set?: AgentContextDraft;
};

export type AgentRuntimeEvent =
  | {
      kind: "turn_started";
      turn_id: AgentTurnId;
      role: "operator" | "agent" | "system" | "tool";
    }
  | {
      kind: "text_delta";
      turn_id: AgentTurnId;
      text: string;
    }
  | {
      kind: "tool_call";
      turn_id: AgentTurnId;
      tool_call_id: string;
      tool_name: string;
      title: string;
    }
  | {
      kind: "output_created";
      turn_id: AgentTurnId;
      output_id: string;
      output_kind: "analysis" | "proposal_draft" | "implementation_handoff" | "metric_note";
    }
  | {
      kind: "turn_completed";
      turn_id: AgentTurnId;
    };

export type AgentConversationRuntime = {
  startConversation(input: StartAgentConversationInput): Promise<AgentConversationRef>;
  sendMessage(input: SendAgentMessageInput): AsyncIterable<AgentRuntimeEvent>;
  resumeConversation(conversationId: AgentConversationId): AsyncIterable<AgentRuntimeEvent>;
};

export type AgentConversationHistoryEntry = {
  ref: AgentConversationRef;
  context_set: AgentContextDraft;
  created_at: string;
  updated_at: string;
  turn_count: number;
  event_count: number;
};

export type AgentConversationHistoryRuntime = AgentConversationRuntime & {
  getConversation(conversationId: AgentConversationId): AgentConversationHistoryEntry | null;
  listConversations(): AgentConversationHistoryEntry[];
};

export function isAgentConversationHistoryRuntime(
  runtime: AgentConversationRuntime,
): runtime is AgentConversationHistoryRuntime {
  const candidate = runtime as Partial<AgentConversationHistoryRuntime>;
  return (
    typeof candidate.getConversation === "function" &&
    typeof candidate.listConversations === "function"
  );
}
