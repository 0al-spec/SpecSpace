import { describe, it, expect } from "vitest";
import { parseProposalSpecTraceIndex } from "../parsers/parse-proposal-spec-trace-index";

const fixture = () => ({
  artifact_kind: "proposal_spec_trace_index",
  schema_version: 1,
  generated_at: "2026-05-11T08:00:52+00:00",
  entry_count: 1,
  entries: [
    {
      trace_entry_id: "proposal::0001",
      proposal_id: "0001",
      proposal_path: "docs/proposals/0001_vocabulary.md",
      title: "Vocabulary",
      status: "Draft proposal",
      spec_refs: [
        {
          proposal_id: "0001",
          proposal_path: "docs/proposals/0001_vocabulary.md",
          spec_id: "SG-SPEC-0008",
          relation_kind: "mentions",
          authority: "textual_reference",
          trace_status: "inferred",
          next_gap: "attach_promotion_trace",
          source_refs: ["docs/proposals/0001_vocabulary.md"],
        },
      ],
      mentioned_spec_ids: ["SG-SPEC-0008"],
      promotion_trace: {
        status: "missing_trace",
        trace_status: "missing_trace",
        next_gap: "attach_promotion_trace",
        source_refs: [],
      },
      next_gap: "attach_promotion_trace",
    },
  ],
  lane_ref_count: 1,
  lane_refs: [
    {
      lane_ref_id: "governance_proposal::SG-SPEC-0008::candidate",
      proposal_handle: "governance_proposal::SG-SPEC-0008::candidate",
      target_spec_id: "SG-SPEC-0008",
      target_reference: "SG-SPEC-0008",
      relation_kind: "targets",
      authority: "lane_overlay",
      trace_status: "declared",
      source_refs: ["proposal_lane/nodes/example.json"],
      next_gap: "none",
    },
  ],
  summary: {
    entry_count: 1,
    lane_ref_count: 1,
    spec_ref_count: 1,
    authority_counts: { textual_reference: 1, lane_overlay: 1 },
    trace_status_counts: { inferred: 1, declared: 1, missing_trace: 1 },
  },
  viewer_projection: {
    spec_id: { "SG-SPEC-0008": ["proposal::0001"] },
    authority: { textual_reference: ["proposal::0001"] },
    trace_status: { inferred: ["proposal::0001"] },
    named_filters: { missing_trace: ["proposal::0001"] },
  },
  viewer_contract: {
    contract_doc: "docs/proposal_spec_trace_viewer_contract.md",
    read_only: true,
  },
  canonical_mutations_allowed: false,
  tracked_artifacts_written: false,
});

describe("parseProposalSpecTraceIndex", () => {
  it("parses the proposal/spec trace artifact shape", () => {
    const r = parseProposalSpecTraceIndex(fixture());
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.data.entries[0].proposal_id).toBe("0001");
    expect(r.data.entries[0].mentioned_spec_ids).toEqual(["SG-SPEC-0008"]);
  });

  it("rejects the wrong artifact kind", () => {
    const broken = { ...fixture(), artifact_kind: "spec_activity_feed" };
    expect(parseProposalSpecTraceIndex(broken).kind).toBe("wrong-artifact-kind");
  });

  it("returns version-not-supported for future schemas", () => {
    const future = { ...fixture(), schema_version: 99 };
    expect(parseProposalSpecTraceIndex(future).kind).toBe("version-not-supported");
  });

  it("flags entry count mismatch", () => {
    const broken = { ...fixture(), entry_count: 2 };
    expect(parseProposalSpecTraceIndex(broken).kind).toBe("invariant-violation");
  });

  it("flags lane ref count mismatch", () => {
    const broken = { ...fixture(), lane_ref_count: 2 };
    expect(parseProposalSpecTraceIndex(broken).kind).toBe("invariant-violation");
  });
});
