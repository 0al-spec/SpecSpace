import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";

export type SpecInspectorSelection = {
  node: SpecNode;
  nodes: readonly SpecNode[];
  edges: readonly SpecEdge[];
};

export type SpecRelationStatus = "resolved" | "broken";

export type SpecRelation = {
  nodeId: string;
  title: string | null;
  status: SpecRelationStatus;
  edgeId: string | null;
};

export type SpecRelationGroup = {
  id: "depends_on" | "refines" | "refined_by" | "relates_to";
  label: string;
  items: readonly SpecRelation[];
};

export type SpecInspectorModel = {
  node: SpecNode;
  maturityLabel: string;
  relationGroups: readonly SpecRelationGroup[];
};
