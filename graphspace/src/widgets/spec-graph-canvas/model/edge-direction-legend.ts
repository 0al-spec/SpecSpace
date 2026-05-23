import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecGraphCanvasLayoutPreset } from "./layout-presets";

export type SpecGraphCanvasEdgeDirectionLegendItem = {
  edgeKind: SpecEdge["edge_kind"];
  label: string;
  displayDirection: string;
  semanticDirection: string;
  tone: "depends" | "refines" | "relates";
  title: string;
};

const REFINES_SEMANTIC_DIRECTION = "child -> parent";

export function usesSpecGraphCanvasHierarchyProjection(
  layoutPreset: SpecGraphCanvasLayoutPreset,
): boolean {
  return layoutPreset !== "canonical";
}

export function buildSpecGraphCanvasEdgeDirectionLegend(
  layoutPreset: SpecGraphCanvasLayoutPreset,
): SpecGraphCanvasEdgeDirectionLegendItem[] {
  const refinesProjected = usesSpecGraphCanvasHierarchyProjection(layoutPreset);
  const refinesDisplayDirection = refinesProjected
    ? "parent -> child"
    : REFINES_SEMANTIC_DIRECTION;

  return [
    {
      edgeKind: "refines",
      label: "Refines",
      displayDirection: refinesDisplayDirection,
      semanticDirection: REFINES_SEMANTIC_DIRECTION,
      tone: "refines",
      title: refinesProjected
        ? "Hierarchy projection: raw refines is child -> parent, canvas draws parent -> child."
        : "Canonical direction: raw refines is child -> parent.",
    },
    {
      edgeKind: "depends_on",
      label: "Depends",
      displayDirection: "source -> target",
      semanticDirection: "source -> target",
      tone: "depends",
      title: "Dependency direction follows the source -> target graph edge.",
    },
    {
      edgeKind: "relates_to",
      label: "Relates",
      displayDirection: "no arrow",
      semanticDirection: "association",
      tone: "relates",
      title: "Relation edges are associative overlays and intentionally have no arrow.",
    },
  ];
}
