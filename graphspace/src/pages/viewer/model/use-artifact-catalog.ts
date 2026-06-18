import { useEffect, useState } from "react";

export type PublishedArtifact = {
  path: string;
  root: string;
  label: string;
  group: string;
  sizeBytes: number | null;
  sha256: string | null;
  url: string | null;
  referencedByPackageIndex: boolean;
};

export type ArtifactCatalog = {
  apiVersion: "v1";
  artifactKind: "specspace_artifact_catalog";
  schemaVersion: 1;
  readOnly: true;
  source: Record<string, unknown>;
  summary: {
    artifactCount: number;
    runsCount: number;
    ontologyArtifactCount: number;
    ontologyIrCount: number;
    rootCounts: Record<string, number>;
    groupCounts: Record<string, number>;
  };
  artifacts: readonly PublishedArtifact[];
  manifest: Record<string, unknown> | null;
};

export type ArtifactContent = {
  apiVersion: "v1";
  artifactKind: "specspace_artifact_content";
  schemaVersion: 1;
  readOnly: true;
  path: string;
  source: Record<string, unknown>;
  sizeBytes: number;
  contentKind: "json" | "text";
  data?: unknown;
  text?: string;
  jsonSummary?: {
    artifactKind: string | null;
    schemaVersion: number | null;
    topLevelKeys: readonly string[];
  };
};

export type ArtifactCatalogState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: ArtifactCatalog }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; reason: string; raw: unknown };

export type ArtifactContentState =
  | { kind: "idle" }
  | { kind: "loading"; path: string }
  | { kind: "ok"; data: ArtifactContent }
  | { kind: "http-error"; status: number; statusText: string; body?: unknown }
  | { kind: "network-error"; error: unknown }
  | { kind: "parse-error"; reason: string; raw: unknown };

type CatalogOptions = {
  url?: string;
  fetcher?: typeof fetch;
  refreshKey?: number;
};

type ContentOptions = {
  path: string | null;
  url?: string;
  fetcher?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function parseArtifact(raw: unknown): PublishedArtifact | null {
  if (!isRecord(raw)) return null;
  const path = optionalString(raw.path);
  if (!path) return null;
  return {
    path,
    root: stringValue(raw.root, path.split("/", 1)[0] || "root"),
    label: stringValue(raw.label, path),
    group: stringValue(raw.group, "root"),
    sizeBytes: optionalNumber(raw.size_bytes),
    sha256: optionalString(raw.sha256),
    url: optionalString(raw.url),
    referencedByPackageIndex: raw.referenced_by_package_index === true,
  };
}

function parseCatalog(raw: unknown): ArtifactCatalogState {
  if (!isRecord(raw)) return { kind: "parse-error", reason: "catalog root is not an object", raw };
  if (raw.api_version !== "v1" || raw.artifact_kind !== "specspace_artifact_catalog") {
    return { kind: "parse-error", reason: "response is not an artifact catalog", raw };
  }
  if (raw.schema_version !== 1 || raw.read_only !== true) {
    return { kind: "parse-error", reason: "unsupported artifact catalog contract", raw };
  }
  const summary = isRecord(raw.summary) ? raw.summary : {};
  const artifacts = Array.isArray(raw.artifacts)
    ? raw.artifacts.map(parseArtifact).filter((item): item is PublishedArtifact => item !== null)
    : [];
  return {
    kind: "ok",
    data: {
      apiVersion: "v1",
      artifactKind: "specspace_artifact_catalog",
      schemaVersion: 1,
      readOnly: true,
      source: isRecord(raw.source) ? raw.source : {},
      summary: {
        artifactCount: numberValue(summary.artifact_count),
        runsCount: numberValue(summary.runs_count),
        ontologyArtifactCount: numberValue(summary.ontology_artifact_count),
        ontologyIrCount: numberValue(summary.ontology_ir_count),
        rootCounts: numberRecord(summary.root_counts),
        groupCounts: numberRecord(summary.group_counts),
      },
      artifacts,
      manifest: isRecord(raw.manifest) ? raw.manifest : null,
    },
  };
}

function parseContent(raw: unknown): ArtifactContentState {
  if (!isRecord(raw)) return { kind: "parse-error", reason: "content root is not an object", raw };
  if (raw.api_version !== "v1" || raw.artifact_kind !== "specspace_artifact_content") {
    return { kind: "parse-error", reason: "response is not artifact content", raw };
  }
  if (raw.schema_version !== 1 || raw.read_only !== true) {
    return { kind: "parse-error", reason: "unsupported artifact content contract", raw };
  }
  const path = optionalString(raw.path);
  const contentKind = raw.content_kind === "text" ? "text" : raw.content_kind === "json" ? "json" : null;
  if (!path || !contentKind) {
    return { kind: "parse-error", reason: "artifact content is missing path or content_kind", raw };
  }
  const jsonSummary = isRecord(raw.json_summary)
    ? {
        artifactKind: optionalString(raw.json_summary.artifact_kind),
        schemaVersion: optionalNumber(raw.json_summary.schema_version),
        topLevelKeys: stringList(raw.json_summary.top_level_keys),
      }
    : undefined;
  return {
    kind: "ok",
    data: {
      apiVersion: "v1",
      artifactKind: "specspace_artifact_content",
      schemaVersion: 1,
      readOnly: true,
      path,
      source: isRecord(raw.source) ? raw.source : {},
      sizeBytes: numberValue(raw.size_bytes),
      contentKind,
      data: raw.data,
      text: optionalString(raw.text) ?? undefined,
      jsonSummary,
    },
  };
}

async function fetchJson(fetcher: typeof fetch, url: string, signal: AbortSignal) {
  const response = await fetcher(url, { signal });
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON proxy errors are possible.
    }
    return { response, body };
  }
  return { response, body: await response.json() };
}

export function useArtifactCatalog(options: CatalogOptions = {}): ArtifactCatalogState {
  const { url = "/api/v1/artifacts", fetcher = fetch, refreshKey = 0 } = options;
  const [state, setState] = useState<ArtifactCatalogState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((current) => (current.kind === "idle" ? { kind: "loading" } : current));

    fetchJson(fetcher, url, controller.signal)
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok) {
          setState({ kind: "http-error", status: response.status, statusText: response.statusText, body });
          return;
        }
        setState(parseCatalog(body));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) setState({ kind: "network-error", error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, refreshKey, url]);

  return state;
}

export function useArtifactContent(options: ContentOptions): ArtifactContentState {
  const { path, url = "/api/v1/artifacts/content", fetcher = fetch } = options;
  const [state, setState] = useState<ArtifactContentState>({ kind: "idle" });

  useEffect(() => {
    if (!path) {
      setState({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setState({ kind: "loading", path });

    fetchJson(fetcher, `${url}?path=${encodeURIComponent(path)}`, controller.signal)
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok) {
          setState({ kind: "http-error", status: response.status, statusText: response.statusText, body });
          return;
        }
        setState(parseContent(body));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!cancelled) setState({ kind: "network-error", error });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, path, url]);

  return state;
}
