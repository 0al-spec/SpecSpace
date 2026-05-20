import type {
  AgentContextSpecMarkdownScope,
  AgentContextSpecMarkdownSourceKind,
} from "./context";

export type AgentConversationPromptSeed = {
  source_kind: "proposal" | "metric" | "spec_markdown";
  source_id: string;
  prompt: string;
};

export type ProposalConversationPromptSource = {
  proposal_id: string;
  title: string;
  affected_spec_ids: readonly string[];
};

export type MetricConversationPromptSource = {
  item_id: string;
  title: string;
  reference_texts: readonly string[];
};

export type SpecMarkdownConversationPromptSource = {
  node_id: string;
  title: string;
  scope: AgentContextSpecMarkdownScope;
  source_kind: AgentContextSpecMarkdownSourceKind;
  download_filename: string;
  node_count: number;
};

export function createProposalConversationPromptSeed(
  proposal: ProposalConversationPromptSource,
): AgentConversationPromptSeed {
  return {
    source_kind: "proposal",
    source_id: proposal.proposal_id,
    prompt: [
      `Review proposal ${proposal.proposal_id}: ${proposal.title}.`,
      "Use the attached proposal context to identify the next SpecGraph action, affected specs, and any missing evidence before materialization.",
      referenceLine("Affected specs", proposal.affected_spec_ids),
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  };
}

export function createMetricConversationPromptSeed(
  metric: MetricConversationPromptSource,
): AgentConversationPromptSeed {
  return {
    source_kind: "metric",
    source_id: metric.item_id,
    prompt: [
      `Analyze metric ${metric.item_id}: ${metric.title}.`,
      "Use the attached metric context to identify the affected SpecGraph specs, likely gaps, and the next proposal or analysis action.",
      referenceLine("References", metric.reference_texts),
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  };
}

export function createSpecMarkdownConversationPromptSeed(
  markdown: SpecMarkdownConversationPromptSource,
): AgentConversationPromptSeed {
  return {
    source_kind: "spec_markdown",
    source_id: `${markdown.source_kind}:${markdown.node_id}:${markdown.scope}`,
    prompt: [
      `Review ${formatSpecMarkdownSource(markdown.source_kind)} for ${markdown.node_id}: ${markdown.title}.`,
      "Use the attached Markdown context to identify the affected specs, remaining gaps, and the next SpecGraph proposal or analysis action.",
      `Scope: ${formatSpecMarkdownScope(markdown.scope)}; nodes: ${markdown.node_count}; artifact: ${markdown.download_filename}`,
    ].join("\n"),
  };
}

function referenceLine(label: string, references: readonly string[]): string {
  if (references.length === 0) return "";
  const visible = references.slice(0, 6);
  const suffix = references.length > visible.length ? `, +${references.length - visible.length} more` : "";
  return `${label}: ${visible.join(", ")}${suffix}`;
}

function formatSpecMarkdownSource(
  sourceKind: AgentContextSpecMarkdownSourceKind,
): string {
  if (sourceKind === "hyperprompt_compile") return "compiled Spec Markdown";
  return "Spec Markdown export";
}

function formatSpecMarkdownScope(scope: AgentContextSpecMarkdownScope): string {
  if (scope === "subtree") return "refinement subtree";
  return "selected spec";
}
