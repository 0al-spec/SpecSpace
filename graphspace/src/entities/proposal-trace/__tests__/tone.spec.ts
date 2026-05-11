import { describe, it, expect } from "vitest";
import { toneFor } from "../lib/tone";
import type { ProposalTraceEntry } from "../model/types";

const make = (status: string): ProposalTraceEntry => ({
  trace_entry_id: "proposal::0001",
  proposal_id: "0001",
  proposal_path: "docs/proposals/0001.md",
  title: "Proposal",
  status: "Draft proposal",
  spec_refs: [],
  mentioned_spec_ids: [],
  promotion_trace: { status, trace_status: status },
  next_gap: "attach_promotion_trace",
});

describe("toneFor (proposal trace)", () => {
  it.each([
    ["declared", "declared"],
    ["inferred", "inferred"],
    ["missing_trace", "missing"],
    ["future_status", "neutral"],
  ] as const)("maps %s -> %s", (status, expected) => {
    expect(toneFor(make(status))).toBe(expected);
  });
});
