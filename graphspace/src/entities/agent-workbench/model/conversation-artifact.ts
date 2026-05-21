import {
  serializeAgentContextSet,
  type AgentContextDraft,
  type AgentContextItem,
  type AgentContextMetricItem,
  type AgentContextProposalItem,
  type AgentContextSpecEdgeItem,
  type AgentContextSpecGapItem,
  type AgentContextSpecMarkdownItem,
  type AgentContextSpecNodeItem,
} from "./context";
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

export type AgentConversationParticipant = {
  participant_id: string;
  role: AgentConversationParticipantRole;
  display_name?: string | null;
};

export type AgentConversationParentRef = {
  kind: string;
  artifact_ref: string;
  title?: string | null;
};

export type AgentConversationContextItem =
  | AgentConversationSpecNodeContextItem
  | AgentConversationSpecEdgeContextItem
  | AgentConversationGapContextItem
  | AgentConversationProposalContextItem
  | AgentConversationMetricContextItem
  | AgentConversationSpecPmPackageContextItem
  | AgentConversationExternalLinkContextItem;

export type AgentConversationSpecNodeContextItem = {
  kind: "spec_node";
  node_id: string;
  title: string;
  status?: string;
  file_name?: string;
};

export type AgentConversationSpecEdgeContextItem = {
  kind: "spec_edge";
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_kind: string;
  status?: string;
  source_title?: string | null;
  target_title?: string | null;
};

export type AgentConversationGapContextItem = {
  kind: "gap";
  node_id: string;
  title: string;
  gap_id: string;
  gap_kind: AgentContextSpecGapItem["gap_kind"];
  gap_count: number;
  path: string;
};

export type AgentConversationProposalContextItem = {
  kind: "proposal";
  proposal_key: string;
  proposal_id: string;
  title: string;
  status: string;
  proposal_path: string | null;
  affected_spec_ids: string[];
};

export type AgentConversationMetricContextItem = {
  kind: "metric";
  metric_key: string;
  item_id: string;
  title: string;
  category: string;
  status: string;
  source_kind: string;
  reference_texts: string[];
};

export type AgentConversationSpecPmPackageContextItem = {
  kind: "specpm_package";
  package_id: string;
  version: string;
};

export type AgentConversationExternalLinkContextItem = {
  kind: "external_link";
  title: string;
  artifact_path: string;
  source_kind: AgentContextSpecMarkdownItem["source_kind"];
  node_id: string;
  scope: AgentContextSpecMarkdownItem["scope"];
  node_count: number;
};

