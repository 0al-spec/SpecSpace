import { describe, expect, it } from "vitest";
import {
  addAgentContextItem,
  agentContextItemKey,
  createAgentContextDraft,
  createMetricContextItem,
  createSpecEdgeContextItem,
  createSpecGapContextItem,
  createSpecMarkdownContextItem,
  createProposalContextItem,
  createSpecNodeContextItem,
  removeAgentContextItem,
  serializeAgentContextSet,
  type MetricContextSource,
  type ProposalContextSource,
  type SpecEdgeContextSource,
  type SpecNodeContextSource,
  type SpecMarkdownContextSource,
} from "../index";

const node = (
  overrides: Partial<SpecNodeContextSource> = {},
): SpecNodeContextSource => ({
  node_id: "SG-SPEC-0001",
  file_name: "SG-SPEC-0001.yaml",
  title: "SpecGraph - The Executable Product Ontology",
  status: "linked",
  ...overrides,
});

const proposal = (
  overrides: Partial<ProposalContextSource> = {},
): ProposalContextSource => ({
  proposal_key: "proposal::0042",
  proposal_id: "0042",
  title: "Agent Context Bridge",
  status: "Draft proposal",
  proposal_path: "docs/proposals/0042_agent_context.md",
  affected_spec_ids: ["SG-SPEC-0001"],
  ...overrides,
});

const metric = (
  overrides: Partial<MetricContextSource> = {},
): MetricContextSource => ({
  metric_key: "metric_score::specification_quality",
  item_id: "specification_quality",
  title: "Specification quality",
  category: "metric_score",
  status: "healthy",
  source_kind: "graph_dashboard",
  reference_texts: ["SG-SPEC-0001"],
  ...overrides,
});

const edge = (
  overrides: Partial<SpecEdgeContextSource> = {},
): SpecEdgeContextSource => ({
  edge_id: "SG-SPEC-0002-refines-SG-SPEC-0001",
  edge_kind: "refines",
  status: "resolved",
  source_id: "SG-SPEC-0002",
  target_id: "SG-SPEC-0001",
  source_title: "Child spec",
  target_title: "Parent spec",
  ...overrides,
});

const specMarkdown = (
  overrides: Partial<SpecMarkdownContextSource> = {},
): SpecMarkdownContextSource => ({
  node_id: "SG-SPEC-0001",
  title: "SpecGraph - The Executable Product Ontology",
  scope: "subtree",
  source_kind: "export",
  download_filename: "SG-SPEC-0001.subtree.md",
  node_count: 3,
  markdown: "# SG-SPEC-0001\n\nCompiled context.",
  ...overrides,
});

