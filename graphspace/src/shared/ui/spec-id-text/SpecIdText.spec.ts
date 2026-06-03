import { describe, expect, it } from "vitest";
import { splitSpecIdText, type SpecRefResolver } from "./SpecIdText";

describe("SpecIdText helpers", () => {
  const resolve: SpecRefResolver = (token) =>
    token === "CTXB-SPEC-0051" ||
    token === "CTXB-SPEC-0123" ||
    token === "CTXB-SPEC-0150" ||
    token === "CTXB-SPEC-0200" ||
    token === "SPEC-0054"
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

  it("splits adjacent spec refs inside a concatenated token", () => {
    expect(
      splitSpecIdText(
        "CTXB-SPEC-0123CTXB-SPEC-0150CTXB-SPEC-0200",
        resolve,
      ),
    ).toEqual([
      {
        kind: "spec-ref",
        value: "CTXB-SPEC-0123",
        nodeId: "resolved:CTXB-SPEC-0123",
      },
      {
        kind: "spec-ref",
        value: "CTXB-SPEC-0150",
        nodeId: "resolved:CTXB-SPEC-0150",
      },
      {
        kind: "spec-ref",
        value: "CTXB-SPEC-0200",
        nodeId: "resolved:CTXB-SPEC-0200",
      },
    ]);
  });

  it("keeps unresolved fragments as text while splitting adjacent resolved refs", () => {
    expect(
      splitSpecIdText("CTXB-SPEC-0123UNKNOWN-SPEC-9999CTXB-SPEC-0150", resolve),
    ).toEqual([
      {
        kind: "spec-ref",
        value: "CTXB-SPEC-0123",
        nodeId: "resolved:CTXB-SPEC-0123",
      },
      { kind: "text", value: "UNKNOWN-SPEC-9999" },
      {
        kind: "spec-ref",
        value: "CTXB-SPEC-0150",
        nodeId: "resolved:CTXB-SPEC-0150",
      },
    ]);
  });
});
