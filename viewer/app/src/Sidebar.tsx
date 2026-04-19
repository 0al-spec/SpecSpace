import { useState, useEffect, useCallback } from "react";
import "./Sidebar.css";
import "./PanelBtn.css";
import "./SpecNode.css";
import PanelBtn from "./PanelBtn";
import { useToast } from "./Toast";
import KindBadge from "./KindBadge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate, faXmark, faGauge } from "@fortawesome/free-solid-svg-icons";
import type { GraphMode, SpecViewOptions } from "./types";

interface FileEntry {
  name: string;
  size: number;
  kind: string;
}

interface SpecEntry {
  node_id: string;
  title: string;
  kind: string;
  status: string;
  maturity: number | null;
}

interface SidebarProps {
  onSelectFile?: (fileName: string) => void;
  selectedFile?: string | null;
  onRefresh?: () => void;
  graphMode: GraphMode;
  onGraphModeChange: (mode: GraphMode) => void;
  specAvailable: boolean;
  dashboardAvailable?: boolean;
  specViewOptions: SpecViewOptions;
  onSpecViewOptionsChange: (opts: SpecViewOptions) => void;
  onSpecNodeSelect?: (nodeId: string) => void;
  selectedSpecNodeId?: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const COLLAPSE_KEY = "ctxb_sidebar_collapsed";
const MODE_KEY = "ctxb_graph_mode";


function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function Sidebar({
  onSelectFile,
  selectedFile,
  onRefresh,
  graphMode,
  onGraphModeChange,
  specAvailable,
  dashboardAvailable = false,
  specViewOptions,
  onSpecViewOptionsChange,
  onSpecNodeSelect,
  selectedSpecNodeId,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [specNodes, setSpecNodes] = useState<SpecEntry[]>([]);
  const [dialogDir, setDialogDir] = useState("");
  const [specDir, setSpecDir] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      if (!res.ok) return;
      const data = await res.json();
      setDialogDir(data.dialog_dir || "");
      setFiles(
        (data.files || []).map((f: { name: string; size: number; kind: string }) => ({
          name: f.name,
          size: f.size,
          kind: f.kind,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSpecNodes = useCallback(async () => {
    if (!specAvailable) return;
    setLoading(true);
    try {
      const res = await fetch("/api/spec-graph");
      if (!res.ok) return;
      const data = await res.json();
      setSpecDir(data.spec_dir || "");
      const graphNodes = data.graph?.nodes || [];
      setSpecNodes(
        graphNodes.map((n: { node_id: string; title: string; kind: string; status: string; maturity: number | null }) => ({
          node_id: n.node_id,
          title: n.title,
          kind: n.kind,
          status: n.status,
          maturity: typeof n.maturity === "number" ? n.maturity : null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [specAvailable]);

  useEffect(() => {
    if (graphMode === "conversations") {
      fetchFiles();
    } else {
      fetchSpecNodes();
    }
  }, [graphMode, fetchFiles, fetchSpecNodes]);

  const handleRefresh = useCallback(() => {
    if (graphMode === "conversations") {
      fetchFiles();
      onRefresh?.();
    } else {
      fetchSpecNodes();
      onRefresh?.();
    }
  }, [graphMode, fetchFiles, fetchSpecNodes, onRefresh]);

  const handleModeChange = useCallback(
    (mode: GraphMode) => {
      sessionStorage.setItem(MODE_KEY, mode);
      onGraphModeChange(mode);
    },
    [onGraphModeChange],
  );

  const { showToast } = useToast();

  const workspacePath = graphMode === "conversations" ? dialogDir : specDir;
  const itemCount =
    graphMode === "conversations" ? files.length : specNodes.length;
  const itemLabel =
    graphMode === "conversations" ? "JSON files" : "spec nodes";

  if (collapsed) return null;

  return (
    <aside className="sidebar">
      <PanelBtn
        icon={<FontAwesomeIcon icon={faXmark} />}
        title="Свернуть панель"
        onClick={onToggleCollapse}
        className="sidebar-toggle"
      />
      <div className="sidebar-header">
        <h1 className="sidebar-title">ContextBuilder</h1>
        <p className="sidebar-description">
          {graphMode === "conversations"
            ? "Graph-first navigation for local conversation lineages."
            : "Specification graph viewer."}
        </p>
      </div>

          {/* Mode switcher — only shown when spec support is available */}
          {(specAvailable || dashboardAvailable) && (
            <div className="sidebar-mode-switcher">
              <button
                className={`sidebar-mode-btn ${graphMode === "conversations" ? "active" : ""}`}
                onClick={() => handleModeChange("conversations")}
                title="Conversation lineage graph"
              >
                Conversations
              </button>
              {specAvailable && (
                <button
                  className={`sidebar-mode-btn spec-mode ${graphMode === "specifications" ? "active" : ""}`}
                  onClick={() => handleModeChange("specifications")}
                  title="Specification dependency graph"
                >
                  Specs
                </button>
              )}
              {dashboardAvailable && (
                <button
                  className={`sidebar-mode-btn spec-mode ${graphMode === "dashboard" ? "active" : ""}`}
                  onClick={() => handleModeChange("dashboard")}
                  title="Graph dashboard — aggregated metrics"
                >
                  <FontAwesomeIcon icon={faGauge} />
                </button>
              )}
            </div>
          )}

          {/* Spec view controls — only in specifications mode */}
          {graphMode === "specifications" && (
            <div className="sidebar-spec-controls">
              {/* Tree / Linear / Canonical sub-mode switcher */}
              <div className="sidebar-mode-switcher sidebar-spec-view-switcher">
                <button
                  className={`sidebar-mode-btn spec-mode ${specViewOptions.viewMode === "tree" ? "active" : ""}`}
                  onClick={() =>
                    onSpecViewOptionsChange({ ...specViewOptions, viewMode: "tree" })
                  }
                  title="Tree Projection — inverted refines hierarchy"
                >
                  Tree
                </button>
                <button
                  className={`sidebar-mode-btn spec-mode ${specViewOptions.viewMode === "linear" ? "active" : ""}`}
                  onClick={() =>
                    onSpecViewOptionsChange({ ...specViewOptions, viewMode: "linear" })
                  }
                  title="Linear — all forward edges flow left-to-right"
                >
                  Linear
                </button>
                <button
                  className={`sidebar-mode-btn spec-mode ${specViewOptions.viewMode === "canonical" ? "active" : ""}`}
                  onClick={() =>
                    onSpecViewOptionsChange({ ...specViewOptions, viewMode: "canonical" })
                  }
                  title="Canonical Graph — raw edges as stored"
                >
                  Canonical
                </button>
                <button
                  className={`sidebar-mode-btn spec-mode ${specViewOptions.viewMode === "force" ? "active" : ""}`}
                  onClick={() =>
                    onSpecViewOptionsChange({ ...specViewOptions, viewMode: "force" })
                  }
                  title="Force-directed — organic layout showing all connections"
                >
                  Force
                </button>
              </div>

              {/* Toggles — meaningful in tree and linear modes */}
              {(specViewOptions.viewMode === "tree" || specViewOptions.viewMode === "linear") && (
                <div className="sidebar-spec-toggles">
                  <label className="sidebar-toggle-label">
                    <input
                      type="checkbox"
                      checked={specViewOptions.showBlocking}
                      onChange={(e) =>
                        onSpecViewOptionsChange({
                          ...specViewOptions,
                          showBlocking: e.target.checked,
                        })
                      }
                    />
                    Show Blocking
                  </label>
                  {specViewOptions.viewMode === "tree" && (
                    <label className="sidebar-toggle-label">
                      <input
                        type="checkbox"
                        checked={specViewOptions.showCrossLinks}
                        onChange={(e) =>
                          onSpecViewOptionsChange({
                            ...specViewOptions,
                            showCrossLinks: e.target.checked,
                          })
                        }
                      />
                      Show Cross-Links
                    </label>
                  )}
                  {specViewOptions.viewMode === "linear" && (
                    <label className="sidebar-toggle-label">
                      <input
                        type="checkbox"
                        checked={specViewOptions.showDependsOn}
                        onChange={(e) =>
                          onSpecViewOptionsChange({
                            ...specViewOptions,
                            showDependsOn: e.target.checked,
                          })
                        }
                      />
                      Show depends_on
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="sidebar-workspace">
            <div className="sidebar-workspace-header">
              <div className="sidebar-section-label">WORKSPACE</div>
              <PanelBtn
                icon={<FontAwesomeIcon icon={faArrowsRotate} />}
                title="Refresh workspace"
                onClick={handleRefresh}
                className="sidebar-workspace-refresh"
              />
            </div>
            <div
              className="sidebar-workspace-path sidebar-workspace-path-copyable"
              onClick={() => {
                showToast("Path copied");
                navigator.clipboard?.writeText(workspacePath).catch(() => {});
              }}
              title="Click to copy path"
            >
              {workspacePath}
            </div>
            <div className="sidebar-workspace-stats">
              {itemCount} {itemLabel}
            </div>
          </div>

          {graphMode === "conversations" && (
            <div className="sidebar-files">
              <div className="sidebar-section-label">FILES</div>
              {loading && <div className="sidebar-loading">Loading…</div>}
              {files.map((file) => (
                <div
                  key={file.name}
                  className={`sidebar-file-item ${selectedFile === file.name ? "selected" : ""}`}
                  onClick={() => onSelectFile?.(file.name)}
                >
                  <div className="sidebar-file-name">{file.name}</div>
                  <div className="sidebar-file-meta">
                    <KindBadge kind={file.kind} />
                    <span className="sidebar-file-size">{formatSize(file.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {graphMode === "specifications" && (
            <div className="sidebar-files">
              <div className="sidebar-section-label">SPEC NODES</div>
              {loading && <div className="sidebar-loading">Loading…</div>}
              {specNodes.map((spec) => (
                <div
                  key={spec.node_id}
                  className={`sidebar-spec-item status-${spec.status}${selectedSpecNodeId === spec.node_id ? " selected" : ""}`}
                  onClick={() => onSpecNodeSelect?.(spec.node_id)}
                >
                  <div className="sidebar-spec-id">{spec.node_id}</div>
                  <div className="sidebar-spec-title">{spec.title}</div>
                  <span className={`spec-node-status-badge status-${spec.status}`}>
                    {spec.status}
                  </span>
                  {spec.maturity !== null && (
                    <div className="spec-node-maturity-track sidebar-spec-maturity-track">
                      <div
                        className="spec-node-maturity-fill"
                        style={{ width: `${Math.min(1, Math.max(0, spec.maturity)) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
    </aside>
  );
}

// Export session storage keys so App.tsx can read persisted state on boot
export { MODE_KEY, COLLAPSE_KEY };