describe("agent context draft", () => {
  it("serializes selected spec nodes into the workbench context_set shape", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const withNode = addAgentContextItem(draft, createSpecNodeContextItem(node()));
    const serialized = serializeAgentContextSet(withNode);

    expect(serialized).toEqual({
      context_set_id: "ctx-draft",
      created_at: "2026-05-17T16:00:00Z",
      label: "Graph context draft",
      items: [
        {
          kind: "spec_node",
          node_id: "SG-SPEC-0001",
          title: "SpecGraph - The Executable Product Ontology",
          status: "linked",
          file_name: "SG-SPEC-0001.yaml",
        },
      ],
    });
  });

  it("deduplicates context items by stable kind and id", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecNodeContextItem(node());

    const withDuplicate = addAgentContextItem(addAgentContextItem(draft, item), item);

    expect(withDuplicate.items).toHaveLength(1);
    expect(agentContextItemKey(item)).toBe("spec_node:SG-SPEC-0001");
  });

  it("serializes selected graph edges into the workbench context_set shape", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecEdgeContextItem(edge());
    const withEdge = addAgentContextItem(draft, item);

    expect(agentContextItemKey(item)).toBe("spec_edge:SG-SPEC-0002-refines-SG-SPEC-0001");
    expect(serializeAgentContextSet(withEdge).items).toEqual([
      {
        kind: "spec_edge",
        edge_id: "SG-SPEC-0002-refines-SG-SPEC-0001",
        edge_kind: "refines",
        status: "resolved",
        source_id: "SG-SPEC-0002",
        target_id: "SG-SPEC-0001",
        source_title: "Child spec",
        target_title: "Parent spec",
      },
    ]);
  });

  it("serializes selected spec gaps into the workbench context_set shape", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecGapContextItem({
      node_id: "SG-SPEC-0001",
      title: "SpecGraph - The Executable Product Ontology",
      gap_kind: "evidence",
      gap_count: 2,
    });
    const withGap = addAgentContextItem(draft, item);

    expect(agentContextItemKey(item)).toBe("spec_gap:SG-SPEC-0001:evidence");
    expect(serializeAgentContextSet(withGap).items).toEqual([
      {
        kind: "spec_gap",
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        gap_kind: "evidence",
        gap_count: 2,
      },
    ]);
  });

  it("serializes proposal context items by stable proposal key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createProposalContextItem(proposal());
    const withProposal = addAgentContextItem(draft, item);
    const serialized = serializeAgentContextSet(withProposal);

    expect(agentContextItemKey(item)).toBe("proposal:proposal::0042");
    expect(serialized.items).toEqual([
      {
        kind: "proposal",
        proposal_key: "proposal::0042",
        proposal_id: "0042",
        title: "Agent Context Bridge",
        status: "Draft proposal",
        proposal_path: "docs/proposals/0042_agent_context.md",
        affected_spec_ids: ["SG-SPEC-0001"],
      },
    ]);

    const serializedProposal = serialized.items[0];
    if (serializedProposal.kind !== "proposal") {
      throw new Error("expected serialized proposal item");
    }
    serializedProposal.affected_spec_ids.push("SG-SPEC-0002");

    expect(withProposal.items[0]).toMatchObject({
      kind: "proposal",
      affected_spec_ids: ["SG-SPEC-0001"],
    });
  });

  it("serializes metric context items by stable metric key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createMetricContextItem(metric());
    const withMetric = addAgentContextItem(draft, item);
    const serialized = serializeAgentContextSet(withMetric);

    expect(agentContextItemKey(item)).toBe("metric:metric_score::specification_quality");
    expect(serialized.items).toEqual([
      {
        kind: "metric",
        metric_key: "metric_score::specification_quality",
        item_id: "specification_quality",
        title: "Specification quality",
        category: "metric_score",
        status: "healthy",
        source_kind: "graph_dashboard",
        reference_texts: ["SG-SPEC-0001"],
      },
    ]);

    const serializedMetric = serialized.items[0];
    if (serializedMetric.kind !== "metric") {
      throw new Error("expected serialized metric item");
    }
    serializedMetric.reference_texts.push("SG-SPEC-0002");

    expect(withMetric.items[0]).toMatchObject({
      kind: "metric",
      reference_texts: ["SG-SPEC-0001"],
    });
  });

  it("serializes Spec Markdown context items by source, root, and scope", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecMarkdownContextItem(specMarkdown());
    const withMarkdown = addAgentContextItem(draft, item);
    const serialized = serializeAgentContextSet(withMarkdown);

    expect(agentContextItemKey(item)).toBe(
      "spec_markdown:export:SG-SPEC-0001:subtree",
    );
    expect(serialized.items).toEqual([
      {
        kind: "spec_markdown",
        markdown_key: "export:SG-SPEC-0001:subtree",
        node_id: "SG-SPEC-0001",
        title: "SpecGraph - The Executable Product Ontology",
        scope: "subtree",
        source_kind: "export",
        download_filename: "SG-SPEC-0001.subtree.md",
        node_count: 3,
        markdown: "# SG-SPEC-0001\n\nCompiled context.",
        compile: null,
      },
    ]);
  });

  it("serializes Hyperprompt-compiled Markdown artifacts without sharing compile object references", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecMarkdownContextItem(
      specMarkdown({
        source_kind: "hyperprompt_compile",
        download_filename: "SG-SPEC-0001.subtree.compiled.md",
        markdown: "# Compiled",
        compile: {
          exit_code: 0,
          compiled_md: "/tmp/specspace/out.compiled.md",
          manifest_json: "/tmp/specspace/manifest.json",
          root_hc: "/tmp/specspace/root.hc",
        },
      }),
    );
    const withMarkdown = addAgentContextItem(draft, item);
    const serialized = serializeAgentContextSet(withMarkdown);

    expect(agentContextItemKey(item)).toBe(
      "spec_markdown:hyperprompt_compile:SG-SPEC-0001:subtree",
    );

    const serializedMarkdown = serialized.items[0];
    if (serializedMarkdown.kind !== "spec_markdown" || !serializedMarkdown.compile) {
      throw new Error("expected serialized Spec Markdown item");
    }
    serializedMarkdown.compile.root_hc = "/mutated/root.hc";

    expect(withMarkdown.items[0]).toMatchObject({
      kind: "spec_markdown",
      compile: {
        root_hc: "/tmp/specspace/root.hc",
      },
    });
  });

  it("removes context items by key", () => {
    const draft = createAgentContextDraft("2026-05-17T16:00:00Z");
    const item = createSpecNodeContextItem(node());
    const withNode = addAgentContextItem(draft, item);

    expect(removeAgentContextItem(withNode, agentContextItemKey(item)).items).toEqual([]);
  });
});
