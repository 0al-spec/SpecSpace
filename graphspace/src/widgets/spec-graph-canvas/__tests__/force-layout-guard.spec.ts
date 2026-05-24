import { describe, expect, it } from "vitest";
import {
  evaluateSpecGraphForceLayoutGuard,
  normalizeSpecGraphCanvasLayoutPreset,
  SPEC_GRAPH_CANVAS_LAYOUT_PRESETS,
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
        nodeCount: 500,
        edgeCount: 1200,
        explicitEnabled: false,
      }),
    ).toMatchObject({
      available: false,
      reason: "explicit_enable_required",
    });
  });

  it("does not impose a hard default node or edge budget", () => {
    expect(
      evaluateSpecGraphForceLayoutGuard({
        nodeCount: 500,
        edgeCount: 1200,
        explicitEnabled: true,
      }),
    ).toMatchObject({
      available: true,
      preset: "force",
    });
  });

  it("still supports explicit diagnostic budgets for constrained environments", () => {
    expect(
      evaluateSpecGraphForceLayoutGuard({
        nodeCount: 4,
        edgeCount: 3,
        explicitEnabled: true,
        nodeLimit: 3,
      }),
    ).toMatchObject({
      available: false,
      reason: "node_limit_exceeded",
    });
    expect(
      evaluateSpecGraphForceLayoutGuard({
        nodeCount: 3,
        edgeCount: 4,
        explicitEnabled: true,
        edgeLimit: 3,
      }),
    ).toMatchObject({
      available: false,
      reason: "edge_limit_exceeded",
    });
  });
});
