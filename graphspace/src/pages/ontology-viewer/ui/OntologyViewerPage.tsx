import { publishedWorkspace } from "../model/published-ontology";
import { usePublishedOntology } from "../model/use-published-ontology";
import { PublishedOntologyStatus } from "./PublishedOntologyStatus";
import { OntologyExplorer } from "@/widgets/ontology-explorer";
import type { Projection } from "@/entities/ontology-diagram";
import { selectDiagramArtifact } from "../model/diagram-artifact";
import { readLocalOntologyFiles } from "../model/local-ontology-file-reader";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { OntologyGraphDiagnostic } from "../model/ontology-graph-contract";
import {
  expandLocalOntologyArtifactFiles,
  loadLocalOntologyArtifact,
  type LocalOntologyArtifactDiagnostic,
  type LocalOntologyArtifactLoadResult,
} from "../model/local-ontology-artifact";
import { toOntologyFlowElements, type OntologyFlowNode } from "../model/ontology-flow-elements";
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
      result: Extract<LocalOntologyArtifactLoadResult, { kind: "failed" }> | null;
    };

type DisplayDiagnostic = LocalOntologyArtifactDiagnostic | OntologyGraphDiagnostic;

function requireCompleteArchive(diagnostics: readonly LocalOntologyArtifactDiagnostic[]) {
  const errors = diagnostics.filter((item) => item.severity === "error");
  if (errors.length > 0) throw new Error(errors.map((item) => item.message).join(" "));
}

function diagnosticLocation(diagnostic: DisplayDiagnostic): string {
  if ("path" in diagnostic) return diagnostic.path ?? "root";
  return diagnostic.ref ?? "root";
}

const nodeTypes = {
  ontologyNode: OntologyNode,
};

