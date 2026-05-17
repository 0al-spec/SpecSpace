export type AgentContextSpecNodeItem = {
  kind: "spec_node";
  node_id: string;
  title: string;
  status: string;
  file_name: string;
};

export type AgentContextSpecEdgeItem = {
  kind: "spec_edge";
  edge_id: string;
  edge_kind: string;
  status: string;
  source_id: string;
  target_id: string;
  source_title: string | null;
  target_title: string | null;
};

export type AgentContextProposalItem = {
  kind: "proposal";
  proposal_key: string;
  proposal_id: string;
  title: string;
  status: string;
  proposal_path: string | null;
  affected_spec_ids: string[];
};

export type AgentContextItem =
  | AgentContextSpecNodeItem
  | AgentContextSpecEdgeItem
  | AgentContextProposalItem;

export type AgentContextDraft = {
  context_set_id: string;
  created_at: string;
  label: string;
  items: AgentContextItem[];
};

export function createAgentContextDraft(createdAt: string): AgentContextDraft {
  return {
    context_set_id: "ctx-draft",
    created_at: createdAt,
    label: "Graph context draft",
    items: [],
  };
}

export type SpecNodeContextSource = {
  node_id: string;
  title: string;
  status: string;
  file_name: string;
};

export function createSpecNodeContextItem(
  node: SpecNodeContextSource,
): AgentContextSpecNodeItem {
  return {
    kind: "spec_node",
    node_id: node.node_id,
    title: node.title,
    status: node.status,
    file_name: node.file_name,
  };
}

export type SpecEdgeContextSource = {
  edge_id: string;
  edge_kind: string;
  status: string;
  source_id: string;
  target_id: string;
  source_title?: string | null;
  target_title?: string | null;
};

export function createSpecEdgeContextItem(
  edge: SpecEdgeContextSource,
): AgentContextSpecEdgeItem {
  return {
    kind: "spec_edge",
    edge_id: edge.edge_id,
    edge_kind: edge.edge_kind,
    status: edge.status,
    source_id: edge.source_id,
    target_id: edge.target_id,
    source_title: edge.source_title ?? null,
    target_title: edge.target_title ?? null,
  };
}

export type ProposalContextSource = {
  proposal_key: string;
  proposal_id: string;
  title: string;
  status: string;
  proposal_path: string | null;
  affected_spec_ids: readonly string[];
};

export function createProposalContextItem(
  proposal: ProposalContextSource,
): AgentContextProposalItem {
  return {
    kind: "proposal",
    proposal_key: proposal.proposal_key,
    proposal_id: proposal.proposal_id,
    title: proposal.title,
    status: proposal.status,
    proposal_path: proposal.proposal_path,
    affected_spec_ids: [...proposal.affected_spec_ids],
  };
}

export function agentContextItemKey(item: AgentContextItem): string {
  if (item.kind === "proposal") {
    return `${item.kind}:${item.proposal_key}`;
  }
  if (item.kind === "spec_edge") {
    return `${item.kind}:${item.edge_id}`;
  }
  return `${item.kind}:${item.node_id}`;
}

export function addAgentContextItem(
  draft: AgentContextDraft,
  item: AgentContextItem,
): AgentContextDraft {
  const key = agentContextItemKey(item);
  if (draft.items.some((existing) => agentContextItemKey(existing) === key)) {
    return draft;
  }
  return {
    ...draft,
    items: [...draft.items, item],
  };
}

export function removeAgentContextItem(
  draft: AgentContextDraft,
  key: string,
): AgentContextDraft {
  return {
    ...draft,
    items: draft.items.filter((item) => agentContextItemKey(item) !== key),
  };
}

export function clearAgentContextItems(draft: AgentContextDraft): AgentContextDraft {
  return {
    ...draft,
    items: [],
  };
}

export function serializeAgentContextSet(draft: AgentContextDraft): AgentContextDraft {
  return {
    context_set_id: draft.context_set_id,
    created_at: draft.created_at,
    label: draft.label,
    items: draft.items.map((item) =>
      item.kind === "proposal"
        ? { ...item, affected_spec_ids: [...item.affected_spec_ids] }
        : { ...item },
    ),
  };
}
