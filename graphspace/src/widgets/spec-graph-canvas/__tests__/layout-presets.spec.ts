import { describe, expect, it } from "vitest";
import type { SpecNode } from "@/entities/spec-node";
import {
  DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
  computeSpecGraphCanvasLayoutPositions,
  normalizeSpecGraphCanvasLayoutPreset,
  readSpecGraphCanvasLayoutPreset,
  toSpecGraphFlowElements,
  writeSpecGraphCanvasLayoutPreset,
  SAMPLE_SPEC_GRAPH,
} from "../index";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const node = (node_id: string, status: string): SpecNode => ({
  node_id,
  file_name: `${node_id}.yaml`,
  title: node_id,
  kind: "spec",
  status,
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

describe("SpecGraph canvas layout presets", () => {
  it("keeps Refinement Ladder as the default flow layout", () => {
    const { nodes } = toSpecGraphFlowElements(SAMPLE_SPEC_GRAPH);
    const byId = new Map(nodes.map((item) => [item.id, item]));

    expect(byId.get("SG-SPEC-SAMPLE-EVIDENCE")?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(byId.get("SG-SPEC-SAMPLE-ROOT")?.position).toEqual({ x: 0, y: 172 });
    expect(byId.get("SG-SPEC-SAMPLE-RUNTIME")?.position).toEqual({
      x: 360,
      y: 0,
    });
  });

  it("can place specs into status columns", () => {
    const positions = computeSpecGraphCanvasLayoutPositions(
      [
        node("SG-SPEC-0003", "frozen"),
        node("SG-SPEC-0001", "linked"),
        node("SG-SPEC-0002", "reviewed"),
        node("SG-SPEC-0004", "future"),
      ],
      [],
      "status-columns",
    );

    expect(positions.get("SG-SPEC-0001")).toEqual({ x: 0, y: 0 });
    expect(positions.get("SG-SPEC-0002")).toEqual({ x: 360, y: 0 });
    expect(positions.get("SG-SPEC-0003")).toEqual({ x: 720, y: 0 });
    expect(positions.get("SG-SPEC-0004")).toEqual({ x: 2520, y: 0 });
  });

  it("normalizes and persists the selected layout preset", () => {
    const storage = new MemoryStorage();

    expect(normalizeSpecGraphCanvasLayoutPreset("status-columns")).toBe(
      "status-columns",
    );
    expect(normalizeSpecGraphCanvasLayoutPreset("unknown")).toBeNull();
    expect(readSpecGraphCanvasLayoutPreset(storage)).toBe(
      DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
    );

    writeSpecGraphCanvasLayoutPreset(storage, "status-columns");

    expect(readSpecGraphCanvasLayoutPreset(storage)).toBe("status-columns");
  });
});
