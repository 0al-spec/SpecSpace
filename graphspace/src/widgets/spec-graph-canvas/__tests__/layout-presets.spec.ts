import { describe, expect, it } from "vitest";
import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecGraphResponse } from "@/shared/spec-graph-contract";
import {
  DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
  SPEC_GRAPH_CANVAS_LAYOUT_PRESETS,
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

const edge = (
  edge_id: string,
  edge_kind: SpecEdge["edge_kind"],
  source_id: string,
  target_id: string,
): SpecEdge => ({
  edge_id,
  edge_kind,
  source_id,
  target_id,
  status: "resolved",
});

const responseWith = (
  nodes: SpecNode[],
  edges: SpecEdge[],
): SpecGraphResponse => ({
  spec_dir: "/specs",
  graph: {
    nodes,
    edges,
    roots: [],
    blocked_files: [],
    diagnostics: [],
    summary: {
      node_count: nodes.length,
      edge_count: edges.length,
      root_count: 0,
      blocked_file_count: 0,
      diagnostic_count: 0,
      broken_edge_count: 0,
    },
  },
  summary: {
    node_count: nodes.length,
    edge_count: edges.length,
    root_count: 0,
    blocked_file_count: 0,
    diagnostic_count: 0,
    broken_edge_count: 0,
  },
});

describe("SpecGraph canvas layout presets", () => {
  it("keeps Tree as the default Refinement Ladder flow layout", () => {
    const { nodes } = toSpecGraphFlowElements(SAMPLE_SPEC_GRAPH);
    const byId = new Map(nodes.map((item) => [item.id, item]));

    expect(DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET).toBe("tree");
    expect(SPEC_GRAPH_CANVAS_LAYOUT_PRESETS).toEqual([
      "tree",
      "linear",
      "spine",
      "canonical",
      "status-columns",
    ]);
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

  it("places every forward edge rightward in Linear layout", () => {
    const positions = computeSpecGraphCanvasLayoutPositions(
      [
        node("SG-SPEC-0001", "linked"),
        node("SG-SPEC-0002", "linked"),
        node("SG-SPEC-0003", "linked"),
      ],
      [
        edge("refines-2-1", "refines", "SG-SPEC-0002", "SG-SPEC-0001"),
        edge("depends-2-3", "depends_on", "SG-SPEC-0002", "SG-SPEC-0003"),
      ],
      "linear",
    );

    expect(positions.get("SG-SPEC-0001")).toEqual({ x: 0, y: 0 });
    expect(positions.get("SG-SPEC-0002")).toEqual({ x: 360, y: 0 });
    expect(positions.get("SG-SPEC-0003")).toEqual({ x: 720, y: 172 });
  });

  it("keeps raw SpecGraph edge direction in Canonical layout", () => {
    const nodes = [
      node("SG-SPEC-0001", "linked"),
      node("SG-SPEC-0002", "linked"),
    ];
    const edges = [
      edge("refines-2-1", "refines", "SG-SPEC-0002", "SG-SPEC-0001"),
    ];
    const treePositions = computeSpecGraphCanvasLayoutPositions(
      nodes,
      edges,
      "tree",
    );
    const canonicalPositions = computeSpecGraphCanvasLayoutPositions(
      nodes,
      edges,
      "canonical",
    );
    const treeFlow = toSpecGraphFlowElements(responseWith(nodes, edges), "tree");
    const canonicalFlow = toSpecGraphFlowElements(
      responseWith(nodes, edges),
      "canonical",
    );

    expect(treePositions.get("SG-SPEC-0001")).toEqual({ x: 0, y: 0 });
    expect(treePositions.get("SG-SPEC-0002")).toEqual({ x: 360, y: 0 });
    expect(canonicalPositions.get("SG-SPEC-0002")).toEqual({ x: 0, y: 0 });
    expect(canonicalPositions.get("SG-SPEC-0001")).toEqual({ x: 360, y: 0 });
    expect(treeFlow.edges[0]).toMatchObject({
      source: "SG-SPEC-0001",
      target: "SG-SPEC-0002",
    });
    expect(canonicalFlow.edges[0]).toMatchObject({
      source: "SG-SPEC-0002",
      target: "SG-SPEC-0001",
    });
  });

  it("centers Spine child groups around their parent by hierarchy depth", () => {
    const positions = computeSpecGraphCanvasLayoutPositions(
      [
        node("SG-SPEC-0001", "linked"),
        node("SG-SPEC-0002", "linked"),
        node("SG-SPEC-0003", "linked"),
        node("SG-SPEC-0004", "linked"),
      ],
      [
        edge("refines-2-1", "refines", "SG-SPEC-0002", "SG-SPEC-0001"),
        edge("refines-3-1", "refines", "SG-SPEC-0003", "SG-SPEC-0001"),
        edge("refines-4-1", "refines", "SG-SPEC-0004", "SG-SPEC-0001"),
      ],
      "spine",
    );

    expect(positions.get("SG-SPEC-0001")).toEqual({ x: 0, y: 172 });
    expect(positions.get("SG-SPEC-0002")).toEqual({ x: 360, y: 0 });
    expect(positions.get("SG-SPEC-0003")).toEqual({ x: 360, y: 172 });
    expect(positions.get("SG-SPEC-0004")).toEqual({ x: 360, y: 344 });
  });

  it("uses subtree spans in Spine so nested groups stay compact", () => {
    const positions = computeSpecGraphCanvasLayoutPositions(
      [
        node("SG-SPEC-0001", "linked"),
        node("SG-SPEC-0002", "linked"),
        node("SG-SPEC-0003", "linked"),
        node("SG-SPEC-0004", "linked"),
        node("SG-SPEC-0005", "linked"),
      ],
      [
        edge("refines-2-1", "refines", "SG-SPEC-0002", "SG-SPEC-0001"),
        edge("refines-3-1", "refines", "SG-SPEC-0003", "SG-SPEC-0001"),
        edge("refines-4-2", "refines", "SG-SPEC-0004", "SG-SPEC-0002"),
        edge("refines-5-2", "refines", "SG-SPEC-0005", "SG-SPEC-0002"),
      ],
      "spine",
    );

    expect(positions.get("SG-SPEC-0001")).toEqual({ x: 0, y: 172 });
    expect(positions.get("SG-SPEC-0002")).toEqual({ x: 360, y: 86 });
    expect(positions.get("SG-SPEC-0003")).toEqual({ x: 360, y: 344 });
    expect(positions.get("SG-SPEC-0004")).toEqual({ x: 720, y: 0 });
    expect(positions.get("SG-SPEC-0005")).toEqual({ x: 720, y: 172 });
  });

  it("keeps secondary links out of Spine depth placement", () => {
    const positions = computeSpecGraphCanvasLayoutPositions(
      [
        node("SG-SPEC-0001", "linked"),
        node("SG-SPEC-0002", "linked"),
        node("SG-SPEC-0003", "linked"),
      ],
      [
        edge("refines-2-1", "refines", "SG-SPEC-0002", "SG-SPEC-0001"),
        edge("depends-1-3", "depends_on", "SG-SPEC-0001", "SG-SPEC-0003"),
      ],
      "spine",
    );

    expect(positions.get("SG-SPEC-0001")?.x).toBe(0);
    expect(positions.get("SG-SPEC-0002")?.x).toBe(360);
    expect(positions.get("SG-SPEC-0003")?.x).toBe(0);
  });

  it("can place specs into status columns", () => {
    const positions = computeSpecGraphCanvasLayoutPositions(
      [
        node("SG-SPEC-0007", "frozen"),
        node("SG-SPEC-0005", "linked"),
        node("SG-SPEC-0006", "reviewed"),
        node("SG-SPEC-0001", "idea"),
        node("SG-SPEC-0002", "stub"),
        node("SG-SPEC-0003", "outlined"),
        node("SG-SPEC-0004", "specified"),
        node("SG-SPEC-0008", "future"),
      ],
      [],
      "status-columns",
    );

    expect(positions.get("SG-SPEC-0001")).toEqual({ x: 0, y: 0 });
    expect(positions.get("SG-SPEC-0002")).toEqual({ x: 360, y: 0 });
    expect(positions.get("SG-SPEC-0003")).toEqual({ x: 720, y: 0 });
    expect(positions.get("SG-SPEC-0004")).toEqual({ x: 1080, y: 0 });
    expect(positions.get("SG-SPEC-0005")).toEqual({ x: 1440, y: 0 });
    expect(positions.get("SG-SPEC-0006")).toEqual({ x: 1800, y: 0 });
    expect(positions.get("SG-SPEC-0007")).toEqual({ x: 2160, y: 0 });
    expect(positions.get("SG-SPEC-0008")).toEqual({ x: 3960, y: 0 });
  });

  it("normalizes and persists the selected layout preset", () => {
    const storage = new MemoryStorage();

    expect(normalizeSpecGraphCanvasLayoutPreset("status-columns")).toBe(
      "status-columns",
    );
    expect(normalizeSpecGraphCanvasLayoutPreset("spine")).toBe("spine");
    expect(normalizeSpecGraphCanvasLayoutPreset("refinement-ladder")).toBe(
      "tree",
    );
    expect(normalizeSpecGraphCanvasLayoutPreset("__proto__")).toBeNull();
    expect(normalizeSpecGraphCanvasLayoutPreset("constructor")).toBeNull();
    expect(normalizeSpecGraphCanvasLayoutPreset("unknown")).toBeNull();
    expect(readSpecGraphCanvasLayoutPreset(storage)).toBe(
      DEFAULT_SPEC_GRAPH_CANVAS_LAYOUT_PRESET,
    );

    writeSpecGraphCanvasLayoutPreset(storage, "status-columns");

    expect(readSpecGraphCanvasLayoutPreset(storage)).toBe("status-columns");
  });
});
