import type { SpecEdge } from "@/entities/spec-edge";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecNodeDetail } from "@/shared/spec-graph-contract";
import type {
  SpecDecisionItem,
  SpecEvidenceItem,
  SpecInspectorDetailModel,
  SpecInspectorModel,
  SpecInspectorSelection,
  SpecRelation,
  SpecRelationGroup,
  SpecRuntimeField,
  SpecScopeGroup,
  SpecTerminologyEntry,
  SpecTextItem,
} from "./types";

const byNodeId = (a: SpecRelation, b: SpecRelation) =>
  a.nodeId.localeCompare(b.nodeId);

function relationFromId(
  nodeId: string,
  nodesById: ReadonlyMap<string, SpecNode>,
  edge: SpecEdge | null,
): SpecRelation {
  const node = nodesById.get(nodeId);
  return {
    nodeId,
    title: node?.title ?? null,
    status: node && edge?.status !== "broken" ? "resolved" : "broken",
    edgeId: edge?.edge_id ?? null,
  };
}

function findEdge(
  edges: readonly SpecEdge[],
  edgeKind: SpecEdge["edge_kind"],
  sourceId: string,
  targetId: string,
): SpecEdge | null {
  return edges.find(
    (edge) =>
      edge.edge_kind === edgeKind &&
      edge.source_id === sourceId &&
      edge.target_id === targetId,
  ) ?? null;
}

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function joinSpecPath(specDir: string, fileName: string): string {
  if (!specDir) return fileName;
  if (!fileName) return specDir;
  if (fileName.startsWith("/")) return fileName;
  return `${specDir.replace(/\/$/, "")}/${fileName}`;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null => {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];

const stringifyUnknown = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const textItem = (value: unknown): SpecTextItem => ({
  text: stringifyUnknown(value),
  malformed: typeof value !== "string",
});

function buildScope(detail: SpecNodeDetail): SpecScopeGroup | null {
  const spec = asRecord(detail.specification);
  const rawScope = asRecord(detail.scope) ?? asRecord(spec?.scope);
  if (!rawScope) return null;

  const scope = {
    in: stringArray(rawScope.in),
    out: stringArray(rawScope.out),
  };

  return scope.in.length > 0 || scope.out.length > 0 ? scope : null;
}

function buildTerminology(detail: SpecNodeDetail): SpecTerminologyEntry[] {
  const spec = asRecord(detail.specification);
  const terminology = asRecord(spec?.terminology);
  if (!terminology) return [];

  return Object.entries(terminology)
    .map(([term, definition]) => ({
      term,
      definition: stringifyUnknown(definition),
    }))
    .filter((entry) => entry.definition.length > 0);
}

function decisionFromUnknown(item: unknown): SpecDecisionItem {
  if (typeof item === "string") {
    return { id: null, statement: item, rationale: null };
  }

  const record = asRecord(item);
  if (!record) {
    return { id: null, statement: stringifyUnknown(item), rationale: null };
  }

  return {
    id: asString(record.id),
    statement:
      asString(record.statement) ??
      asString(record.decision) ??
      asString(record.title) ??
      asString(record.description) ??
      stringifyUnknown(record),
    rationale: asString(record.rationale),
  };
}

function buildEvidence(detail: SpecNodeDetail): SpecEvidenceItem[] {
  return (detail.acceptance_evidence ?? []).map((item) => ({
    criterion: asString(item.criterion) ?? stringifyUnknown(item.criterion),
    evidence: asString(item.evidence),
  }));
}

function buildRuntime(detail: SpecNodeDetail): SpecRuntimeField[] {
  return [
    ["Last outcome", detail.last_outcome],
    ["Last blocker", detail.last_blocker],
    ["Last run", detail.last_run_at],
    ["Gate state", detail.gate_state],
    ["Proposed status", detail.proposed_status],
    ["Required action", detail.required_human_action],
  ].flatMap(([label, value]) => {
    const text = asString(value);
    return text ? [{ label: String(label), value: text }] : [];
  });
}

function buildDetailModel(detail: SpecNodeDetail | null): SpecInspectorDetailModel | null {
  if (!detail) return null;

  const spec = asRecord(detail.specification);
  const evidence = buildEvidence(detail);
  const criteriaWithEvidence = new Set(
    evidence
      .filter((item) => item.evidence)
      .map((item) => item.criterion.trim())
      .filter(Boolean),
  );
  const acceptance = (detail.acceptance ?? []).map((item) => {
    const model = textItem(item);
    return {
      ...model,
      hasEvidence: criteriaWithEvidence.has(model.text.trim()),
    };
  });

  return {
    raw: detail,
    objective: asString(spec?.objective) ?? asString(detail.objective),
    createdAt: asString(detail.created_at),
    updatedAt: asString(detail.updated_at),
    scope: buildScope(detail),
    acceptance,
    evidence,
    terminology: buildTerminology(detail),
    decisions: Array.isArray(spec?.decisions)
      ? spec.decisions.map(decisionFromUnknown)
      : [],
    invariants: Array.isArray(spec?.invariants)
      ? spec.invariants.map(decisionFromUnknown)
      : [],
    inputs: stringArray(detail.inputs),
    outputs: stringArray(detail.outputs),
    allowedPaths: stringArray(detail.allowed_paths),
    prompt: asString(detail.prompt),
    runtime: buildRuntime(detail),
    rawSpecification: spec,
  };
}

export function buildSpecInspectorModel(
  selection: SpecInspectorSelection,
  detail: SpecNodeDetail | null = null,
): SpecInspectorModel {
  const { specDir, node, nodes, edges } = selection;
  const nodesById = new Map(nodes.map((candidate) => [candidate.node_id, candidate]));

  const dependsOn = uniqueSorted(node.depends_on).map((targetId) =>
    relationFromId(
      targetId,
      nodesById,
      findEdge(edges, "depends_on", node.node_id, targetId),
    ),
  );
  const refines = uniqueSorted(node.refines).map((targetId) =>
    relationFromId(
      targetId,
      nodesById,
      findEdge(edges, "refines", node.node_id, targetId),
    ),
  );
  const refinedBy = edges
    .filter((edge) => edge.edge_kind === "refines" && edge.target_id === node.node_id)
    .map((edge) => relationFromId(edge.source_id, nodesById, edge))
    .sort(byNodeId);
  const relatedIds = uniqueSorted([
    ...node.relates_to,
    ...edges
      .filter((edge) => edge.edge_kind === "relates_to" && edge.target_id === node.node_id)
      .map((edge) => edge.source_id),
  ]);
  const related = relatedIds.map((targetId) =>
    relationFromId(
      targetId,
      nodesById,
      findEdge(edges, "relates_to", node.node_id, targetId) ??
        findEdge(edges, "relates_to", targetId, node.node_id),
    ),
  );

  const relationGroups: SpecRelationGroup[] = [
    { id: "depends_on", label: "Depends on", items: dependsOn },
    { id: "refines", label: "Refines", items: refines },
    { id: "refined_by", label: "Refined by", items: refinedBy },
    { id: "relates_to", label: "Related", items: related },
  ];

  return {
    node,
    filePath: joinSpecPath(specDir, node.file_name),
    maturityLabel:
      typeof node.maturity === "number" ? `${Math.round(node.maturity * 100)}%` : "n/a",
    relationGroups,
    detail: buildDetailModel(detail),
  };
}
