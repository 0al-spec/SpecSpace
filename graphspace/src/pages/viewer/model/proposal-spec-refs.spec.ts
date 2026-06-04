import { describe, expect, it } from "vitest";
import { proposalViewerSpecRefs } from "./proposal-spec-refs";

describe("proposalViewerSpecRefs", () => {
  it("splits adjacent numeric spec refs from one affected spec value", () => {
    expect(
      proposalViewerSpecRefs([
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
      proposalViewerSpecRefs(["20260519T214802Z-SG-SPEC-0063-80e51a2c"]),
    ).toEqual(["20260519T214802Z-SG-SPEC-0063-80e51a2c"]);
  });
});
