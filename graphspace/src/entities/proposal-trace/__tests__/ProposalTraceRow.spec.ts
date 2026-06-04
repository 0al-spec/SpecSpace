import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProposalTraceEntry } from "../model/types";
import { ProposalTraceRow } from "../ui/ProposalTraceRow";

const entry: ProposalTraceEntry = {
  trace_entry_id: "proposal::0047",
  proposal_id: "0047",
  proposal_path: "docs/proposals/0047_evidence_backed_build_protocol.md",
  title: "Evidence-Backed Build Protocol",
  status: "BOUNDED",
  spec_refs: ["SG-SPEC-0030", "SG-SPEC-0123", "SG-SPEC-0150", "SG-SPEC-0200"].map(
    (specId) => ({
      proposal_id: "0047",
      proposal_path: "docs/proposals/0047_evidence_backed_build_protocol.md",
      spec_id: specId,
      relation_kind: "mentions",
      authority: "textual_reference",
      trace_status: "BOUNDED",
      next_gap: "none",
      source_refs: ["docs/proposals/0047_evidence_backed_build_protocol.md"],
    }),
  ),
  mentioned_spec_ids: ["SG-SPEC-0030", "SG-SPEC-0123SG-SPEC-0150SG-SPEC-0200"],
  promotion_trace: { status: "BOUNDED", trace_status: "BOUNDED" },
  next_gap: "none",
};

describe("ProposalTraceRow", () => {
  it("renders concatenated mentioned spec ids as separate refs", () => {
    const html = renderToStaticMarkup(createElement(ProposalTraceRow, { entry }));

    expect(html).toContain("SG-SPEC-0123");
    expect(html).toContain("SG-SPEC-0150");
    expect(html).toContain("SG-SPEC-0200");
    expect(html).not.toContain("SG-SPEC-0123SG-SPEC-0150SG-SPEC-0200");
  });

  it("preserves resolver-backed splitting for nonnumeric graph refs", () => {
    const sampleEntry: ProposalTraceEntry = {
      ...entry,
      mentioned_spec_ids: ["SG-SPEC-SAMPLE-ROOTSG-SPEC-SAMPLE-RUNTIME"],
    };
    const html = renderToStaticMarkup(
      createElement(ProposalTraceRow, {
        entry: sampleEntry,
        resolveSpecRef: (token: string) =>
          token === "SG-SPEC-SAMPLE-ROOT" || token === "SG-SPEC-SAMPLE-RUNTIME"
            ? token
            : null,
      }),
    );

    expect(html).toContain("SG-SPEC-SAMPLE-ROOT");
    expect(html).toContain("SG-SPEC-SAMPLE-RUNTIME");
    expect(html).not.toContain("SG-SPEC-SAMPLE-ROOTSG-SPEC-SAMPLE-RUNTIME");
  });
});
