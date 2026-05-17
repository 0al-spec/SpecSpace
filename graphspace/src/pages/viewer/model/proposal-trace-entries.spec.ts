import { describe, expect, it } from "vitest";
import { proposalTraceEntriesForPanel } from "./proposal-trace-entries";

describe("proposalTraceEntriesForPanel", () => {
  it("keeps all live proposal trace entries visible", () => {
    const entries = Array.from({ length: 50 }, (_, index) => ({
      trace_entry_id: `trace-${index + 1}`,
    }));

    expect(
      proposalTraceEntriesForPanel({ kind: "ok", data: { entries } }, []),
    ).toHaveLength(50);
  });

  it("uses fallback entries for non-live states", () => {
    expect(
      proposalTraceEntriesForPanel({ kind: "http-error" }, [{ trace_entry_id: "sample" }]),
    ).toEqual([{ trace_entry_id: "sample" }]);
  });
});
