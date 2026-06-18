import { useMemo, useState } from "react";
import type { ArtifactDiagnostic } from "../model/live-artifacts";
import {
  useArtifactContent,
  type ArtifactCatalogState,
  type ArtifactContentState,
  type PublishedArtifact,
} from "../model/use-artifact-catalog";
import styles from "./LiveArtifactStatusPanel.module.css";

type Props = {
  diagnostics: readonly ArtifactDiagnostic[];
  capabilityDiagnostics?: readonly ArtifactDiagnostic[];
  artifactCatalogState?: ArtifactCatalogState;
  runsWatchVersion: number;
  showHeader?: boolean;
};

export function LiveArtifactStatusPanel({
  diagnostics,
  capabilityDiagnostics = [],
  artifactCatalogState = { kind: "idle" },
  runsWatchVersion,
  showHeader = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const artifactContentState = useArtifactContent({
    path: selectedPath,
    refreshKey: runsWatchVersion,
  });
  const artifacts = artifactCatalogState.kind === "ok" ? artifactCatalogState.data.artifacts : [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleArtifacts = useMemo(() => {
    const selected = normalizedQuery
      ? artifacts.filter((artifact) =>
          [
            artifact.path,
            artifact.label,
            artifact.group,
            artifact.root,
            artifact.url ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : artifacts;
    return selected.slice(0, 80);
  }, [artifacts, normalizedQuery]);
  const catalogSummary =
    artifactCatalogState.kind === "ok"
      ? artifactCatalogState.data.summary
      : null;

  return (
    <section className={styles.panel} aria-label="Live artifact status">
      {showHeader ? (
        <header className={styles.header}>
          <span className={styles.title}>Live artifacts</span>
          <span className={styles.meta}>runs tick {runsWatchVersion}</span>
        </header>
      ) : null}
      <div className={styles.list}>
        {diagnostics.map((artifact) => (
          <div
            key={artifact.id}
            className={[styles.row, styles[`tone-${artifact.tone}`]].join(" ")}
          >
            <div className={styles.name}>
              <span className={styles.label}>{artifact.label}</span>
              <span className={styles.endpoint}>{artifact.endpoint}</span>
              <span className={styles.detail}>{artifact.detail}</span>
            </div>
            <div className={styles.status}>
              <span className={styles.pill}>{artifact.status}</span>
              <span className={styles.count}>{artifact.countLabel}</span>
            </div>
          </div>
        ))}
        {capabilityDiagnostics.length > 0 ? (
          <div className={styles.groupTitle}>Capabilities</div>
        ) : null}
        {capabilityDiagnostics.map((artifact) => (
          <div
            key={artifact.id}
            className={[styles.row, styles[`tone-${artifact.tone}`]].join(" ")}
          >
            <div className={styles.name}>
              <span className={styles.label}>{artifact.label}</span>
              <span className={styles.endpoint}>{artifact.endpoint}</span>
              <span className={styles.detail}>{artifact.detail}</span>
            </div>
            <div className={styles.status}>
              <span className={styles.pill}>{artifact.status}</span>
              <span className={styles.count}>{artifact.countLabel}</span>
            </div>
          </div>
        ))}
        <div className={styles.groupTitle}>Published artifact catalog</div>
        {artifactCatalogState.kind === "ok" ? (
          <>
            <div className={styles.catalogSummary}>
              <span>{catalogSummary?.artifactCount ?? 0} files</span>
              <span>{catalogSummary?.runsCount ?? 0} runs</span>
              <span>{catalogSummary?.ontologyArtifactCount ?? 0} ontology</span>
              <span>{catalogSummary?.ontologyIrCount ?? 0} IR</span>
            </div>
            <label className={styles.searchRow}>
              Search{" "}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ontology, graph_dashboard, normalized"
              />
            </label>
            {visibleArtifacts.map((artifact) => (
              <ArtifactRow
                key={artifact.path}
                artifact={artifact}
                selected={artifact.path === selectedPath}
                onSelect={() => setSelectedPath(artifact.path)}
              />
            ))}
            {artifacts.length > visibleArtifacts.length ? (
              <div className={styles.catalogNote}>
                Showing {visibleArtifacts.length} of {artifacts.length} files. Narrow the search to inspect more.
              </div>
            ) : null}
            <ArtifactPreview state={artifactContentState} />
          </>
        ) : (
          <CatalogState state={artifactCatalogState} />
        )}
      </div>
    </section>
  );
}

function formatBytes(value: number | null): string {
  if (value === null) return "unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function artifactTone(artifact: PublishedArtifact): string {
  if (artifact.group === "ontology_ir") return "IR";
  if (artifact.group === "ontology") return "ontology";
  return artifact.group;
}

function ArtifactRow({
  artifact,
  selected,
  onSelect,
}: {
  artifact: PublishedArtifact;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={[styles.artifactRow, selected ? styles.artifactRowSelected : ""].join(" ")}
      onClick={onSelect}
    >
      <span className={styles.artifactMain}>
        <span className={styles.label}>{artifact.label}</span>
        <span className={styles.endpoint}>{artifact.path}</span>
        {artifact.url ? <span className={styles.detail}>{artifact.url}</span> : null}
      </span>
      <span className={styles.status}>
        <span className={styles.pill}>{artifactTone(artifact)}</span>
        <span className={styles.count}>{formatBytes(artifact.sizeBytes)}</span>
      </span>
    </button>
  );
}

function CatalogState({ state }: { state: ArtifactCatalogState }) {
  let detail = "Loading /api/v1/artifacts";
  if (state.kind === "http-error") {
    detail = `HTTP ${state.status} ${state.statusText}`;
  } else if (state.kind === "network-error") {
    detail = "Backend is unreachable.";
  } else if (state.kind === "parse-error") {
    detail = state.reason;
  }
  return <div className={styles.catalogNote}>{detail}</div>;
}

function ArtifactPreview({ state }: { state: ArtifactContentState }) {
  if (state.kind === "idle") {
    return <div className={styles.catalogNote}>Select an artifact to inspect a bounded preview.</div>;
  }
  if (state.kind === "loading") {
    return <div className={styles.catalogNote}>Loading {state.path}</div>;
  }
  if (state.kind !== "ok") {
    const detail =
      state.kind === "http-error"
        ? `HTTP ${state.status} ${state.statusText}`
        : state.kind === "network-error"
          ? "Backend is unreachable."
          : state.reason;
    return <div className={styles.catalogNote}>{detail}</div>;
  }
  const { data } = state;
  const preview =
    data.contentKind === "json"
      ? JSON.stringify(data.data, null, 2)
      : data.text ?? "";
  return (
    <div className={styles.preview}>
      <div className={styles.previewHeader}>
        <span>{data.path}</span>
        <span>{data.contentKind} · {formatBytes(data.sizeBytes)}</span>
      </div>
      {data.jsonSummary ? (
        <div className={styles.previewMeta}>
          <span>{data.jsonSummary.artifactKind ?? "json"}</span>
          <span>{data.jsonSummary.topLevelKeys.slice(0, 8).join(", ")}</span>
        </div>
      ) : null}
      <pre>{preview.slice(0, 12_000)}</pre>
    </div>
  );
}
