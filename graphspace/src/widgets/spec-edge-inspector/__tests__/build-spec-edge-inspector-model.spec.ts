import { describe, expect, it } from "vitest";
import type { SpecEdge } from "@/entities/spec-edge";
import { buildSpecEdgeInspectorModel } from "../model/build-spec-edge-inspector-model";

const edge = (overrides: Partial<SpecEdge> = {}): SpecEdge => ({
  edge_id: "SG-SPEC-0002__refines__SG-SPEC-0001",
  edge_kind: "refines",
  source_id: "SG-SPEC-0002",
  target_id: "SG-SPEC-0001",
  status: "resolved",
  ...overrides,
});

describe("buildSpecEdgeInspectorModel", () => {
  it("resolves endpoint titles from graph nodes", () => {
    const model = buildSpecEdgeInspectorModel(
      edge(),
      new Map([
        ["SG-SPEC-0001", { title: "Root ontology" }],
        ["SG-SPEC-0002", { title: "Runtime contract" }],
      ]),
    );

    expect(model.relationLabel).toBe("Refines");
    expect(model.directionLabel).toBe("SG-SPEC-0002 -> SG-SPEC-0001");
    expect(model.source).toEqual({
      nodeId: "SG-SPEC-0002",
      title: "Runtime contract",
      missing: false,
    });
    expect(model.target).toEqual({
      nodeId: "SG-SPEC-0001",
      title: "Root ontology",
      missing: false,
    });
    expect(model.hasMissingEndpoint).toBe(false);
  });

  it("marks missing endpoints for broken edge diagnosis", () => {
    const model = buildSpecEdgeInspectorModel(
      edge({ status: "broken", target_id: "SG-SPEC-MISSING" }),
      new Map([["SG-SPEC-0002", { title: "Runtime contract" }]]),
    );

    expect(model.statusLabel).toBe("broken");
    expect(model.target).toEqual({
      nodeId: "SG-SPEC-MISSING",
      title: null,
      missing: true,
    });
    expect(model.hasMissingEndpoint).toBe(true);
  });
});
