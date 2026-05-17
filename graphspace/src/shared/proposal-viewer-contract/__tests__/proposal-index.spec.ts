import { describe, expect, it } from "vitest";
import { parseProposalIndex } from "../parsers/parse-proposal-index";

const proposalIndex = () => ({
  api_version: "v1",
  artifact_kind: "specspace_proposal_index",
  generated_at: "2026-05-17T12:00:00Z",
  read_only: true,
  source: { provider: "http", artifact_base_url: "https://specgraph.tech" },
  entry_count: 1,
  entries: [
    {
      proposal_key: "proposal::0042",
      proposal_id: "0042",
      proposal_handle: null,
      title: "Agent Context Bridge",
      status: "Draft proposal",
      proposal_path: "docs/proposals/0042_agent_context.md",
      markdown: {
        available: true,
        content_excerpt: "Connect selected SpecGraph context to the Agent Workbench.",
        content_preview: "Connect selected SpecGraph context to the Agent Workbench with a longer preview.",
      },
      authority_state: null,
      proposal_type: null,
      runtime_state: "implemented",
      runtime_posture: "synchronous_runtime_slice",
      promotion_status: "bounded",
      trace_status: "bounded",
      next_gap: "none",
      affected_spec_ids: ["SG-SPEC-0001"],
      source_kinds: ["proposal_runtime_index", "proposal_spec_trace_index"],
    },
  ],
  filters: {
    status_counts: { "Draft proposal": 1 },
    authority_state_counts: { unknown: 1 },
    runtime_state_counts: { implemented: 1 },
    runtime_posture_counts: { synchronous_runtime_slice: 1 },
    affected_spec_ids: ["SG-SPEC-0001"],
  },
  sources: {
    proposal_spec_trace_index: {
      available: true,
      artifact: "runs/proposal_spec_trace_index.json",
      entry_count: 1,
    },
    proposal_markdown: {
      available: false,
      entry_count: 0,
    },
  },
});

describe("parseProposalIndex", () => {
  it("accepts the SpecSpace proposal index payload", () => {
    const result = parseProposalIndex(proposalIndex());

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.entries[0].affected_spec_ids).toEqual(["SG-SPEC-0001"]);
    expect(result.data.entries[0].markdown.content_excerpt).toBe(
      "Connect selected SpecGraph context to the Agent Workbench.",
    );
    expect(result.data.entries[0].markdown.content_preview).toBe(
      "Connect selected SpecGraph context to the Agent Workbench with a longer preview.",
    );
    expect(result.data.filters.runtime_state_counts.implemented).toBe(1);
  });

  it("rejects non-proposal-index payloads", () => {
    const broken = proposalIndex();
    broken.artifact_kind = "proposal_spec_trace_index";

    expect(parseProposalIndex(broken).kind).toBe("parse-error");
  });

  it("accepts missing preview fields as null for compatibility", () => {
    const payload = proposalIndex() as any;
    payload.entries[0].markdown.content_excerpt = null;
    payload.entries[0].markdown.content_preview = null;
    payload.sources.proposal_markdown.reason = null;

    const result = parseProposalIndex(payload);

    expect(result.kind).toBe("ok");
  });
});
