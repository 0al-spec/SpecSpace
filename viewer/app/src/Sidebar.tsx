import { useState, useEffect, useCallback } from "react";
import "./Sidebar.css";
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
}

interface SidebarProps {
  onSelectFile?: (fileName: string) => void;
  selectedFile?: string | null;
  onRefresh?: () => void;
  graphMode: GraphMode;
  onGraphModeChange: (mode: GraphMode) => void;
  specAvailable: boolean;
  specViewOptions: SpecViewOptions;
  onSpecViewOptionsChange: (opts: SpecViewOptions) => void;
  onSpecNodeSelect?: (nodeId: string) => void;
  selectedSpecNodeId?: string | null;
}

const COLLAPSE_KEY = "ctxb_sidebar_collapsed";
const MODE_KEY = "ctxb_graph_mode";

const kindColors: Record<string, string> = {
  "canonical-root": "root",
  "canonical-branch": "branch",
  "canonical-merge": "merge",
  root: "root",
  branch: "branch",
  merge: "merge",
  invalid: "broken",
};

const kindLabels: Record<string, string> = {
  "canonical-root": "ROOT",
  "canonical-branch": "BRANCH",
  "canonical-merge": "MERGE",
  root: "ROOT",
  branch: "BRANCH",
  merge: "MERGE",
  invalid: "INVALID",
};

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
  specViewOptions,
  onSpecViewOptionsChange,
  onSpecNodeSelect,
  selectedSpecNodeId,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    return sessionStorage.getItem(COLLAPSE_KEY) === "true";
  });
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
        graphNodes.map((n: { node_id: string; title: string; kind: string; status: string }) => ({
          node_id: n.node_id,
          title: n.title,
          kind: n.kind,
          status: n.status,
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

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }, []);

  const handleModeChange = useCallback(
    (mode: GraphMode) => {
      sessionStorage.setItem(MODE_KEY, mode);
      onGraphModeChange(mode);
    },
    [onGraphModeChange],
  );

  const workspacePath = graphMode === "conversations" ? dialogDir : specDir;
  const itemCount =
    graphMode === "conversations" ? files.length : specNodes.length;
  const itemLabel =
    graphMode === "conversations" ? "JSON files" : "spec nodes";

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <button
        className="sidebar-toggle"
        onClick={toggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "\u2630" : "\u2715"}
      </button>

      {!collapsed && (
        <>
          <div className="sidebar-header">
            <h1 className="sidebar-title">ContextBuilder</h1>
            <p className="sidebar-description">
              {graphMode === "conversations"
                ? "Graph-first navigation for local conversation lineages."
                : "Specification graph viewer."}
            </p>
          </div>

          {/* Mode switcher — only shown when spec support is available */}
          {specAvailable && (
            <div className="sidebar-mode-switcher">
              <button
                className={`sidebar-mode-btn ${graphMode === "conversations" ? "active" : ""}`}
                onClick={() => handleModeChange("conversations")}
                title="Conversation lineage graph"
              >
                Conversations
              </button>
              <button
                className={`sidebar-mode-btn spec-mode ${graphMode === "specifications" ? "active" : ""}`}
                onClick={() => handleModeChange("specifications")}
                title="Specification dependency graph"
              >
                Specs
              </button>
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
                </div>
              )}
            </div>
          )}

          <button className="sidebar-refresh" onClick={handleRefresh}>
            Refresh workspace
          </button>

          <div className="sidebar-workspace">
            <div className="sidebar-section-label">WORKSPACE</div>
            <div className="sidebar-workspace-path">{workspacePath}</div>
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
                  <span
                    className={`sidebar-file-badge ${kindColors[file.kind] || ""}`}
                  >
                    {kindLabels[file.kind] || file.kind.toUpperCase()}
                  </span>
                  <div className="sidebar-file-size">
                    {formatSize(file.size)} | {kindLabels[file.kind] || file.kind}
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
                  className={`sidebar-spec-item${selectedSpecNodeId === spec.node_id ? " selected" : ""}`}
                  onClick={() => onSpecNodeSelect?.(spec.node_id)}
                >
                  <div className="sidebar-spec-id">{spec.node_id}</div>
                  <div className="sidebar-spec-title">{spec.title}</div>
                  <span className="sidebar-file-badge spec">
                    {spec.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

// Export the session storage key so App.tsx can read the persisted mode on boot
export { MODE_KEY };
