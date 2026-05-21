import type {
  AgentConversationArtifact,
  AgentConversationContentBlock,
  AgentConversationContextItem,
  AgentConversationContextSetArtifact,
  AgentConversationIndexArtifact,
  AgentConversationIndexEntry,
  AgentConversationOutputArtifact,
  AgentConversationOutputStatus,
  AgentConversationParticipant,
  AgentConversationParticipantRole,
  AgentConversationTurnArtifact,
} from "./conversation-artifact";
import type {
  AgentRuntimeOutputProjection,
  AgentRuntimeProjection,
} from "./event-projection";
import type { AgentContextSpecGapKind } from "./context";

export type AgentConversationParseResult<T> =
  | { kind: "ok"; data: T }
  | {
      kind: "wrong-artifact-kind";
      expected: string;
      got: unknown;
    }
  | {
      kind: "version-not-supported";
      artifact_kind: string;
      schema_version: number;
      max_supported: number;
    }
  | {
      kind: "parse-error";
      reason: string;
      raw: unknown;
    };

type ArtifactHeader = {
  api_version: "v1";
  schema_version: 1;
};

const MAX_SCHEMA_VERSION = 1;

export function parseAgentConversationIndexArtifact(
  raw: unknown,
): AgentConversationParseResult<AgentConversationIndexArtifact> {
  const header = parseArtifactHeader(raw, "specspace_agent_conversation_index");
  if (header.kind !== "ok") return header;
  const obj = raw as Record<string, unknown>;
  const generatedAt = stringField(obj, "generated_at");
  const entriesRaw = arrayField(obj, "entries");
  const entryCount = numberField(obj, "entry_count");
  if (!generatedAt || entriesRaw === null || entryCount === null) {
    return parseError("conversation index is missing required fields", raw);
  }

  const entries: AgentConversationIndexEntry[] = [];
  for (const entryRaw of entriesRaw) {
    const entry = parseIndexEntry(entryRaw);
    if (!entry) return parseError("conversation index entry is malformed", raw);
    entries.push(entry);
  }
  if (entryCount !== entries.length) {
    return parseError("conversation index entry_count does not match entries length", raw);
  }

  return {
    kind: "ok",
    data: {
      ...header.data,
      artifact_kind: "specspace_agent_conversation_index",
      generated_at: generatedAt,
      entry_count: entryCount,
      entries,
    },
  };
}

export function parseAgentConversationArtifact(
  raw: unknown,
): AgentConversationParseResult<AgentConversationArtifact> {
  const header = parseArtifactHeader(raw, "specspace_agent_conversation");
  if (header.kind !== "ok") return header;
  const obj = raw as Record<string, unknown>;
  const conversationId = stringField(obj, "conversation_id");
  const title = stringField(obj, "title");
  const status = conversationStatus(obj.status);
  const createdAt = stringField(obj, "created_at");
  const updatedAt = stringField(obj, "updated_at");
  const storage = recordField(obj, "storage");
  const participantsRaw = arrayField(obj, "participants") ?? [];
  const contextSetsRaw = arrayField(obj, "context_sets") ?? [];
  const turnsRaw = arrayField(obj, "turns") ?? [];
  const outputsRaw = arrayField(obj, "outputs") ?? [];
  const parentRefsRaw = arrayField(obj, "parent_refs") ?? [];

  if (!conversationId || !title || !status || !createdAt || !updatedAt || !storage) {
    return parseError("conversation artifact is missing required fields", raw);
  }
  if (storage.owner !== "specspace" || storage.mutation_authority !== "specspace_workbench_only") {
    return parseError("conversation artifact storage authority is unsupported", raw);
  }

  const participants = participantsRaw.map(parseParticipant);
  const contextSets = contextSetsRaw.map(parseContextSet);
  const turns = turnsRaw.map(parseTurn);
  const outputs = outputsRaw.map(parseOutput);
  const parentRefs = parentRefsRaw.map(parseParentRef);

  if (
    participants.some((item) => item === null) ||
    contextSets.some((item) => item === null) ||
    turns.some((item) => item === null) ||
    outputs.some((item) => item === null) ||
    parentRefs.some((item) => item === null)
  ) {
    return parseError("conversation artifact contains malformed nested records", raw);
  }

  return {
    kind: "ok",
    data: {
      ...header.data,
      artifact_kind: "specspace_agent_conversation",
      conversation_id: conversationId,
      title,
      status,
      created_at: createdAt,
      updated_at: updatedAt,
      storage: {
        owner: "specspace",
        mutation_authority: "specspace_workbench_only",
      },
      participants: participants as AgentConversationParticipant[],
      context_sets: contextSets as AgentConversationContextSetArtifact[],
      turns: turns as AgentConversationTurnArtifact[],
      outputs: outputs as AgentConversationOutputArtifact[],
      parent_refs: parentRefs as AgentConversationArtifact["parent_refs"],
    },
  };
}

