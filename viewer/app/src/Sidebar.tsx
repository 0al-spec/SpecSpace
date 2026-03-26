import { useState, useEffect, useCallback } from "react";
import "./Sidebar.css";

interface FileEntry {
  name: string;
  size: number;
  kind: string;
}

interface SidebarProps {
  onSelectFile?: (fileName: string) => void;
  selectedFile?: string | null;
  onRefresh?: () => void;
}

const COLLAPSE_KEY = "ctxb_sidebar_collapsed";

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

export default function Sidebar({ onSelectFile, selectedFile, onRefresh }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    return sessionStorage.getItem(COLLAPSE_KEY) === "true";
  });
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dialogDir, setDialogDir] = useState("");
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

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }, []);

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
              Graph-first navigation for local conversation lineages.
            </p>
          </div>

          <button
            className="sidebar-refresh"
            onClick={() => {
              fetchFiles();
              onRefresh?.();
            }}
          >
            Refresh workspace
          </button>

          <div className="sidebar-workspace">
            <div className="sidebar-section-label">WORKSPACE</div>
            <div className="sidebar-workspace-path">{dialogDir}</div>
            <div className="sidebar-workspace-stats">
              {files.length} JSON files
            </div>
          </div>

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
        </>
      )}
    </aside>
  );
}
