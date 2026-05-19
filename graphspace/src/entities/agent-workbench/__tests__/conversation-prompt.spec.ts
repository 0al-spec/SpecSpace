import { describe, expect, it } from "vitest";
import {
  createMetricConversationPromptSeed,
  createProposalConversationPromptSeed,
} from "../index";

describe("agent conversation prompt seeds", () => {
  it("builds a proposal-specific starter prompt with affected specs", () => {
    const seed = createProposalConversationPromptSeed({
      proposal_id: "P-0042",
      title: "Attach SG-SPEC-0001 trace contract",
      affected_spec_ids: ["SG-SPEC-0001", "SG-SPEC-0051"],
    });

    expect(seed).toEqual({
      source_kind: "proposal",
      source_id: "P-0042",
      prompt: [
        "Review proposal P-0042: Attach SG-SPEC-0001 trace contract.",
        "Use the attached proposal context to identify the next SpecGraph action, affected specs, and any missing evidence before materialization.",
        "Affected specs: SG-SPEC-0001, SG-SPEC-0051",
      ].join("\n"),
    });
  });

  it("builds a metric-specific starter prompt and caps reference noise", () => {
    const seed = createMetricConversationPromptSeed({
      item_id: "proposal_trace_entities",
      title: "Proposal trace entities",
      reference_texts: [
        "SG-SPEC-0001",
        "SG-SPEC-0002",
        "SG-SPEC-0003",
        "SG-SPEC-0004",
        "SG-SPEC-0005",
        "SG-SPEC-0006",
        "SG-SPEC-0007",
      ],
    });

    expect(seed.source_kind).toBe("metric");
    expect(seed.source_id).toBe("proposal_trace_entities");
    expect(seed.prompt).toContain("Analyze metric proposal_trace_entities: Proposal trace entities.");
    expect(seed.prompt).toContain(
      "References: SG-SPEC-0001, SG-SPEC-0002, SG-SPEC-0003, SG-SPEC-0004, SG-SPEC-0005, SG-SPEC-0006, +1 more",
    );
  });
});