export function projectAgentConversationArtifactToProjection(
  artifact: AgentConversationArtifact,
): AgentRuntimeProjection {
  const outputsByTurn = new Map<string, AgentRuntimeOutputProjection[]>();
  for (const output of artifact.outputs) {
    const outputs = outputsByTurn.get(output.origin_turn_id) ?? [];
    outputs.push({
      output_id: output.output_id,
      output_kind: output.kind,
    });
    outputsByTurn.set(output.origin_turn_id, outputs);
  }

  return {
    turns: artifact.turns.map((turn) => ({
      turn_id: turn.turn_id,
      role: turn.role,
      text: turn.content.map(formatContentBlock).join("\n\n"),
      tool_calls: [],
      outputs: outputsByTurn.get(turn.turn_id) ?? [],
      completed: turn.completed,
    })),
  };
}

function parseArtifactHeader(
  raw: unknown,
  expectedKind: "specspace_agent_conversation" | "specspace_agent_conversation_index",
): AgentConversationParseResult<ArtifactHeader> {
  if (!isRecord(raw)) return parseError("artifact is not an object", raw);
  if (raw.artifact_kind !== expectedKind) {
    return {
      kind: "wrong-artifact-kind",
      expected: expectedKind,
      got: raw.artifact_kind,
    };
  }
  if (raw.api_version !== "v1") {
    return parseError("artifact api_version is unsupported", raw);
  }
  if (typeof raw.schema_version === "number" && raw.schema_version > MAX_SCHEMA_VERSION) {
    return {
      kind: "version-not-supported",
      artifact_kind: expectedKind,
      schema_version: raw.schema_version,
      max_supported: MAX_SCHEMA_VERSION,
    };
  }
  if (raw.schema_version !== 1) {
    return parseError("artifact schema_version is unsupported", raw);
  }
  return {
    kind: "ok",
    data: {
      api_version: "v1",
      schema_version: 1,
    },
  };
}

function parseIndexEntry(raw: unknown): AgentConversationIndexEntry | null {
  if (!isRecord(raw)) return null;
  const conversationId = stringField(raw, "conversation_id");
  const title = stringField(raw, "title");
  const status = conversationStatus(raw.status);
  const updatedAt = stringField(raw, "updated_at");
  const turnCount = numberField(raw, "turn_count");
  const contextItemCount = numberField(raw, "context_item_count");
  const outputCount = numberField(raw, "output_count");
  const proposalOutputCount = numberField(raw, "proposal_output_count");
  if (
    !conversationId ||
    !title ||
    !status ||
    !updatedAt ||
    turnCount === null ||
    contextItemCount === null ||
    outputCount === null ||
    proposalOutputCount === null
  ) {
    return null;
  }
  return {
    conversation_id: conversationId,
    title,
    status,
    updated_at: updatedAt,
    turn_count: turnCount,
    context_item_count: contextItemCount,
    output_count: outputCount,
    proposal_output_count: proposalOutputCount,
  };
}

function parseParticipant(raw: unknown): AgentConversationParticipant | null {
  if (!isRecord(raw)) return null;
  const participantId = stringField(raw, "participant_id");
  const role = participantRole(raw.role);
  if (!participantId || !role) return null;
  return {
    participant_id: participantId,
    role,
    display_name: optionalString(raw.display_name),
  };
}

