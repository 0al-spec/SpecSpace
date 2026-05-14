import { describe, expect, it } from "vitest";
import { createSpecNodeRefResolver } from "../lib/spec-ref-resolver";

describe("createSpecNodeRefResolver", () => {
  it("resolves exact graph node ids without assuming an SG prefix", () => {
    const resolve = createSpecNodeRefResolver([
      { node_id: "CTXB-SPEC-0007" },
    ]);

    expect(resolve("CTXB-SPEC-0007")).toBe("CTXB-SPEC-0007");
  });

  it("resolves SPEC aliases when exactly one graph node has that suffix", () => {
    const resolve = createSpecNodeRefResolver([
      { node_id: "CTXB-SPEC-0007" },
      { node_id: "CTXB-SPEC-0008" },
    ]);

    expect(resolve("SPEC-0007")).toBe("CTXB-SPEC-0007");
  });

  it("does not resolve ambiguous SPEC aliases", () => {
    const resolve = createSpecNodeRefResolver([
      { node_id: "SG-SPEC-0007" },
      { node_id: "CTXB-SPEC-0007" },
    ]);

    expect(resolve("SPEC-0007")).toBeNull();
  });

  it("does not synthesize an SG-prefixed id for unknown aliases", () => {
    const resolve = createSpecNodeRefResolver([
      { node_id: "CTXB-SPEC-0007" },
    ]);

    expect(resolve("SPEC-9999")).toBeNull();
  });
});
