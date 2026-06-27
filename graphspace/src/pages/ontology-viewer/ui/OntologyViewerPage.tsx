import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { OntologyGraphDiagnostic } from "@/shared/ontology-graph-contract";
import {
  loadLocalOntologyArtifact,
  type LocalOntologyArtifactDiagnostic,
  type LocalOntologyArtifactFile,
  type LocalOntologyArtifactLoadResult,
} from "../model/local-ontology-artifact";
import styles from "./OntologyViewerPage.module.css";

const AUTHORITY_ROWS = [
  ["Ontology writes", "disabled"],
  ["Spec mutations", "disabled"],
  ["Registry publish", "disabled"],
  ["Source", "local browser state"],
] as const;

type ImportState =
  | { kind: "empty" }
  | { kind: "loading" }
  | {
      kind: "loaded";
      result: Extract<LocalOntologyArtifactLoadResult, { kind: "loaded" }>;
    }
  | {
      kind: "failed";
      diagnostics: readonly LocalOntologyArtifactDiagnostic[];
    };

type DisplayDiagnostic = LocalOntologyArtifactDiagnostic | OntologyGraphDiagnostic;

function filePath(file: File): string {
  const withRelativePath = file as File & { webkitRelativePath?: string };
  return withRelativePath.webkitRelativePath || file.name;
}

async function filesFromList(fileList: FileList): Promise<LocalOntologyArtifactFile[]> {
  return Promise.all(
    [...fileList].map(async (file) => ({
      name: file.name,
      path: filePath(file),
      text: await file.text(),
    })),
  );
}

function diagnosticLocation(diagnostic: DisplayDiagnostic): string {
  if ("path" in diagnostic) return diagnostic.path ?? "root";
  return diagnostic.ref ?? "root";
}

export function OntologyViewerPage() {
  const [importState, setImportState] = useState<ImportState>({ kind: "empty" });
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setImportState({ kind: "loading" });
    const files = await filesFromList(fileList);
    const result = loadLocalOntologyArtifact(files);
    if (result.kind === "loaded") {
      setImportState({ kind: "loaded", result });
      return;
    }
    setImportState({ kind: "failed", diagnostics: result.diagnostics });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void loadFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    void loadFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const loadedProjection =
    importState.kind === "loaded" ? importState.result.projection : null;
  const diagnostics =
    importState.kind === "failed"
      ? importState.diagnostics
      : loadedProjection?.diagnostics ?? [];

  return (
    <main className={styles.root} aria-label="Ontology viewer">
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Ontology</h1>
          <span className={styles.kicker}>local artifact viewer</span>
        </div>
        <a className={styles.link} href="/">
          SpecGraph
        </a>
      </header>

      <div className={styles.content}>
        <section
          className={styles.surface}
          aria-label="Ontology graph canvas"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className={styles.surfaceHeader}>
            <span className={styles.panelKicker}>Graph</span>
            <span className={`${styles.statusValue} ${styles.statusValueMuted}`}>
              {loadedProjection
                ? `${loadedProjection.nodes.length} nodes · ${loadedProjection.edges.length} edges`
                : importState.kind === "loading"
                  ? "loading local artifact"
                  : "no artifact loaded"}
            </span>
          </div>
          <div className={styles.surfaceBody}>
            {loadedProjection ? (
              <div className={styles.loadedSummary}>
                <span className={styles.loadedTitle}>
                  {loadedProjection.package.id ?? "Ontology package"}
                </span>
                <span className={styles.loadedMeta}>
                  {loadedProjection.package.namespace ?? "namespace unknown"} ·{" "}
                  {loadedProjection.package.version ?? "version unknown"}
                </span>
                <div className={styles.summaryGrid}>
                  <SummaryMetric label="Classes" value={loadedProjection.nodes.length} />
                  <SummaryMetric label="Relations" value={loadedProjection.edges.length} />
                  <SummaryMetric label="Diagnostics" value={diagnostics.length} />
                </div>
              </div>
            ) : (
              <button
                className={styles.dropTarget}
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <span className={styles.mark} aria-hidden="true">
                  O
                </span>
                <span className={styles.dropTitle}>
                  Drop ontology.normalized.json
                </span>
                <span className={styles.dropCaption}>
                  Local browser-only import. No upload is performed.
                </span>
              </button>
            )}
            <input
              ref={inputRef}
              className={styles.fileInput}
              type="file"
              accept="application/json,.json"
              multiple
              onChange={handleInputChange}
            />
          </div>
        </section>

        <aside className={styles.panel} aria-label="Ontology authority boundary">
          <span className={styles.panelKicker}>Authority boundary</span>
          <div className={styles.statusCard}>
            {AUTHORITY_ROWS.map(([label, value]) => (
              <div className={styles.statusRow} key={label}>
                <span className={styles.statusLabel}>{label}</span>
                <span className={styles.statusValue}>{value}</span>
              </div>
            ))}
          </div>

          <span className={styles.panelKicker}>Import diagnostics</span>
          <div className={styles.statusCard}>
            {diagnostics.length === 0 ? (
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Status</span>
                <span className={styles.statusValue}>
                  {loadedProjection ? "loaded" : "waiting for local artifact"}
                </span>
              </div>
            ) : (
              diagnostics.map((diagnostic) => (
                <div
                  className={styles.statusRow}
                  key={`${diagnostic.code}:${diagnosticLocation(diagnostic)}`}
                >
                  <span className={styles.statusLabel}>{diagnostic.code}</span>
                  <span className={styles.statusValue}>{diagnostic.message}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.summaryMetric}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}
