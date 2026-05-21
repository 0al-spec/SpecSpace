import { serializeAgentContextSet, type AgentContextDraft } from "./context";
import {
  projectAgentRuntimeEvents,
  type AgentRuntimeOutputProjection,
  type AgentRuntimeTurnProjection,
} from "./event-projection";
import type {
  AgentConversationHistoryEntry,
  AgentConversationId,
  AgentConversationRef,
  AgentConversationRuntime,
  AgentRuntimeEvent,
} from "./runtime";

export type AgentConversationArtifactKind = "specspace_agent_conversation";
export type AgentConversationIndexArtifactKind = "specspace_agent_conversation_index";
export type AgentConversationArtifactApiVersion = "v1";
export type AgentConversationArtifactSchemaVersion = 1;

export type AgentConversationParticipantRole = "operator" | "agent" | "system" | "tool";

export type AgentConversationContentBlock =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "markdown";
      text: string;
    }
  | {
      kind: "artifact_ref";
      artifact_ref: string;
      title: string;
    };

export type AgentConversationTurnArtifact = {
  turn_id: string;
  role: AgentConversationParticipantRole;
  created_at: string;
  completed: boolean;
  content: AgentConversationContentBlock[];
  context_set_ids: string[];
};

export type AgentConversationOutputStatus =
  | "draft"
  | "proposed"
  | "materialized"
  | "rejected";

export type AgentConversationOutputArtifact = {
  output_id: string;
  kind: AgentRuntimeOutputProjection["output_kind"];
  created_at: string;
  origin_turn_id: string;
  context_set_ids: string[];
  proposal?: {
    proposal_key: string;
    title: string;
    status: AgentConversationOutputStatus;
    target_spec_ids: string[];
  };
};

export type AgentConversationArtifact = {
  api_version: AgentConversationArtifactApiVersion;
  artifact_kind: AgentConversationArtifactKind;
  schema_version: AgentConversationArtifactSchemaVersion;
  conversation_id: AgentConversationId;
  title: string;
  status: AgentConversationRef["status"];
  created_at: string;
  updated_at: string;
  storage: {
    owner: "specspace";
    mutation_authority: "specspace_workbench_only";
  };
  participants: [];
  context_sets: AgentContextDraft[];
  turns: AgentConversationTurnArtifact[];
  outputs: AgentConversationOutputArtifact[];
  parent_refs: [];
};

export type AgentConversationIndexEntry = {
  conversation_id: AgentConversationId;
  title: string;
  status: AgentConversationRef["status"];
  updated_at: string;
  turn_count: number;
  context_item_count: number;
  output_count: number;
  proposal_output_count: number;
};

export type AgentConversationIndexArtifact = {
  api_version: AgentConversationArtifactApiVersion;
  artifact_kind: AgentConversationIndexArtifactKind;
  schema_version: AgentConversationArtifactSchemaVersion;
  generated_at: string;
  entry_count: number;
  entries: AgentConversationIndexEntry[];
};

export type AgentConversationArtifactSource = AgentConversationHistoryEntry & {
  events: readonly AgentRuntimeEvent[];
};

export type AgentConversationArtifactRuntime = {
  getConversationArtifact(conversationId: AgentConversationId): AgentConversationArtifact | null;
  listConversationArtifacts(): AgentConversationArtifact[];
  getConversationIndexArtifact(generatedAt: string): AgentConversationIndexArtifact;
};

export function isAgentConversationArtifactRuntime(
  runtime: AgentConversationRuntime,
): runtime is AgentConversationRuntime & AgentConversationArtifactRuntime {
  const candidate = runtime as Partial<AgentConversationArtifactRuntime>;
  return (
    typeof candidate.getConversationArtifact === "function" &&
    typeof candidate.listConversationArtifacts === "function" &&
    typeof candidate.getConversationIndexArtifact === "function"
  );
}

export function createAgentConversationArtifactSnapshot(
  source: AgentConversationArtifactSource,
): AgentConversationArtifact {
  const projection = projectAgentRuntimeEvents([...source.events]);
  const contextSetIds = [source.context_set.context_set_id];
  const contextSet = redactArtifactContextSet(source.context_set);

  return {
    api_version: "v1",
    artifact_kind: "specspace_agent_conversation",
    schema_version: 1,
    conversation_id: source.ref.conversation_id,
    title: source.ref.title,
    status: source.ref.status,
    created_at: source.created_at,
    updated_at: source.updated_at,
    storage: {
      owner: "specspace",
      mutation_authority: "specspace_workbench_only",
    },
    participants: [],
    context_sets: [contextSet],
    turns: projection.turns.map((turn) =>
      createTurnArtifact(turn, source.created_at, contextSetIds),
    ),
    outputs: projection.turns.flatMap((turn) =>
      turn.outputs.map((output) =>
        createOutputArtifact(output, turn.turn_id, source.updated_at, contextSetIds),
      ),
    ),
    parent_refs: [],
  };
}

export function createAgentConversationIndexEntry(
  artifact: AgentConversationArtifact,
): AgentConversationIndexEntry {
  return {
    conversation_id: artifact.conversation_id,
    title: artifact.title,
    status: artifact.status,
    updated_at: artifact.updated_at,
    turn_count: artifact.turns.length,
    context_item_count: artifact.context_sets.reduce(
      (count, contextSet) => count + contextSet.items.length,
      0,
    ),
    output_count: artifact.outputs.length,
    proposal_output_count: artifact.outputs.filter(
      (output) => output.kind === "proposal_draft",
    ).length,
  };
}

export function createAgentConversationIndexArtifact(
  artifacts: readonly AgentConversationArtifact[],
  generatedAt: string,
): AgentConversationIndexArtifact {
  const entries = artifacts
    .map(createAgentConversationIndexEntry)
    .sort(compareIndexEntries);

  return {
    api_version: "v1",
    artifact_kind: "specspace_agent_conversation_index",
    schema_version: 1,
    generated_at: generatedAt,
    entry_count: entries.length,
    entries,
  };
}

function createTurnArtifact(
  turn: AgentRuntimeTurnProjection,
  createdAt: string,
  contextSetIds: string[],
): AgentConversationTurnArtifact {
  return {
    turn_id: turn.turn_id,
    role: turn.role,
    created_at: createdAt,
    completed: turn.completed,
    content: turn.text.length > 0 ? [{ kind: "text", text: turn.text }] : [],
    context_set_ids: [...contextSetIds],
  };
}

function createOutputArtifact(
  output: AgentRuntimeOutputProjection,
  originTurnId: string,
  createdAt: string,
  contextSetIds: string[],
): AgentConversationOutputArtifact {
  return {
    output_id: output.output_id,
    kind: output.output_kind,
    created_at: createdAt,
    origin_turn_id: originTurnId,
    context_set_ids: [...contextSetIds],
  };
}

function redactArtifactContextSet(contextSet: AgentContextDraft): AgentContextDraft {
  const serialized = serializeAgentContextSet(contextSet);
  return {
    ...serialized,
    items: serialized.items.map((item) =>
      item.kind === "spec_markdown"
        ? {
            ...item,
            markdown: "",
            compile: item.compile ? { ...item.compile, compiled_md: null } : null,
          }
        : item,
    ),
  };
}

function compareIndexEntries(
  left: AgentConversationIndexEntry,
  right: AgentConversationIndexEntry,
): number {
  const updated = right.updated_at.localeCompare(left.updated_at);
  if (updated !== 0) return updated;
  return right.conversation_id.localeCompare(left.conversation_id);
}
