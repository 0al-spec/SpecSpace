import { parseProjection, buildGraph, type Projection } from "@/entities/ontology-diagram";
import type { LocalOntologyArtifactFile } from "./local-ontology-artifact";

export type DiagramSelection =
  | { kind: "none" }
  | {
      kind: "diagram";
      projection: Projection;
      graph: ReturnType<typeof buildGraph>;
    };

function isDiagramCandidate(file: LocalOntologyArtifactFile, value: unknown): boolean {
  const version =
    value && typeof value === "object" ? (value as Record<string, unknown>).schemaVersion : null;
  return (
    file.name === "ontology.graph.json" ||
    (typeof version === "string" && version.startsWith("ontology.diagram-projection/"))
  );
}

/** Select explicitly versioned diagram files; never reinterpret normalized IR. */
export function selectDiagramArtifact(
  files: readonly LocalOntologyArtifactFile[],
): DiagramSelection {
  const candidates: unknown[] = [];
  for (const file of files) {
    if (!file.name.endsWith(".json")) continue;
    let value: unknown;
    try {
      value = JSON.parse(file.text);
    } catch (error) {
      if (file.name === "ontology.graph.json")
        throw new Error(`Invalid diagram JSON: ${String(error)}`);
      continue;
    }
    if (isDiagramCandidate(file, value)) candidates.push(value);
  }
  if (!candidates.length) return { kind: "none" };
  if (candidates.length !== 1 || files.some((file) => file.name === "ontology.normalized.json")) {
    throw new Error("Select one diagram projection or one normalized IR package, not both.");
  }
  const projection = parseProjection(candidates[0]);
  // Build before publishing: validation/layout failures must preserve the old view.
  const graph = buildGraph(projection);
  return { kind: "diagram", projection, graph };
}
