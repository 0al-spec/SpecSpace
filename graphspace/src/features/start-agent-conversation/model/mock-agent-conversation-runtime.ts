import {
  agentContextItemLabel,
  serializeAgentContextSet,
  type AgentContextDraft,
  type AgentContextItem,
  type AgentConversationId,
  type AgentConversationRef,
  type AgentConversationRuntime,
  type AgentRuntimeEvent,
  type SendAgentMessageInput,
  type StartAgentConversationInput,
} from "@/entities/agent-workbench";

export type MockAgentConversationRecord = {
  ref: AgentConversationRef;
  context_set: AgentContextDraft;
  created_at: string;
  updated_at: string;
  turn_count: number;
};

export type MockAgentConversationRuntime = AgentConversationRuntime & {
  getConversation(conversationId: AgentConversationId): MockAgentConversationRecord | null;
  listConversations(): MockAgentConversationRecord[];
};

export type MockAgentConversationRuntimeOptions = {
  id_prefix?: string;
  now?: () => string;
};

const defaultNow = (): string => new Date().toISOString();

export function createMockAgentConversationRuntime(
  options: MockAgentConversationRuntimeOptions = {},
): MockAgentConversationRuntime {
  const idPrefix = options.id_prefix ?? "mock-awb";
  const now = options.now ?? defaultNow;
  const conversations = new Map<AgentConversationId, MockAgentConversationRecord>();
  let conversationSequence = 0;
  let turnSequence = 0;
  let outputSequence = 0;

  function cloneRecord(record: MockAgentConversationRecord): MockAgentConversationRecord {
    return {
      ...record,
      ref: { ...record.ref },
      context_set: serializeAgentContextSet(record.context_set),
    };
  }

  function nextId(kind: "conversation" | "turn" | "output"): string {
    if (kind === "conversation") {
      conversationSequence += 1;
      return `${idPrefix}-conv-${formatSequence(conversationSequence)}`;
    }
    if (kind === "turn") {
      turnSequence += 1;
      return `${idPrefix}-turn-${formatSequence(turnSequence)}`;
    }
    outputSequence += 1;
    return `${idPrefix}-out-${formatSequence(outputSequence)}`;
  }

  return {
    async startConversation(
      input: StartAgentConversationInput,
    ): Promise<AgentConversationRef> {
      const createdAt = now();
      const conversationId = nextId("conversation");
      const ref: AgentConversationRef = {
        conversation_id: conversationId,
        title: normalizeConversationTitle(input.title, input.initial_prompt),
        status: "active",
      };

      conversations.set(conversationId, {
        ref,
        context_set: serializeAgentContextSet(input.context_set),
        created_at: createdAt,
        updated_at: createdAt,
        turn_count: 0,
      });

      return { ...ref };
    },

    async *sendMessage(input: SendAgentMessageInput): AsyncIterable<AgentRuntimeEvent> {
      const record = conversations.get(input.conversation_id);
      if (!record) {
        throw new Error(`Unknown mock Agent Workbench conversation: ${input.conversation_id}`);
      }

      const contextSet = input.context_set
        ? serializeAgentContextSet(input.context_set)
        : record.context_set;
      const operatorTurnId = nextId("turn");
      const agentTurnId = nextId("turn");
      const outputId = nextId("output");
      const toolCallId = `${agentTurnId}-tool-context`;
      const contextCount = contextSet.items.length;
      const contextSummary = summarizeContextItems(contextSet.items);

      record.context_set = contextSet;
      record.updated_at = now();
      record.turn_count += 2;

      yield { kind: "turn_started", turn_id: operatorTurnId, role: "operator" };
      yield { kind: "text_delta", turn_id: operatorTurnId, text: input.text };
      yield { kind: "turn_completed", turn_id: operatorTurnId };

      yield { kind: "turn_started", turn_id: agentTurnId, role: "agent" };
      if (contextCount > 0) {
        yield {
          kind: "tool_call",
          turn_id: agentTurnId,
          tool_call_id: toolCallId,
          tool_name: "attach_context",
          title: `Attach ${contextCount} context item${contextCount === 1 ? "" : "s"}`,
        };
      }
      yield {
        kind: "text_delta",
        turn_id: agentTurnId,
        text: `Mock agent received "${input.text}"`,
      };
      yield {
        kind: "text_delta",
        turn_id: agentTurnId,
        text: ` with ${contextCount} context item${contextCount === 1 ? "" : "s"}.`,
      };
      if (contextSummary.length > 0) {
        yield {
          kind: "text_delta",
          turn_id: agentTurnId,
          text: `\n\nAttached context:\n${contextSummary
            .map((summary) => `- ${summary}`)
            .join("\n")}`,
        };
      }
      yield {
        kind: "output_created",
        turn_id: agentTurnId,
        output_id: outputId,
        output_kind: "analysis",
      };
      yield { kind: "turn_completed", turn_id: agentTurnId };
    },

    async *resumeConversation(
      conversationId: AgentConversationId,
    ): AsyncIterable<AgentRuntimeEvent> {
      const record = conversations.get(conversationId);
      if (!record) {
        throw new Error(`Unknown mock Agent Workbench conversation: ${conversationId}`);
      }

      const turnId = nextId("turn");
      yield { kind: "turn_started", turn_id: turnId, role: "system" };
      yield {
        kind: "text_delta",
        turn_id: turnId,
        text: `Mock conversation resumed with ${record.context_set.items.length} context item${
          record.context_set.items.length === 1 ? "" : "s"
        }.`,
      };
      yield { kind: "turn_completed", turn_id: turnId };
    },

    getConversation(conversationId: AgentConversationId): MockAgentConversationRecord | null {
      const record = conversations.get(conversationId);
      return record ? cloneRecord(record) : null;
    },

    listConversations(): MockAgentConversationRecord[] {
      return Array.from(conversations.values(), cloneRecord);
    },
  };
}

function normalizeConversationTitle(title: string, initialPrompt?: string): string {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length > 0) {
    return normalizedTitle;
  }
  const normalizedPrompt = initialPrompt?.trim();
  if (normalizedPrompt && normalizedPrompt.length > 0) {
    return normalizedPrompt.slice(0, 80);
  }
  return "Untitled Agent Workbench conversation";
}

function summarizeContextItems(items: AgentContextItem[]): string[] {
  return items.map(summarizeContextItem);
}

function summarizeContextItem(item: AgentContextItem): string {
  const label = agentContextItemLabel(item);
  if (item.kind === "spec_node") {
    return `${label}: spec node (${item.status}, ${item.file_name})`;
  }
  if (item.kind === "spec_edge") {
    return `${label}: ${item.source_id} -> ${item.target_id} (${item.edge_kind}, ${item.status})`;
  }
  if (item.kind === "spec_gap") {
    return `${label}: ${item.gap_count} ${item.gap_count === 1 ? "gap" : "gaps"} on ${item.title}`;
  }
  if (item.kind === "proposal") {
    const path = item.proposal_path ? `, ${item.proposal_path}` : "";
    return `${label}: proposal ${item.title} (${item.status}${path})`;
  }
  if (item.kind === "metric") {
    return `${label}: metric ${item.title} (${item.category}, ${item.status})`;
  }
  return `${label}: ${formatMarkdownScope(item.scope)}, ${item.node_count} ${
    item.node_count === 1 ? "node" : "nodes"
  }, ${item.download_filename}`;
}

function formatMarkdownScope(scope: "node" | "subtree"): string {
  if (scope === "subtree") return "refinement subtree";
  return "selected spec";
}

function formatSequence(value: number): string {
  return value.toString().padStart(4, "0");
}
