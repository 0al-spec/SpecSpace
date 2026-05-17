export type AgentContextSpecNodeItem = {
  kind: "spec_node";
  node_id: string;
  title: string;
  status: string;
  file_name: string;
};

export type AgentContextItem = AgentContextSpecNodeItem;

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

export function agentContextItemKey(item: AgentContextItem): string {
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
    items: draft.items.map((item) => ({ ...item })),
  };
}