export function OntologyViewerPage() {
  const [importState, setImportState] = useState<ImportState>({ kind: "empty" });
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadSequence = useRef(0);
  const [diagram, setDiagram] = useState<{ projection: Projection; sequence: number } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const workspace = useMemo(() => {
    try {
      return { id: publishedWorkspace(window.location.search), error: "" };
    } catch (error) {
      return { id: null, error: error instanceof Error ? error.message : "Invalid workspace" };
    }
  }, []);
  const [automatic, setAutomatic] = useState(
    () => new URLSearchParams(window.location.search).get("source") !== "local",
  );
  const [origin, setOrigin] = useState<"local" | "published">("local");
  const [publishedPath, setPublishedPath] = useState<string>();
  const [publishedRefresh, setPublishedRefresh] = useState(0);
  const published = usePublishedOntology(workspace.id, automatic, publishedPath, publishedRefresh);
  useEffect(() => {
    if (!automatic || published.kind !== "loaded") return;
    const sequence = ++loadSequence.current;
    const files = [published.file];
    const selected = selectDiagramArtifact(files);
    if (selected.kind === "diagram") setDiagram({ projection: selected.projection, sequence });
    else {
      const result = loadLocalOntologyArtifact(files);
      if (result.kind === "loaded") {
        setDiagram(null);
        setImportState({ kind: "loaded", result });
      }
    }
    setOrigin("published");
    setLoadError("");
    setLoading(false);
  }, [published, automatic]);

  const loadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setAutomatic(false);
    const sequence = ++loadSequence.current;
    setLoadError("");
    setLoading(true);
    try {
      const files = await readLocalOntologyFiles(fileList);
      const expanded = await expandLocalOntologyArtifactFiles(files);
      if (sequence !== loadSequence.current) return;
      requireCompleteArchive(expanded.diagnostics);
      const selected = selectDiagramArtifact(expanded.files);
      if (selected.kind === "diagram") {
        setDiagram({ projection: selected.projection, sequence });
        setOrigin("local");
        return;
      }
      const result = loadLocalOntologyArtifact(expanded.files);
      const diagnostics = [...expanded.diagnostics, ...result.diagnostics];
      if (result.kind === "loaded") {
        setDiagram(null);
        setOrigin("local");
        setImportState({ kind: "loaded", result: { ...result, diagnostics } });
      } else {
        setLoadError(diagnostics.map((item) => item.message).join(" "));
        if (!diagram && importState.kind !== "loaded")
          setImportState({ kind: "failed", diagnostics, result });
      }
    } catch (error) {
      if (sequence === loadSequence.current)
        setLoadError(error instanceof Error ? error.message : "Could not read the selected file.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
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

  const loadedProjection = importState.kind === "loaded" ? importState.result.projection : null;
  const loadedResult = importState.kind === "loaded" ? importState.result : null;
  const failedResult = importState.kind === "failed" ? importState.result : null;
  const packageMetadata = loadedResult?.packageMetadata ?? failedResult?.packageMetadata ?? null;
  const packageShape = loadedResult?.packageShape ?? failedResult?.packageShape ?? null;
  const flowElements = useMemo(
    () => (loadedProjection ? toOntologyFlowElements(loadedProjection, query) : null),
    [loadedProjection, query],
  );
  const diagnostics =
    importState.kind === "failed" ? importState.diagnostics : (loadedProjection?.diagnostics ?? []);
  const selectedNode = loadedProjection?.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = loadedProjection?.edges.find((edge) => edge.id === selectedEdgeId);

  const publishedState = !automatic ? { kind: "local" as const } : published;
  const publishedStatus = (
    <PublishedOntologyStatus
      workspace={workspace.id || "(invalid)"}
      state={workspace.error ? { kind: "error", message: workspace.error } : publishedState}
      onChoose={setPublishedPath}
      onRetry={() => {
        ++loadSequence.current;
        setPublishedPath(undefined);
        setAutomatic(true);
        setPublishedRefresh((value) => value + 1);
      }}
    />
  );

  if (diagram)
    return (
      <main
        className={styles.diagramPage}
        aria-label="Ontology viewer"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Ontology</h1>
            <p>
              Read-only declaration explorer ·{" "}
              {origin === "published" ? "published workspace artifact" : "local browser state"}
            </p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()}>
            Open another artifact
          </button>
          <a className={styles.link} href="/">
            SpecGraph
          </a>
          <input
            ref={inputRef}
            className={styles.fileInput}
            type="file"
            accept=".json,.zip,.yaml,.yml"
            multiple
            aria-label="Open ontology artifact"
            onChange={handleInputChange}
          />
        </header>
        {publishedStatus}
        {loading && <p role="status">Reading ontology artifact…</p>}
        {loadError && (
          <p role="alert" className={styles.loadError}>
            Could not open artifact. {loadError} The previous view is retained.
          </p>
        )}
        <OntologyExplorer key={diagram.sequence} projection={diagram.projection} />
      </main>
    );

  return (
    <main className={styles.root} aria-label="Ontology viewer">
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Ontology</h1>
          <span className={styles.kicker}>local artifact viewer</span>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()}>
          Open ontology artifact
        </button>
        <a className={styles.link} href="/">
          SpecGraph
        </a>
      </header>

      <div>
        {publishedStatus}
        {loading && <p role="status">Reading ontology artifact…</p>}
        {loadError && (
          <p role="alert" className={styles.loadError}>
            Could not open artifact. {loadError}
          </p>
        )}
      </div>
      <div className={styles.content}>
        <section
          className={styles.surface}
          aria-label="Ontology graph canvas"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className={styles.surfaceHeader}>
            <span className={styles.panelKicker}>Graph</span>
            {loadedProjection ? (
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search classes and relations"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            ) : (
              <span className={`${styles.statusValue} ${styles.statusValueMuted}`}>
                {importState.kind === "loading" ? "loading local artifact" : "no artifact loaded"}
              </span>
            )}
          </div>
          <div className={styles.surfaceBody}>
            {loadedProjection && flowElements ? (
              <ReactFlowProvider>
                <ReactFlow
                  className={styles.flow}
                  nodes={flowElements.nodes}
                  edges={flowElements.edges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  onNodeClick={(_, node: OntologyFlowNode) => {
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }}
                  onEdgeClick={(_, edge: Edge) => {
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                  }}
                  onPaneClick={() => {
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                  }}
                >
                  <Background gap={32} size={1} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </ReactFlowProvider>
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
                  Drop a diagram JSON, ontology package or ZIP
                </span>
                <span className={styles.dropCaption}>
                  Supports ontology.graph.json, generated/ontology.normalized.json and package
                  metadata. No upload is performed.
                </span>
              </button>
            )}
            <input
              ref={inputRef}
              className={styles.fileInput}
              type="file"
              accept="application/json,.json,.yaml,.yml,.zip,application/zip"
              multiple
              aria-label="Open ontology artifact"
              onChange={handleInputChange}
            />
          </div>
        </section>

        <OntologyInspector
          loadedProjection={loadedProjection}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          packageMetadata={packageMetadata}
          packageShape={packageShape}
          diagnostics={diagnostics}
        />
      </div>
    </main>
  );
}

type LoadedArtifact = Extract<LocalOntologyArtifactLoadResult, { kind: "loaded" }>;
type ArtifactWithMetadata = Extract<LocalOntologyArtifactLoadResult, { kind: "loaded" | "failed" }>;
type InspectorProps = {
  loadedProjection: LoadedArtifact["projection"] | null;
  selectedNode: LoadedArtifact["projection"]["nodes"][number] | undefined;
  selectedEdge: LoadedArtifact["projection"]["edges"][number] | undefined;
  packageMetadata: ArtifactWithMetadata["packageMetadata"] | null;
  packageShape: ArtifactWithMetadata["packageShape"] | null;
  diagnostics: readonly DisplayDiagnostic[];
};

function inspectorSelectionRows(
  projection: LoadedArtifact["projection"],
  node: InspectorProps["selectedNode"],
  edge: InspectorProps["selectedEdge"],
): readonly (readonly [string, string])[] {
  if (node)
    return [
      ["Class", node.label],
      ["FQID", node.fqid],
      ["Kind", node.kind],
      ["Extends", node.extends ?? "none"],
      ["Description", node.description ?? "none"],
    ];
  if (edge)
    return [
      ["Relation", edge.label],
      ["Kind", edge.kind],
      ["Source", edge.source],
      ["Target", edge.target],
      ["Description", edge.description ?? "none"],
    ];
  return [
    ["Package", projection.package.id ?? "unknown"],
    ["Namespace", projection.package.namespace ?? "unknown"],
    ["Version", projection.package.version ?? "unknown"],
    ["Classes", projection.nodes.length.toString()],
    ["Edges", projection.edges.length.toString()],
  ];
}

function OntologyInspector({
  loadedProjection,
  selectedNode,
  selectedEdge,
  packageMetadata,
  packageShape,
  diagnostics,
}: Readonly<InspectorProps>) {
  return (
    <aside className={styles.panel} aria-label="Ontology inspector">
      {loadedProjection ? (
        <>
          <span className={styles.panelKicker}>Inspector</span>
          <div className={styles.statusCard}>
            <DetailRows
              rows={inspectorSelectionRows(loadedProjection, selectedNode, selectedEdge)}
            />
          </div>
        </>
      ) : null}

      {packageMetadata || packageShape ? (
        <>
          <span className={styles.panelKicker}>Package artifact</span>
          <div className={styles.statusCard}>
            <DetailRows
              rows={[
                ["Package", packageMetadata?.id ?? loadedProjection?.package.id ?? "unknown"],
                [
                  "Namespace",
                  packageMetadata?.namespace ?? loadedProjection?.package.namespace ?? "unknown",
                ],
                [
                  "Version",
                  packageMetadata?.version ?? loadedProjection?.package.version ?? "unknown",
                ],
                ["Approval", packageMetadata?.approvalStatus ?? "unknown"],
                ["Manifest", packageShape?.manifestPath ?? "not found"],
                ["Metadata", packageMetadata?.path ?? "not found"],
                ["Normalized IR", packageShape?.normalizedIrPath ?? "not found"],
                ["Generated files", (packageShape?.generatedFileCount ?? 0).toString()],
                ["SDK files", (packageShape?.sdkFileCount ?? 0).toString()],
                ["Compatibility", (packageShape?.compatibilityArtifactCount ?? 0).toString()],
                ["Governance", (packageShape?.governanceArtifactCount ?? 0).toString()],
              ]}
            />
          </div>
        </>
      ) : null}

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
  );
}

function DetailRows({ rows }: Readonly<{ rows: readonly (readonly [string, string])[] }>) {
  return (
    <>
      {rows.map(([label, value]) => (
        <div className={styles.statusRow} key={label}>
          <span className={styles.statusLabel}>{label}</span>
          <span className={styles.statusValue}>{value}</span>
        </div>
      ))}
    </>
  );
}

function OntologyNode({ data }: NodeProps<OntologyFlowNode>) {
  const nodeData = data;
  return (
    <div
      className={[
        styles.ontologyNode,
        nodeData.central ? styles.ontologyNodeCentral : "",
        nodeData.matched ? styles.ontologyNodeMatched : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle type="target" position={Position.Left} className={styles.ontologyHandle} />
      <Handle type="source" position={Position.Right} className={styles.ontologyHandle} />
      <span className={styles.ontologyNodeKind}>{nodeData.kind}</span>
      <span className={styles.ontologyNodeLabel}>{nodeData.label}</span>
      <span className={styles.ontologyNodeFqid}>{nodeData.fqid}</span>
    </div>
  );
}
