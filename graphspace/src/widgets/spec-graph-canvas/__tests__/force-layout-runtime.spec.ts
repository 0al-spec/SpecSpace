import { describe, expect, it } from "vitest";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import {
  buildSpecGraphForceLayoutRuntimeModel,
  computeSpecGraphForceLayoutPositions,
} from "../index";

const node = (node_id: string): SpecNode => ({
  node_id,
  file_name: `${node_id}.yaml`,
  title: node_id,
  kind: "spec",
  status: "linked",
  maturity: 1,
  acceptance_count: 0,
  decisions_count: 0,
  evidence_gap: 0,
  input_gap: 0,
  execution_gap: 0,
  gap_count: 0,
  depends_on: [],
  refines: [],
  relates_to: [],
  diagnostics: [],
});

const edge = (
  edge_id: string,
  source_id: string,
  target_id: string,
): SpecEdge => ({
  edge_id,
  edge_kind: "depends_on",
  source_id,
  target_id,
  status: "resolved",
});

describe("SpecGraph force layout runtime", () => {
  it("does not become active without explicit operator enablement", () => {
    const model = buildSpecGraphForceLayoutRuntimeModel({
      nodeCount: 2,
      edgeCount: 1,
      explicitEnabled: false,
    });

    expect(model.active).toBe(false);
    expect(model.guard).toMatchObject({
      available: false,
      reason: "explicit_enable_required",
    });
    expect(model.message).toContain("Force guarded");
  });

  it("builds deterministic positions for an in-budget graph", () => {
    const nodes = [node("SG-SPEC-0002"), node("SG-SPEC-0001"), node("SG-SPEC-0003")];
    const edges = [
      edge("e-2", "SG-SPEC-0002", "SG-SPEC-0003"),
      edge("e-1", "SG-SPEC-0001", "SG-SPEC-0002"),
    ];

    const first = computeSpecGraphForceLayoutPositions(nodes, edges);
    const second = computeSpecGraphForceLayoutPositions([...nodes].reverse(), [...edges].reverse());

    expect([...first.entries()]).toEqual([...second.entries()]);
    expect([...first.keys()]).toEqual([
      "SG-SPEC-0001",
      "SG-SPEC-0002",
      "SG-SPEC-0003",
    ]);
    for (const position of first.values()) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeGreaterThanOrEqual(0);
    }
  });
});
