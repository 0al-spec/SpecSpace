import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecNodeDetail } from "@/shared/spec-graph-contract";

export type SpecInspectorSelection = {
  specDir: string;
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

export type SpecTextItem = {
  text: string;
  malformed: boolean;
  hasEvidence?: boolean;
};

export type SpecScopeGroup = {
  in: readonly string[];
  out: readonly string[];
};

export type SpecTerminologyEntry = {
  term: string;
  definition: string;
};

export type SpecDecisionItem = {
  id: string | null;
  statement: string;
  rationale: string | null;
};

export type SpecEvidenceItem = {
  criterion: string;
  evidence: string | null;
};

export type SpecRuntimeField = {
  label: string;
  value: string;
};

export type SpecInspectorDetailModel = {
  raw: SpecNodeDetail;
  objective: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  scope: SpecScopeGroup | null;
  acceptance: readonly SpecTextItem[];
  evidence: readonly SpecEvidenceItem[];
  terminology: readonly SpecTerminologyEntry[];
  decisions: readonly SpecDecisionItem[];
  invariants: readonly SpecDecisionItem[];
  inputs: readonly string[];
  outputs: readonly string[];
  allowedPaths: readonly string[];
  prompt: string | null;
  runtime: readonly SpecRuntimeField[];
  rawSpecification: Record<string, unknown> | null;
};

export type SpecInspectorModel = {
  node: SpecNode;
  filePath: string;
  maturityLabel: string;
  relationGroups: readonly SpecRelationGroup[];
  detail: SpecInspectorDetailModel | null;
};
