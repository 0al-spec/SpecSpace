import { describe, expect, it } from "vitest";
import { normalizeSpecId, splitSpecIdText } from "./SpecIdText";

describe("SpecIdText helpers", () => {
  it("normalizes short SPEC ids to canonical graph node ids", () => {
    expect(normalizeSpecId("SPEC-0054")).toBe("SG-SPEC-0054");
    expect(normalizeSpecId("SG-SPEC-0054")).toBe("SG-SPEC-0054");
  });

  it("splits mixed text into text and spec-id parts", () => {
    expect(splitSpecIdText("Attach SG-SPEC-0051 trace contract")).toEqual([
      { kind: "text", value: "Attach " },
      { kind: "spec-id", value: "SG-SPEC-0051", nodeId: "SG-SPEC-0051" },
      { kind: "text", value: " trace contract" },
    ]);
  });

  it("supports short SPEC ids inside prose", () => {
    expect(splitSpecIdText("see SPEC-0054 next")[1]).toEqual({
      kind: "spec-id",
      value: "SPEC-0054",
      nodeId: "SG-SPEC-0054",
    });
  });
});
