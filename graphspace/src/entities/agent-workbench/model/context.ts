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

export type AgentContextSpecGapKind = "evidence" | "input" | "execution";

export type AgentContextSpecGapItem = {
  kind: "spec_gap";
  node_id: string;
  title: string;
  gap_kind: AgentContextSpecGapKind;
  gap_count: number;
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

export type AgentContextMetricItem = {
  kind: "metric";
  metric_key: string;
  item_id: string;
  title: string;
  category: string;
  status: string;
  source_kind: string;
  reference_texts: string[];
};

export type AgentContextSpecMarkdownSourceKind =
  | "export"
  | "hyperprompt_compile";

export type AgentContextSpecMarkdownScope = "node" | "subtree";

export type AgentContextSpecMarkdownCompileArtifacts = {
  exit_code: number;
  compiled_md: string | null;
  manifest_json: string | null;
  root_hc: string | null;
};

export type AgentContextSpecMarkdownItem = {
  kind: "spec_markdown";
  markdown_key: string;
  node_id: string;
  title: string;
  scope: AgentContextSpecMarkdownScope;
  source_kind: AgentContextSpecMarkdownSourceKind;
  download_filename: string;
  node_count: number;
  markdown: string;
  compile: AgentContextSpecMarkdownCompileArtifacts | null;
};

export type AgentContextItem =
  | AgentContextSpecNodeItem
  | AgentContextSpecEdgeItem
  | AgentContextSpecGapItem
  | AgentContextProposalItem
  | AgentContextMetricItem
  | AgentContextSpecMarkdownItem;

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

export type SpecGapContextSource = {
  node_id: string;
  title: string;
  gap_kind: AgentContextSpecGapKind;
  gap_count: number;
};

export function createSpecGapContextItem(
  gap: SpecGapContextSource,
): AgentContextSpecGapItem {
  return {
    kind: "spec_gap",
    node_id: gap.node_id,
    title: gap.title,
    gap_kind: gap.gap_kind,
    gap_count: gap.gap_count,
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

export type MetricContextSource = {
  metric_key: string;
  item_id: string;
  title: string;
  category: string;
  status: string;
  source_kind: string;
  reference_texts: readonly string[];
};

export function createMetricContextItem(
  metric: MetricContextSource,
): AgentContextMetricItem {
  return {
    kind: "metric",
    metric_key: metric.metric_key,
    item_id: metric.item_id,
    title: metric.title,
    category: metric.category,
    status: metric.status,
    source_kind: metric.source_kind,
    reference_texts: [...metric.reference_texts],
  };
}

export type SpecMarkdownContextSource = {
  node_id: string;
  title: string;
  scope: AgentContextSpecMarkdownScope;
  source_kind: AgentContextSpecMarkdownSourceKind;
  download_filename: string;
  node_count: number;
  markdown: string;
  compile?: AgentContextSpecMarkdownCompileArtifacts | null;
};

export function createSpecMarkdownContextItem(
  markdown: SpecMarkdownContextSource,
): AgentContextSpecMarkdownItem {
  return {
    kind: "spec_markdown",
    markdown_key: specMarkdownContextKey(markdown),
    node_id: markdown.node_id,
    title: markdown.title,
    scope: markdown.scope,
    source_kind: markdown.source_kind,
    download_filename: markdown.download_filename,
    node_count: markdown.node_count,
    markdown: markdown.markdown,
    compile: markdown.compile
      ? {
          exit_code: markdown.compile.exit_code,
          compiled_md: markdown.compile.compiled_md,
          manifest_json: markdown.compile.manifest_json,
          root_hc: markdown.compile.root_hc,
        }
      : null,
  };
}

export function agentContextItemKey(item: AgentContextItem): string {
  if (item.kind === "proposal") {
    return `${item.kind}:${item.proposal_key}`;
  }
  if (item.kind === "metric") {
    return `${item.kind}:${item.metric_key}`;
  }
  if (item.kind === "spec_markdown") {
    return `${item.kind}:${item.markdown_key}`;
  }
  if (item.kind === "spec_edge") {
    return `${item.kind}:${item.edge_id}`;
  }
  if (item.kind === "spec_gap") {
    return `${item.kind}:${item.node_id}:${item.gap_kind}`;
  }
  return `${item.kind}:${item.node_id}`;
}

export function agentContextItemLabel(item: AgentContextItem): string {
  if (item.kind === "proposal") return item.proposal_id;
  if (item.kind === "metric") return item.item_id;
  if (item.kind === "spec_edge") return item.edge_id;
  if (item.kind === "spec_gap") {
    return `${item.node_id} ${formatAgentContextGapKind(item.gap_kind)} gap`;
  }
  if (item.kind === "spec_markdown") {
    return `${item.node_id} ${formatAgentContextMarkdownSource(item.source_kind)}`;
  }
  return item.node_id;
}

function formatAgentContextGapKind(kind: AgentContextSpecGapKind): string {
  if (kind === "evidence") return "Evidence";
  if (kind === "input") return "Input";
  return "Execution";
}

function formatAgentContextMarkdownSource(
  sourceKind: AgentContextSpecMarkdownSourceKind,
): string {
  if (sourceKind === "hyperprompt_compile") return "Hyperprompt compile";
  return "Markdown export";
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
        : item.kind === "metric"
          ? { ...item, reference_texts: [...item.reference_texts] }
          : item.kind === "spec_markdown"
            ? {
                ...item,
                compile: item.compile ? { ...item.compile } : null,
              }
          : { ...item },
    ),
  };
}

function specMarkdownContextKey(markdown: {
  source_kind: AgentContextSpecMarkdownSourceKind;
  node_id: string;
  scope: AgentContextSpecMarkdownScope;
}): string {
  return `${markdown.source_kind}:${markdown.node_id}:${markdown.scope}`;
}
