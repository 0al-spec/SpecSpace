import { z } from "zod";
import {
  ONTOLOGY_GRAPH_PROJECTION_ARTIFACT_KIND,
  ONTOLOGY_GRAPH_PROJECTION_SCHEMA_VERSION,
  type OntologyGraphDiagnostic,
  type OntologyGraphEdge,
  type OntologyGraphNode,
  type OntologyGraphProjection,
  type OntologyGraphSourceFile,
} from "../schemas/ontology-graph-projection";

const normalizedClassSchema = z
  .object({
    id: z.string().min(1),
    fqid: z.string().min(1).optional(),
    kind: z.string().min(1).optional(),
    description: z.string().optional(),
    uri: z.string().optional(),
    central: z.boolean().optional(),
    extends: z.string().min(1).optional(),
    implements: z.array(z.string().min(1)).optional(),
  })
  .passthrough();

const normalizedRelationSchema = z
  .object({
    id: z.string().min(1),
    fqid: z.string().min(1).optional(),
    domain: z.string().min(1),
    range: z.union([
      z.string().min(1),
      z
        .object({
          oneOf: z.array(z.string().min(1)).min(1),
        })
        .passthrough(),
    ]),
    description: z.string().optional(),
    uri: z.string().optional(),
    cardinality: z
      .object({
        min: z.number().optional(),
        max: z.union([z.number(), z.string()]).optional(),
      })
      .optional(),
  })
  .passthrough();

const normalizedIrSchema = z
  .object({
    id: z.string().min(1).optional(),
    namespace: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    classes: z.array(normalizedClassSchema),
    relations: z.array(normalizedRelationSchema).optional(),
    imports: z.unknown().optional(),
    policies: z.unknown().optional(),
    protocols: z.unknown().optional(),
    stateMachines: z.unknown().optional(),
    compatibility: z.unknown().optional(),
  })
  .passthrough();

type NormalizedClass = z.infer<typeof normalizedClassSchema>;
type NormalizedRelation = z.infer<typeof normalizedRelationSchema>;
type NormalizedIr = z.infer<typeof normalizedIrSchema>;

export type ProjectOntologyNormalizedIrOptions = {
  sourceFiles?: readonly OntologyGraphSourceFile[];
};

export type OntologyGraphProjectionResult =
  | { kind: "ok"; data: OntologyGraphProjection }
  | { kind: "parse-error"; issues: z.ZodIssue[]; raw: unknown };

function text(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

function classRef(item: NormalizedClass, namespace: string): string {
  return text(item.fqid, `${namespace}:${item.id}`);
}

function relationRef(item: NormalizedRelation, namespace: string): string {
  return text(item.fqid, `${namespace}:${item.id}`);
}

function relationLabel(item: NormalizedRelation): string {
  return item.id;
}

function relationRanges(item: NormalizedRelation): readonly string[] {
  return typeof item.range === "string" ? [item.range] : item.range.oneOf;
}

function makeNode(item: NormalizedClass, namespace: string): OntologyGraphNode {
  return {
    id: classRef(item, namespace),
    label: item.id,
    fqid: classRef(item, namespace),
    kind: text(item.kind, "unknown"),
    description: item.description ?? null,
    uri: item.uri ?? null,
    central: item.central === true,
    extends: item.extends ?? null,
    implements: item.implements ?? [],
  };
}

function duplicateDiagnostics(
  values: readonly string[],
  code: "duplicate_class_id" | "duplicate_relation_id",
): OntologyGraphDiagnostic[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort().map((ref) => ({
    severity: "error",
    code,
    message: `${ref} appears more than once in the normalized ontology IR.`,
    ref,
  }));
}

function uniqueBy<T>(
  values: readonly T[],
  key: (value: T) => string,
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(value);
  }
  return unique;
}

function buildNodeIndex(nodes: readonly OntologyGraphNode[]): Map<string, OntologyGraphNode> {
  const index = new Map<string, OntologyGraphNode>();
  for (const node of nodes) {
    index.set(node.id, node);
    index.set(node.label, node);
    index.set(node.fqid, node);
  }
  return index;
}

