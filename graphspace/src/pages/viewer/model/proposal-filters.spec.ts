import { describe, expect, it } from "vitest";
import type { ProposalIndexEntry } from "@/shared/proposal-viewer-contract";
import {
  filterProposalEntries,
  filterProposalEntriesByContext,
  sortedFilterOptions,
} from "./proposal-filters";

const entry = (overrides: Partial<ProposalIndexEntry>): ProposalIndexEntry => ({
  proposal_key: "proposal::0001",
  proposal_id: "0001",
  proposal_handle: null,
  title: "Proposal",
  status: "Draft proposal",
  proposal_path: "docs/proposals/0001.md",
  markdown: { available: false },
  authority_state: null,
  proposal_type: null,
  runtime_state: null,
  runtime_posture: null,
  promotion_status: null,
  trace_status: null,
  next_gap: null,
  affected_spec_ids: [],
  source_kinds: [],
  ...overrides,
});

describe("filterProposalEntries", () => {
  const entries = [
    entry({
      proposal_id: "0001",
      status: "Draft proposal",
      runtime_state: "implemented",
      affected_spec_ids: ["SG-SPEC-0001"],
    }),
    entry({
      proposal_key: "lane::governance",
      proposal_id: "governance",
      status: "under_review",
      authority_state: "under_review",
      affected_spec_ids: ["SG-SPEC-0002"],
    }),
  ];

  it("filters by status, authority state, runtime state, and affected spec query", () => {
    expect(filterProposalEntries(entries, {
      status: "Draft proposal",
      authorityState: "",
      runtimeState: "implemented",
      specQuery: "sgspec0001",
    }).map((item) => item.proposal_id)).toEqual(["0001"]);

    expect(filterProposalEntries(entries, {
      status: "",
      authorityState: "under_review",
      runtimeState: "",
      specQuery: "0002",
    }).map((item) => item.proposal_id)).toEqual(["governance"]);
  });

  it("treats null option fields as unknown", () => {
    expect(filterProposalEntries(entries, {
      status: "",
      authorityState: "unknown",
      runtimeState: "",
      specQuery: "",
    }).map((item) => item.proposal_id)).toEqual(["0001"]);
  });
});

describe("filterProposalEntriesByContext", () => {
  it("keeps only proposals that affect the selected canvas spec", () => {
    const entries = [
      entry({ proposal_id: "0001", affected_spec_ids: ["SG-SPEC-0001"] }),
      entry({ proposal_id: "0002", affected_spec_ids: ["SG-SPEC-0002"] }),
    ];

    expect(filterProposalEntriesByContext(entries, {
      kind: "spec",
      specId: "SG-SPEC-0001",
    }).map((item) => item.proposal_id)).toEqual(["0001"]);
  });

  it("does not fuzzy-match proposal context filters", () => {
    const entries = [
      entry({ proposal_id: "0001", affected_spec_ids: ["SG-SPEC-0001-extra"] }),
    ];

    expect(filterProposalEntriesByContext(entries, {
      kind: "spec",
      specId: "SG-SPEC-0001",
    })).toEqual([]);
  });
});

describe("sortedFilterOptions", () => {
  it("sorts count map keys for stable select order", () => {
    expect(sortedFilterOptions({ beta: 1, alpha: 1 })).toEqual(["alpha", "beta"]);
  });
});
