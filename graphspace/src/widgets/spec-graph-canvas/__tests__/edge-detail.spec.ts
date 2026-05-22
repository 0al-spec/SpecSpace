import { describe, expect, it } from "vitest";
import type { SpecEdge } from "@/entities/spec-edge";
import {
  DEFAULT_SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODE,
  isSpecGraphCanvasEdgeVisible,
  normalizeSpecGraphCanvasEdgeDetailMode,
  readSpecGraphCanvasEdgeDetailMode,
  resolveSpecGraphCanvasEdgeDetailMode,
  writeSpecGraphCanvasEdgeDetailMode,
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

const edge = (
  edge_id: string,
  edge_kind: SpecEdge["edge_kind"],
  source_id = "SG-SPEC-0001",
  target_id = "SG-SPEC-0002",
  status: SpecEdge["status"] = "resolved",
): SpecEdge => ({
  edge_id,
  edge_kind,
  source_id,
  target_id,
  status,
});

describe("SpecGraph canvas edge detail", () => {
  it("normalizes and persists the selected edge detail mode", () => {
    const storage = new MemoryStorage();

    expect(normalizeSpecGraphCanvasEdgeDetailMode("auto")).toBe("auto");
    expect(normalizeSpecGraphCanvasEdgeDetailMode("structural")).toBe(
      "structural",
    );
    expect(normalizeSpecGraphCanvasEdgeDetailMode("dense")).toBeNull();
    expect(readSpecGraphCanvasEdgeDetailMode(storage)).toBe(
      DEFAULT_SPEC_GRAPH_CANVAS_EDGE_DETAIL_MODE,
    );

    writeSpecGraphCanvasEdgeDetailMode(storage, "full");

    expect(readSpecGraphCanvasEdgeDetailMode(storage)).toBe("full");
  });

  it("resolves Auto detail from zoom to avoid dense far-zoom edges", () => {
    expect(resolveSpecGraphCanvasEdgeDetailMode("auto", 0.2)).toBe("hierarchy");
    expect(resolveSpecGraphCanvasEdgeDetailMode("auto", 0.5)).toBe(
      "structural",
    );
    expect(resolveSpecGraphCanvasEdgeDetailMode("auto", 1)).toBe("full");
    expect(resolveSpecGraphCanvasEdgeDetailMode("structural", 0.1)).toBe(
      "structural",
    );
  });

  it("filters edge density by effective mode while preserving diagnostics", () => {
    expect(
      isSpecGraphCanvasEdgeVisible(edge("refines", "refines"), "hierarchy"),
    ).toBe(true);
    expect(
      isSpecGraphCanvasEdgeVisible(edge("depends", "depends_on"), "hierarchy"),
    ).toBe(false);
    expect(
      isSpecGraphCanvasEdgeVisible(edge("relates", "relates_to"), "structural"),
    ).toBe(false);
    expect(
      isSpecGraphCanvasEdgeVisible(edge("depends", "depends_on"), "structural"),
    ).toBe(true);
    expect(
      isSpecGraphCanvasEdgeVisible(edge("relates", "relates_to"), "full"),
    ).toBe(true);
    expect(
      isSpecGraphCanvasEdgeVisible(
        edge("broken-relates", "relates_to", "SG-SPEC-0001", "SG-SPEC-0002", "broken"),
        "hierarchy",
      ),
    ).toBe(true);
  });

  it("keeps selected and node-adjacent edges visible in sparse modes", () => {
    expect(
      isSpecGraphCanvasEdgeVisible(edge("depends", "depends_on"), "hierarchy", {
        selectedEdgeId: "depends",
      }),
    ).toBe(true);
    expect(
      isSpecGraphCanvasEdgeVisible(edge("relates", "relates_to"), "hierarchy", {
        selectedNodeId: "SG-SPEC-0002",
      }),
    ).toBe(true);
  });
});
