import { describe, expect, it } from "vitest";
import { splitSpecIdText, type SpecRefResolver } from "./SpecIdText";

describe("SpecIdText helpers", () => {
  const resolve: SpecRefResolver = (token) =>
    token === "CTXB-SPEC-0051" || token === "SPEC-0054"
      ? `resolved:${token}`
      : null;

  it("splits mixed text using the provided resolver", () => {
    expect(splitSpecIdText("Attach CTXB-SPEC-0051 trace contract", resolve)).toEqual([
      { kind: "text", value: "Attach " },
      {
        kind: "spec-ref",
        value: "CTXB-SPEC-0051",
        nodeId: "resolved:CTXB-SPEC-0051",
      },
      { kind: "text", value: " trace contract" },
    ]);
  });

  it("leaves unresolved hyphenated tokens as plain text", () => {
    expect(splitSpecIdText("Attach SG-SPEC-0051 trace contract", resolve)).toEqual([
      { kind: "text", value: "Attach SG-SPEC-0051 trace contract" },
    ]);
  });

  it("does not resolve anything without an explicit resolver", () => {
    expect(splitSpecIdText("see CTXB-SPEC-0051 next")).toEqual([
      { kind: "text", value: "see CTXB-SPEC-0051 next" },
    ]);
  });

  it("can render short aliases when the resolver accepts them", () => {
    expect(splitSpecIdText("see SPEC-0054 next", resolve)[1]).toEqual({
      kind: "spec-ref",
      value: "SPEC-0054",
      nodeId: "resolved:SPEC-0054",
    });
  });
});