function parseContextSet(raw: unknown): AgentConversationContextSetArtifact | null {
  if (!isRecord(raw)) return null;
  const contextSetId = stringField(raw, "context_set_id");
  const createdAt = stringField(raw, "created_at");
  const label = stringField(raw, "label");
  const itemsRaw = arrayField(raw, "items");
  if (!contextSetId || !createdAt || !label || itemsRaw === null) return null;
  const items = itemsRaw.map(parseContextItem);
  if (items.some((item) => item === null)) return null;
  return {
    context_set_id: contextSetId,
    created_at: createdAt,
    label,
    items: items as AgentConversationContextItem[],
  };
}

function parseContextItem(raw: unknown): AgentConversationContextItem | null {
  if (!isRecord(raw) || typeof raw.kind !== "string") return null;
  if (raw.kind === "spec_node") {
    const nodeId = stringField(raw, "node_id");
    if (!nodeId) return null;
    return {
      kind: "spec_node",
      node_id: nodeId,
      title: optionalString(raw.title) ?? nodeId,
      status: optionalString(raw.status) ?? "unknown",
      file_name: optionalString(raw.file_name) ?? `${nodeId}.yaml`,
    };
  }
  if (raw.kind === "spec_edge") {
    const source = stringField(raw, "source_node_id");
    const target = stringField(raw, "target_node_id");
    const edgeKind = stringField(raw, "edge_kind");
    if (!source || !target || !edgeKind) return null;
    return {
      kind: "spec_edge",
      edge_id: optionalString(raw.edge_id) ?? `${source}->${target}:${edgeKind}`,
      source_node_id: source,
      target_node_id: target,
      edge_kind: edgeKind,
      status: optionalString(raw.status) ?? "unknown",
      source_title: optionalString(raw.source_title),
      target_title: optionalString(raw.target_title),
    };
  }
  if (raw.kind === "gap") {
    const nodeId = stringField(raw, "node_id");
    const gapId = stringField(raw, "gap_id");
    const path = stringField(raw, "path");
    if (!nodeId || !gapId || !path) return null;
    return {
      kind: "gap",
      node_id: nodeId,
      title: optionalString(raw.title) ?? nodeId,
      gap_id: gapId,
      gap_kind: gapKind(raw.gap_kind),
      gap_count: numberField(raw, "gap_count") ?? 0,
      path,
    };
  }
  if (raw.kind === "proposal") {
    const proposalKey = stringField(raw, "proposal_key");
    if (!proposalKey) return null;
    return {
      kind: "proposal",
      proposal_key: proposalKey,
      proposal_id: optionalString(raw.proposal_id) ?? proposalKey,
      title: optionalString(raw.title) ?? proposalKey,
      status: optionalString(raw.status) ?? "unknown",
      proposal_path: optionalString(raw.proposal_path),
      affected_spec_ids: stringArray(raw.affected_spec_ids),
    };
  }
  if (raw.kind === "metric") {
    const metricKey = stringField(raw, "metric_key");
    const itemId = stringField(raw, "item_id");
    const category = stringField(raw, "category");
    if (!metricKey || !itemId || !category) return null;
    return {
      kind: "metric",
      metric_key: metricKey,
      item_id: itemId,
      title: optionalString(raw.title) ?? itemId,
      category,
      status: optionalString(raw.status) ?? "unknown",
      source_kind: optionalString(raw.source_kind) ?? "unknown",
      reference_texts: stringArray(raw.reference_texts),
    };
  }
  if (raw.kind === "specpm_package") {
    const packageId = stringField(raw, "package_id");
    const version = stringField(raw, "version");
    if (!packageId || !version) return null;
    return {
      kind: "specpm_package",
      package_id: packageId,
      version,
    };
  }
  if (raw.kind === "external_link") {
    const title = stringField(raw, "title");
    const artifactPath = stringField(raw, "artifact_path");
    const nodeId = stringField(raw, "node_id");
    if (!title || !artifactPath || !nodeId) return null;
    return {
      kind: "external_link",
      title,
      artifact_path: artifactPath,
      source_kind: raw.source_kind === "hyperprompt_compile" ? "hyperprompt_compile" : "export",
      node_id: nodeId,
      scope: raw.scope === "subtree" ? "subtree" : "node",
      node_count: numberField(raw, "node_count") ?? 1,
    };
  }
  return null;
}

