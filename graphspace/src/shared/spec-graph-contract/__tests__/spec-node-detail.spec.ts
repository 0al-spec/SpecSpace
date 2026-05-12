import { describe, expect, it } from "vitest";
import { parseSpecNodeDetail } from "../parsers/parse-spec-node-detail";

describe("parseSpecNodeDetail", () => {
  it("parses the focused /api/spec-node response shape", () => {
    const result = parseSpecNodeDetail({
      node_id: "SG-SPEC-0001",
      data: {
        id: "SG-SPEC-0001",
        title: "Root ontology",
        kind: "spec",
        status: "linked",
        maturity: 1,
        acceptance: ["Defines the contract"],
        acceptance_evidence: [
          {
            criterion: "Defines the contract",
            evidence: "Specification contains the contract.",
          },
        ],
        specification: {
          objective: "Define the graph contract.",
          scope: { in: ["Nodes"], out: ["Runtime"] },
          terminology: { node: "A governed record." },
          decisions: [{ id: "D1", statement: "Keep YAML canonical." }],
        },
        future_field: { kept: true },
      },
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.data.specification?.objective).toBe(
      "Define the graph contract.",
    );
    expect((result.data.data as Record<string, unknown>).future_field).toEqual({
      kept: true,
    });
  });

  it("rejects responses whose wrapper id disagrees with the raw YAML id", () => {
    const result = parseSpecNodeDetail({
      node_id: "SG-SPEC-0001",
      data: { id: "SG-SPEC-0002" },
    });

    expect(result.kind).toBe("invariant-violation");
  });

  it("returns parse-error for missing raw node data", () => {
    expect(parseSpecNodeDetail({ node_id: "SG-SPEC-0001" }).kind).toBe(
      "parse-error",
    );
  });
});
