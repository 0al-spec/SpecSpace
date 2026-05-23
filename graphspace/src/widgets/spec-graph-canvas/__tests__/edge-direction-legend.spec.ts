import { describe, expect, it } from "vitest";
import {
  buildSpecGraphCanvasEdgeDirectionLegend,
  usesSpecGraphCanvasHierarchyProjection,
} from "../model/edge-direction-legend";

describe("SpecGraph canvas edge direction legend", () => {
  it("documents hierarchy-projected refines direction outside Canonical layout", () => {
    const legend = buildSpecGraphCanvasEdgeDirectionLegend("spine");
    const refines = legend.find((item) => item.edgeKind === "refines");

    expect(usesSpecGraphCanvasHierarchyProjection("spine")).toBe(true);
    expect(refines).toMatchObject({
      label: "Refines",
      displayDirection: "parent -> child",
      semanticDirection: "child -> parent",
      tone: "refines",
    });
  });

  it("keeps Canonical refines direction aligned with the raw graph contract", () => {
    const legend = buildSpecGraphCanvasEdgeDirectionLegend("canonical");
    const refines = legend.find((item) => item.edgeKind === "refines");

    expect(usesSpecGraphCanvasHierarchyProjection("canonical")).toBe(false);
    expect(refines).toMatchObject({
      displayDirection: "child -> parent",
      semanticDirection: "child -> parent",
    });
  });

  it("documents dependency and relation direction independently of layout", () => {
    const legend = buildSpecGraphCanvasEdgeDirectionLegend("tree");

    expect(legend.find((item) => item.edgeKind === "depends_on")).toMatchObject(
      {
        label: "Depends",
        displayDirection: "source -> target",
        semanticDirection: "source -> target",
        tone: "depends",
      },
    );
    expect(legend.find((item) => item.edgeKind === "relates_to")).toMatchObject(
      {
        label: "Relates",
        displayDirection: "no arrow",
        semanticDirection: "association",
        tone: "relates",
      },
    );
  });
});
