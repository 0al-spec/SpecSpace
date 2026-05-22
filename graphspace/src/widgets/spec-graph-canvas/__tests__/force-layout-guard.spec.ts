import { describe, expect, it } from "vitest";
import {
  evaluateSpecGraphForceLayoutGuard,
  normalizeSpecGraphCanvasLayoutPreset,
  SPEC_GRAPH_CANVAS_LAYOUT_PRESETS,
  SPEC_GRAPH_FORCE_LAYOUT_EDGE_LIMIT,
  SPEC_GRAPH_FORCE_LAYOUT_NODE_LIMIT,
  SPEC_GRAPH_FORCE_LAYOUT_PRESET,
} from "../index";

describe("SpecGraph force layout guard", () => {
  it("keeps Force outside normal canvas layout presets", () => {
    expect(SPEC_GRAPH_FORCE_LAYOUT_PRESET).toBe("force");
    expect(SPEC_GRAPH_CANVAS_LAYOUT_PRESETS).not.toContain("force");
    expect(normalizeSpecGraphCanvasLayoutPreset("force")).toBeNull();
  });

  it("requires an explicit enable flag before Force can be used", () => {
    expect(
      evaluateSpecGraphForceLayoutGuard({
        nodeCount: SPEC_GRAPH_FORCE_LAYOUT_NODE_LIMIT,
        edgeCount: SPEC_GRAPH_FORCE_LAYOUT_EDGE_LIMIT,
        explicitEnabled: false,
      }),
    ).toMatchObject({
      available: false,
      reason: "explicit_enable_required",
    });
  });

  it("allows Force only while the graph stays inside the initial budget", () => {
    expect(
      evaluateSpecGraphForceLayoutGuard({
        nodeCount: SPEC_GRAPH_FORCE_LAYOUT_NODE_LIMIT,
        edgeCount: SPEC_GRAPH_FORCE_LAYOUT_EDGE_LIMIT,
        explicitEnabled: true,
      }),
    ).toMatchObject({
      available: true,
      preset: "force",
    });
  });

  it("blocks graphs above the node or edge budget", () => {
    expect(
      evaluateSpecGraphForceLayoutGuard({
        nodeCount: SPEC_GRAPH_FORCE_LAYOUT_NODE_LIMIT + 1,
        edgeCount: SPEC_GRAPH_FORCE_LAYOUT_EDGE_LIMIT,
        explicitEnabled: true,
      }),
    ).toMatchObject({
      available: false,
      reason: "node_limit_exceeded",
    });
    expect(
      evaluateSpecGraphForceLayoutGuard({
        nodeCount: SPEC_GRAPH_FORCE_LAYOUT_NODE_LIMIT,
        edgeCount: SPEC_GRAPH_FORCE_LAYOUT_EDGE_LIMIT + 1,
        explicitEnabled: true,
      }),
    ).toMatchObject({
      available: false,
      reason: "edge_limit_exceeded",
    });
  });
});
