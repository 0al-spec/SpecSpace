export const ONTOLOGY_GRAPH_PROJECTION_ARTIFACT_KIND =
  "ontology_graph_projection/v1";

export const ONTOLOGY_GRAPH_PROJECTION_SCHEMA_VERSION = 1;

export type OntologyGraphPackage = {
  id: string | null;
  namespace: string | null;
  version: string | null;
};

export type OntologyGraphEdgeKind = "relation" | "extends";

export type OntologyGraphNode = {
  id: string;
  label: string;
  fqid: string;
  kind: string;
  description: string | null;
  uri: string | null;
  central: boolean;
  extends: string | null;
  implements: readonly string[];
};

export type OntologyGraphEdge = {
  id: string;
  kind: OntologyGraphEdgeKind;
  label: string;
  source: string;
  target: string;
  relationFqid: string;
  description: string | null;
  uri: string | null;
  cardinality: { min?: number; max?: number | string } | null;
};

export type OntologyGraphDiagnostic = {
  severity: "warning" | "error";
  code: string;
  message: string;
  ref: string | null;
};

export type OntologyGraphSourceFile = {
  path: string;
  role: "normalized_ir" | "package_source" | "archive_member";
};

export type OntologyGraphAuthorityBoundary = {
  ontologyViewerIsAuthority: false;
  mayWriteOntologyPackage: false;
  mayMutateCanonicalSpecs: false;
  mayPublishRegistryEntry: false;
};

export type OntologyGraphProjection = {
  artifactKind: typeof ONTOLOGY_GRAPH_PROJECTION_ARTIFACT_KIND;
  schemaVersion: typeof ONTOLOGY_GRAPH_PROJECTION_SCHEMA_VERSION;
  package: OntologyGraphPackage;
  nodes: readonly OntologyGraphNode[];
  edges: readonly OntologyGraphEdge[];
  diagnostics: readonly OntologyGraphDiagnostic[];
  sourceFiles: readonly OntologyGraphSourceFile[];
  authorityBoundary: OntologyGraphAuthorityBoundary;
};
