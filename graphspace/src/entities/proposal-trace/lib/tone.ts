import type { ProposalTraceEntry } from "../model/types";

export type ProposalTraceTone = "declared" | "inferred" | "missing" | "neutral";

export function toneFor(entry: ProposalTraceEntry): ProposalTraceTone {
  const traceStatus = String(entry.promotion_trace.trace_status ?? entry.promotion_trace.status ?? "");
  if (traceStatus === "declared") return "declared";
  if (traceStatus === "inferred") return "inferred";
  if (traceStatus === "missing_trace") return "missing";
  return "neutral";
}
