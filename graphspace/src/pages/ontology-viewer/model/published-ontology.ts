import { selectDiagramArtifact } from "./diagram-artifact";
import {
  loadLocalOntologyArtifact,
  type LocalOntologyArtifactFile,
} from "./local-ontology-artifact";

export type PublishedCandidate = {
  path: string;
  format: "diagram" | "legacy";
  sha256: string | null;
};
export type PublishedResult =
  | { kind: "missing" }
  | { kind: "choose"; candidates: PublishedCandidate[] }
  | {
      kind: "loaded";
      file: LocalOntologyArtifactFile;
      candidate: PublishedCandidate;
      digestMatched: boolean;
    };
const bootstrap = "specgraph-bootstrap";
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid published artifact envelope");
  return value as Record<string, unknown>;
};
export function publishedWorkspace(search: string): string {
  const values = new URLSearchParams(search).getAll("workspace");
  if (values.length > 1) throw new Error("Select one workspace");
  const id = values.length ? values[0] : bootstrap;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(id)) throw new Error("Invalid workspace identity");
  return id;
}
function scope(url: string, workspace: string): string {
  const parsed = new URL(url, "https://specspace.invalid");
  parsed.searchParams.set("workspace", workspace);
  return parsed.pathname + parsed.search;
}
function envelope(raw: unknown, kind: string, workspace: string): Record<string, unknown> {
  const value = object(raw);
  const source = object(value.source);
  if (
    value.api_version !== "v1" ||
    value.schema_version !== 1 ||
    value.artifact_kind !== kind ||
    value.read_only !== true
  )
    throw new Error("Unsupported published artifact contract");
  if (
    (workspace !== bootstrap && source.workspace_id !== workspace) ||
    (source.workspace_id !== undefined && source.workspace_id !== workspace)
  )
    throw new Error("Published artifact belongs to another workspace");
  return value;
}
function safePath(path: string): boolean {
  return (
    !!path &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").some((part) => ["", ".", ".."].includes(part)) &&
    !path.includes(":")
  );
}
async function get(url: string, fetcher: typeof fetch, signal: AbortSignal): Promise<unknown> {
  const response = await fetcher(url, { signal });
  if (!response.ok) throw new Error(`Published ontology unavailable (HTTP ${response.status})`);
  return response.json();
}
function artifactCandidates(artifacts: unknown[]): PublishedCandidate[] {
  const candidates: PublishedCandidate[] = [];
  const paths = new Set<string>();
  for (const raw of artifacts) {
    const row = object(raw);
    const path = row.path;
    if (typeof path !== "string" || !safePath(path))
      throw new Error("Unsafe published artifact path");
    if (paths.has(path)) throw new Error("Duplicate published artifact path");
    paths.add(path);
    let format: PublishedCandidate["format"] | null = null;
    if (path.endsWith("/ontology.graph.json") || path === "ontology.graph.json") format = "diagram";
    else if (
      path === "ontology.normalized.json" ||
      path.endsWith("/ontology.normalized.json") ||
      row.referenced_by_package_index === true
    )
      format = "legacy";
    if (!format) continue;
    const sha256 = typeof row.sha256 === "string" ? row.sha256 : null;
    if (sha256 !== null && !/^[a-f0-9]{64}$/.test(sha256))
      throw new Error("Invalid published digest");
    candidates.push({ path, format, sha256 });
  }
  return candidates;
}
function verifyDigest(candidate: PublishedCandidate, content: Record<string, unknown>): void {
  if (candidate.sha256 && content.sha256 !== candidate.sha256)
    throw new Error("Published artifact changed since its catalog was read");
}
export async function loadPublishedOntology(
  workspace: string,
  signal: AbortSignal,
  selectedPath?: string,
  fetcher: typeof fetch = fetch,
): Promise<PublishedResult> {
  const catalog = envelope(
    await get(scope("/api/v1/artifacts", workspace), fetcher, signal),
    "specspace_artifact_catalog",
    workspace,
  );
  if (!Array.isArray(catalog.artifacts)) throw new Error("Invalid artifact catalog");
  const candidates = artifactCandidates(catalog.artifacts);
  const diagrams = candidates.filter((item) => item.format === "diagram");
  const available = diagrams.length ? diagrams : candidates;
  if (!available.length) return { kind: "missing" };
  let selected: PublishedCandidate | undefined;
  if (selectedPath) selected = available.find((item) => item.path === selectedPath);
  else if (available.length === 1) selected = available[0];
  if (!selected && selectedPath) throw new Error("Selected artifact is no longer published");
  if (!selected) return { kind: "choose", candidates: available };
  const source = object(catalog.source);
  const publicRoutes = new Map<string, string>([
    [
      "ontology/packages/specgraph-core/generated/ontology.normalized.json",
      "/api/v1/public-specgraph-ontology",
    ],
    [
      "ontology/packages/specgraph-core/generated/ontology.graph.json",
      "/api/v1/public-specgraph-ontology-graph",
    ],
  ]);
  const publicRoute =
    workspace === bootstrap &&
    source.provider === "http" &&
    source.artifact_base_url === "https://specgraph.tech"
      ? publicRoutes.get(selected.path)
      : undefined;
  const query =
    publicRoute ??
    scope("/api/v1/artifacts/content?path=" + encodeURIComponent(selected.path), workspace);
  const content = envelope(
    await get(query, fetcher, signal),
    "specspace_artifact_content",
    workspace,
  );
  if (content.path !== selected.path || content.content_kind !== "json")
    throw new Error("Unexpected published artifact content");
  verifyDigest(selected, content);
  const file = {
    path: selected.path,
    name: selected.format === "diagram" ? "ontology.graph.json" : "ontology.normalized.json",
    text: JSON.stringify(content.data),
  };
  if (selected.format === "diagram") selectDiagramArtifact([file]);
  else if (loadLocalOntologyArtifact([file]).kind !== "loaded")
    throw new Error("Published normalized IR is invalid");
  return {
    kind: "loaded",
    candidate: selected,
    file,
    digestMatched: !!selected.sha256,
  };
}