export type AgentConversationContextSetArtifact = {
  context_set_id: string;
  created_at: string;
  label: string;
  items: AgentConversationContextItem[];
};

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
  participants: AgentConversationParticipant[];
  context_sets: AgentConversationContextSetArtifact[];
  turns: AgentConversationTurnArtifact[];
  outputs: AgentConversationOutputArtifact[];
  parent_refs: AgentConversationParentRef[];
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
  const eventMetadata = collectEventMetadata(source);

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
    context_sets: eventMetadata.contextSets,
    turns: projection.turns.map((turn) =>
      createTurnArtifact(
        turn,
        eventMetadata.turnCreatedAt.get(turn.turn_id) ?? source.created_at,
        eventMetadata.contextSetIdsByTurn.get(turn.turn_id) ??
          eventMetadata.fallbackContextSetIds,
      ),
    ),
    outputs: projection.turns.flatMap((turn) =>
      turn.outputs.map((output) =>
        createOutputArtifact(
          output,
          turn.turn_id,
          eventMetadata.outputCreatedAt.get(output.output_id) ??
            eventMetadata.turnCreatedAt.get(turn.turn_id) ??
            source.updated_at,
          eventMetadata.contextSetIdsByTurn.get(turn.turn_id) ??
            eventMetadata.fallbackContextSetIds,
        ),
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

type ArtifactEventMetadata = {
  contextSets: AgentConversationContextSetArtifact[];
  fallbackContextSetIds: string[];
  contextSetIdsByTurn: Map<string, string[]>;
  turnCreatedAt: Map<string, string>;
  outputCreatedAt: Map<string, string>;
};

function collectEventMetadata(source: AgentConversationArtifactSource): ArtifactEventMetadata {
  const contextSets: AgentConversationContextSetArtifact[] = [];
  const contextKeyToId = new Map<string, string>();
  const contextIdUseCount = new Map<string, number>();
  const contextSetIdsByTurn = new Map<string, string[]>();
  const turnCreatedAt = new Map<string, string>();
  const outputCreatedAt = new Map<string, string>();
  const fallbackContextSetIds = [registerContextSet(source.context_set)];

  for (const event of source.events) {
    const eventCreatedAt = event.created_at ?? source.created_at;
    if (event.kind === "turn_started") {
      const contextSetIds = [
        registerContextSet(event.context_set ?? source.context_set),
      ];
      contextSetIdsByTurn.set(event.turn_id, contextSetIds);
      turnCreatedAt.set(event.turn_id, eventCreatedAt);
    }
    if (event.kind === "output_created") {
      outputCreatedAt.set(
        event.output_id,
        event.created_at ?? turnCreatedAt.get(event.turn_id) ?? source.updated_at,
      );
    }
  }

  return {
    contextSets,
    fallbackContextSetIds,
    contextSetIdsByTurn,
    turnCreatedAt,
    outputCreatedAt,
  };

  function registerContextSet(contextSet: AgentContextDraft): string {
    const artifactContextSet = createArtifactContextSet(contextSet, contextSet.context_set_id);
    const signature = JSON.stringify({
      label: artifactContextSet.label,
      items: artifactContextSet.items,
    });
    const existingId = contextKeyToId.get(signature);
    if (existingId) return existingId;

    const baseId = artifactContextSet.context_set_id || "ctx";
    const seenCount = contextIdUseCount.get(baseId) ?? 0;
    contextIdUseCount.set(baseId, seenCount + 1);
    const contextSetId = seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`;
    const registered = {
      ...artifactContextSet,
      context_set_id: contextSetId,
    };

    contextKeyToId.set(signature, contextSetId);
    contextSets.push(registered);
    return contextSetId;
  }
}

function createArtifactContextSet(
  contextSet: AgentContextDraft,
  contextSetId: string,
): AgentConversationContextSetArtifact {
  const serialized = serializeAgentContextSet(contextSet);
  return {
    context_set_id: contextSetId,
    created_at: serialized.created_at,
    label: serialized.label,
    items: serialized.items.map(mapContextItem),
  };
}

function mapContextItem(item: AgentContextItem): AgentConversationContextItem {
  if (item.kind === "spec_node") return mapSpecNodeContextItem(item);
  if (item.kind === "spec_edge") return mapSpecEdgeContextItem(item);
  if (item.kind === "spec_gap") return mapSpecGapContextItem(item);
  if (item.kind === "proposal") return mapProposalContextItem(item);
  if (item.kind === "metric") return mapMetricContextItem(item);
  return mapSpecMarkdownContextItem(item);
}

function mapSpecNodeContextItem(
  item: AgentContextSpecNodeItem,
): AgentConversationSpecNodeContextItem {
  return {
    kind: "spec_node",
    node_id: item.node_id,
    title: item.title,
    status: item.status,
    file_name: item.file_name,
  };
}

function mapSpecEdgeContextItem(
  item: AgentContextSpecEdgeItem,
): AgentConversationSpecEdgeContextItem {
  return {
    kind: "spec_edge",
    edge_id: item.edge_id,
    source_node_id: item.source_id,
    target_node_id: item.target_id,
    edge_kind: item.edge_kind,
    status: item.status,
    source_title: item.source_title,
    target_title: item.target_title,
  };
}

function mapSpecGapContextItem(
  item: AgentContextSpecGapItem,
): AgentConversationGapContextItem {
  return {
    kind: "gap",
    node_id: item.node_id,
    title: item.title,
    gap_id: `${item.node_id}:${item.gap_kind}`,
    gap_kind: item.gap_kind,
    gap_count: item.gap_count,
    path: `specification.gaps.${item.gap_kind}`,
  };
}

function mapProposalContextItem(
  item: AgentContextProposalItem,
): AgentConversationProposalContextItem {
  return {
    kind: "proposal",
    proposal_key: item.proposal_key,
    proposal_id: item.proposal_id,
    title: item.title,
    status: item.status,
    proposal_path: item.proposal_path,
    affected_spec_ids: [...item.affected_spec_ids],
  };
}

function mapMetricContextItem(
  item: AgentContextMetricItem,
): AgentConversationMetricContextItem {
  return {
    kind: "metric",
    metric_key: item.metric_key,
    item_id: item.item_id,
    title: item.title,
    category: item.category,
    status: item.status,
    source_kind: item.source_kind,
    reference_texts: [...item.reference_texts],
  };
}

function mapSpecMarkdownContextItem(
  item: AgentContextSpecMarkdownItem,
): AgentConversationExternalLinkContextItem {
  return {
    kind: "external_link",
    title: item.title,
    artifact_path: item.download_filename,
    source_kind: item.source_kind,
    node_id: item.node_id,
    scope: item.scope,
    node_count: item.node_count,
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
