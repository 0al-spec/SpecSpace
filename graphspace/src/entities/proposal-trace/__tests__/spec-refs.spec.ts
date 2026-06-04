import { describe, expect, it } from "vitest";
import { proposalTraceSpecRefs } from "../lib/spec-refs";

describe("proposalTraceSpecRefs", () => {
  it("splits adjacent proposal trace spec refs from one source value", () => {
    expect(
      proposalTraceSpecRefs([
        "SG-SPEC-0030",
        "SG-SPEC-0123SG-SPEC-0150SG-SPEC-0200",
      ]),
    ).toEqual([
      "SG-SPEC-0030",
      "SG-SPEC-0123",
      "SG-SPEC-0150",
      "SG-SPEC-0200",
    ]);
  });

  it("keeps non-adjacent artifact ids intact", () => {
    expect(
      proposalTraceSpecRefs(["20260519T214802Z-SG-SPEC-0063-80e51a2c"]),
    ).toEqual(["20260519T214802Z-SG-SPEC-0063-80e51a2c"]);
  });
});
