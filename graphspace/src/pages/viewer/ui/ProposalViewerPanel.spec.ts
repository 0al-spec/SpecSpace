import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ProposalIndex,
  ProposalIndexEntry,
} from "@/shared/proposal-viewer-contract";
import { ProposalViewerPanel } from "./ProposalViewerPanel";

const proposal0047: ProposalIndexEntry = {
  proposal_key: "proposal::0047",
  proposal_id: "0047",
  proposal_handle: null,
  title: "Evidence-Backed Build Protocol",
  status: "Draft proposal",
  proposal_path: "docs/proposals/0047_evidence_backed_build_protocol.md",
  markdown: {
    available: true,
    content_excerpt: "This proposal distills the expert review captured in:",
    content_body: "# Evidence-Backed Build Protocol\n\nFull Markdown body.",
  },
  authority_state: null,
  proposal_type: null,
  runtime_state: "implemented",
  runtime_posture: "synchronous_runtime_slice",
  promotion_status: "bounded",
  trace_status: "bounded",
  next_gap: "none",
  affected_spec_ids: ["SG-SPEC-0030", "SG-SPEC-0123SG-SPEC-0150SG-SPEC-0200"],
  source_kinds: ["proposal_markdown", "proposal_spec_trace_index"],
};

const proposalIndex: ProposalIndex = {
  api_version: "v1",
  artifact_kind: "specspace_proposal_index",
  generated_at: "2026-06-04T17:35:04Z",
  read_only: true,
  source: { provider: "file" },
  entry_count: 1,
  entries: [proposal0047],
  filters: {
    status_counts: { "Draft proposal": 1 },
    authority_state_counts: { unknown: 1 },
    runtime_state_counts: { implemented: 1 },
    runtime_posture_counts: { synchronous_runtime_slice: 1 },
    affected_spec_ids: ["SG-SPEC-0030", "SG-SPEC-0123", "SG-SPEC-0150", "SG-SPEC-0200"],
  },
  sources: {
    proposal_markdown: {
      available: true,
      entry_count: 1,
    },
    proposal_spec_trace_index: {
      available: true,
      entry_count: 1,
    },
  },
};

describe("ProposalViewerPanel", () => {
  it("renders concatenated affected spec ids as separate refs", () => {
    const html = renderToStaticMarkup(
      createElement(ProposalViewerPanel, {
        state: { kind: "ok", data: proposalIndex },
      }),
    );

    expect(html).toContain("SG-SPEC-0123");
    expect(html).toContain("SG-SPEC-0150");
    expect(html).toContain("SG-SPEC-0200");
    expect(html).not.toContain("SG-SPEC-0123SG-SPEC-0150SG-SPEC-0200");
  });
});