function relationEdges(
  relations: readonly NormalizedRelation[],
  nodeIndex: ReadonlyMap<string, OntologyGraphNode>,
  namespace: string,
  diagnostics: OntologyGraphDiagnostic[],
): OntologyGraphEdge[] {
  const edges: OntologyGraphEdge[] = [];
  for (const relation of relations) {
    const source = nodeIndex.get(relation.domain);
    const relationId = relationRef(relation, namespace);
    for (const range of relationRanges(relation)) {
      const target = nodeIndex.get(range);
      if (!source || !target) {
        diagnostics.push({
          severity: "error",
          code: "relation_endpoint_missing",
          message: `${relationId} references a missing domain or range class.`,
          ref: relationId,
        });
        continue;
      }
      edges.push({
        id: `relation:${relationId}->${target.id}`,
        kind: "relation",
        label: relationLabel(relation),
        source: source.id,
        target: target.id,
        relationFqid: relationId,
        description: relation.description ?? null,
        uri: relation.uri ?? null,
        cardinality: relation.cardinality ?? null,
      });
    }
  }
  return edges;
}

function inheritanceEdges(
  nodes: readonly OntologyGraphNode[],
  nodeIndex: ReadonlyMap<string, OntologyGraphNode>,
): OntologyGraphEdge[] {
  return nodes.flatMap((node) => {
    if (!node.extends) return [];
    const target = nodeIndex.get(node.extends);
    if (!target) return [];
    return [
      {
        id: `extends:${node.id}->${target.id}`,
        kind: "extends" as const,
        label: "extends",
        source: node.id,
        target: target.id,
        relationFqid: "extends",
        description: null,
        uri: null,
        cardinality: null,
      },
    ];
  });
}

function buildProjection(
  ir: NormalizedIr,
  options: ProjectOntologyNormalizedIrOptions,
): OntologyGraphProjection {
  const namespace = text(ir.namespace, "ontology");
  const uniqueClasses = uniqueBy(ir.classes, (item) => classRef(item, namespace));
  const nodes = uniqueClasses.map((item) => makeNode(item, namespace));
  const relations = ir.relations ?? [];
  const uniqueRelations = uniqueBy(relations, (item) => relationRef(item, namespace));
  const diagnostics: OntologyGraphDiagnostic[] = [
    ...duplicateDiagnostics(
      ir.classes.map((item) => classRef(item, namespace)),
      "duplicate_class_id",
    ),
    ...duplicateDiagnostics(
      relations.map((relation) => relationRef(relation, namespace)),
      "duplicate_relation_id",
    ),
  ];
  const nodeIndex = buildNodeIndex(nodes);
  const edges = [
    ...relationEdges(uniqueRelations, nodeIndex, namespace, diagnostics),
    ...inheritanceEdges(nodes, nodeIndex),
  ].sort((left, right) => left.id.localeCompare(right.id));

  return {
    artifactKind: ONTOLOGY_GRAPH_PROJECTION_ARTIFACT_KIND,
    schemaVersion: ONTOLOGY_GRAPH_PROJECTION_SCHEMA_VERSION,
    package: {
      id: ir.id ?? null,
      namespace: ir.namespace ?? null,
      version: ir.version ?? null,
    },
    metadata: {
      imports: ir.imports ?? null,
      policies: ir.policies ?? null,
      protocols: ir.protocols ?? null,
      stateMachines: ir.stateMachines ?? null,
      compatibility: ir.compatibility ?? null,
    },
    nodes: [...nodes].sort((left, right) => left.id.localeCompare(right.id)),
    edges,
    diagnostics,
    sourceFiles: options.sourceFiles ?? [],
    authorityBoundary: {
      ontologyViewerIsAuthority: false,
      mayWriteOntologyPackage: false,
      mayMutateCanonicalSpecs: false,
      mayPublishRegistryEntry: false,
    },
  };
}

export function projectOntologyNormalizedIr(
  raw: unknown,
  options: ProjectOntologyNormalizedIrOptions = {},
): OntologyGraphProjectionResult {
  const result = normalizedIrSchema.safeParse(raw);
  if (!result.success) {
    return { kind: "parse-error", issues: result.error.issues, raw };
  }
  return { kind: "ok", data: buildProjection(result.data, options) };
}
