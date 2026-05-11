import {
  proposalSpecTraceIndexSchema,
  type ProposalSpecTraceIndex,
} from "../schemas/proposal-spec-trace-index";
import { makeParser } from "./parse";

const counts: (data: ProposalSpecTraceIndex) => string | null = (data) => {
  if (data.entry_count !== data.entries.length) {
    return `entry count mismatch: entry_count=${data.entry_count}, entries.length=${data.entries.length}`;
  }
  if (data.summary.entry_count !== data.entries.length) {
    return `summary entry count mismatch: summary.entry_count=${data.summary.entry_count}, entries.length=${data.entries.length}`;
  }
  if (data.lane_ref_count !== data.lane_refs.length) {
    return `lane ref count mismatch: lane_ref_count=${data.lane_ref_count}, lane_refs.length=${data.lane_refs.length}`;
  }
  if (data.summary.lane_ref_count !== data.lane_refs.length) {
    return `summary lane ref count mismatch: summary.lane_ref_count=${data.summary.lane_ref_count}, lane_refs.length=${data.lane_refs.length}`;
  }
  return null;
};

export const parseProposalSpecTraceIndex = makeParser({
  kind: "proposal_spec_trace_index",
  schema: proposalSpecTraceIndexSchema,
  invariants: [counts],
});