function parseTurn(raw: unknown): AgentConversationTurnArtifact | null {
  if (!isRecord(raw)) return null;
  const turnId = stringField(raw, "turn_id");
  const role = participantRole(raw.role);
  const createdAt = stringField(raw, "created_at");
  const contentRaw = arrayField(raw, "content") ?? [];
  if (!turnId || !role || !createdAt) return null;
  const content = contentRaw.map(parseContentBlock);
  if (content.some((block) => block === null)) return null;
  return {
    turn_id: turnId,
    role,
    created_at: createdAt,
    completed: typeof raw.completed === "boolean" ? raw.completed : true,
    content: content as AgentConversationContentBlock[],
    context_set_ids: stringArray(raw.context_set_ids),
  };
}

function parseContentBlock(raw: unknown): AgentConversationContentBlock | null {
  if (!isRecord(raw) || typeof raw.kind !== "string") return null;
  if (raw.kind === "text" || raw.kind === "markdown") {
    const text = stringField(raw, "text");
    return text === null ? null : { kind: raw.kind, text };
  }
  if (raw.kind === "artifact_ref") {
    const artifactRef = stringField(raw, "artifact_ref");
    if (!artifactRef) return null;
    return {
      kind: "artifact_ref",
      artifact_ref: artifactRef,
      title: optionalString(raw.title) ?? artifactRef,
    };
  }
  return null;
}

function parseOutput(raw: unknown): AgentConversationOutputArtifact | null {
  if (!isRecord(raw)) return null;
  const outputId = stringField(raw, "output_id");
  const kind = outputKind(raw.kind);
  const createdAt = stringField(raw, "created_at");
  const originTurnId = stringField(raw, "origin_turn_id");
  if (!outputId || !kind || !createdAt || !originTurnId) return null;
  const proposal = recordField(raw, "proposal");
  return {
    output_id: outputId,
    kind,
    created_at: createdAt,
    origin_turn_id: originTurnId,
    context_set_ids: stringArray(raw.context_set_ids),
    proposal: proposal
      ? {
          proposal_key: optionalString(proposal.proposal_key) ?? outputId,
          title: optionalString(proposal.title) ?? outputId,
          status: outputStatus(proposal.status),
          target_spec_ids: stringArray(proposal.target_spec_ids),
        }
      : undefined,
  };
}

function parseParentRef(raw: unknown): AgentConversationArtifact["parent_refs"][number] | null {
  if (!isRecord(raw)) return null;
  const kind = stringField(raw, "kind");
  const artifactRef = stringField(raw, "artifact_ref");
  if (!kind || !artifactRef) return null;
  return {
    kind,
    artifact_ref: artifactRef,
    title: optionalString(raw.title),
  };
}

function formatContentBlock(block: AgentConversationContentBlock): string {
  if (block.kind === "artifact_ref") {
    return `[Artifact] ${block.title}: ${block.artifact_ref}`;
  }
  return block.text;
}

function conversationStatus(value: unknown): AgentConversationArtifact["status"] | null {
  if (value === "active" || value === "archived" || value === "superseded") return value;
  return null;
}

function participantRole(value: unknown): AgentConversationParticipantRole | null {
  if (value === "operator" || value === "agent" || value === "system" || value === "tool") {
    return value;
  }
  return null;
}

function outputKind(value: unknown): AgentConversationOutputArtifact["kind"] | null {
  if (
    value === "analysis" ||
    value === "proposal_draft" ||
    value === "implementation_handoff" ||
    value === "metric_note"
  ) {
    return value;
  }
  return null;
}

function outputStatus(value: unknown): AgentConversationOutputStatus {
  if (
    value === "draft" ||
    value === "proposed" ||
    value === "materialized" ||
    value === "rejected"
  ) {
    return value;
  }
  return "draft";
}

function gapKind(value: unknown): AgentContextSpecGapKind {
  if (value === "input" || value === "execution") return value;
  return "evidence";
}

function parseError(reason: string, raw: unknown): AgentConversationParseResult<never> {
  return { kind: "parse-error", reason, raw };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function recordField(value: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const raw = value[field];
  return isRecord(raw) ? raw : null;
}

function arrayField(value: Record<string, unknown>, field: string): unknown[] | null {
  const raw = value[field];
  return Array.isArray(raw) ? raw : null;
}

function stringField(value: Record<string, unknown>, field: string): string | null {
  const raw = value[field];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberField(value: Record<string, unknown>, field: string): number | null {
  const raw = value[field];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}
