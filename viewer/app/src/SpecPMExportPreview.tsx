/**
 * SpecPMExportPreview — floating overlay that shows the SpecGraph→SpecPM
 * export preview artifact. Read-only: no actual write to SpecPM.
 *
 * Data source: /api/specpm/preview (GET), /api/specpm/preview/build (POST).
 */
import { useCallback, useEffect, useState } from "react";
import "./PanelBtn.css";
import "./SpecPMExportPreview.css";
import PanelActions from "./PanelActions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate, faHammer } from "@fortawesome/free-solid-svg-icons";

interface Props {
  onClose: () => void;
}

type PreviewEntry = Record<string, unknown> & {
  export_id?: string;
  consumer_id?: string;
  export_status?: string;
  review_state?: string;
  consumer_bridge_state?: string;
  next_gap?: string;
  package_preview?: Record<string, unknown>;
  boundary_source_preview?: Record<string, unknown>;
  missing_fields_for_full_boundary_spec?: unknown;
};

interface PreviewArtifact {
  artifact_kind?: string;
  schema_version?: number;
  generated_at?: string;
  entry_count?: number;
  entries?: PreviewEntry[];
}

interface PreviewResponse {
  preview_path: string;
  mtime: number;
  mtime_iso: string;
  preview: PreviewArtifact;
}

interface BuildResponse {
  exit_code: number | null;
  stderr_tail?: string;
  stdout_tail?: string;
  preview_path?: string | null;
  built_at?: string;
  error?: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string; detail?: string }
  | { kind: "ok"; data: PreviewResponse };

// Tint modifier for .specpm-tag — keeps the depends_on pill shape but
// hints at the export lifecycle with a soft background / border colour.
const STATUS_TONE: Record<string, string> = {
  draft_preview_only:      "tone-draft",
  draft_visible:           "tone-draft",
  draft_reference:         "tone-draft",
  ready_for_review:        "tone-ready",
  invalid_export_contract: "tone-blocked",
  blocked_by_consumer_gap: "tone-blocked",
};

function badgeClass(value?: string): string {
  if (!value) return "";
  return STATUS_TONE[value] || "";
}

export default function SpecPMExportPreview({ onClose }: Props) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/specpm/preview");
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}));
        setState({ kind: "empty", message: body.hint || "Preview not built yet" });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ kind: "error", message: body.error || `HTTP ${res.status}` });
        return;
      }
      const data: PreviewResponse = await res.json();
      setState({ kind: "ok", data });
    } catch (err) {
      setState({ kind: "error", message: String(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const build = useCallback(async () => {
    setBuilding(true);
    setBuildError(null);
    try {
      const res = await fetch("/api/specpm/preview/build", { method: "POST" });
      const body: BuildResponse = await res.json().catch(() => ({} as BuildResponse));
      if (!res.ok) {
        setBuildError(body.error || `HTTP ${res.status}${body.stderr_tail ? `\n${body.stderr_tail}` : ""}`);
      } else {
        await load();
      }
    } catch (err) {
      setBuildError(String(err));
    } finally {
      setBuilding(false);
    }
  }, [load]);

  return (
    <div className="specpm-overlay" onClick={onClose}>
      <div className="specpm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="specpm-titlebar">
          <div className="specpm-title">
            <span className="specpm-title-main">SpecPM Export Preview</span>
            <span className="specpm-title-sub">Boundary Package Preview · read-only</span>
          </div>
          <PanelActions
            extra={[
              {
                icon: building ? <FontAwesomeIcon icon={faRotate} spin /> : <FontAwesomeIcon icon={faHammer} />,
                title: building ? "Building…" : "Rebuild preview",
                onClick: building ? undefined : build,
              },
            ]}
            onClose={onClose}
          />
        </div>

        {buildError && (
          <div className="specpm-build-error">
            <strong>Build failed:</strong>
            <pre>{buildError}</pre>
          </div>
        )}

        <div className="specpm-body">
          {state.kind === "loading" && <div className="specpm-info">Loading…</div>}

          {state.kind === "empty" && (
            <div className="specpm-empty">
              <p>{state.message}</p>
              <button className="specpm-cta" onClick={build} disabled={building}>
                {building ? "Building…" : "Build preview"}
              </button>
            </div>
          )}

          {state.kind === "error" && (
            <div className="specpm-error">
              <strong>Error:</strong> {state.message}
              {state.detail && <pre>{state.detail}</pre>}
            </div>
          )}

          {state.kind === "ok" && <PreviewBody data={state.data} />}
        </div>
      </div>
    </div>
  );
}

function PreviewBody({ data }: { data: PreviewResponse }) {
  const { preview } = data;
  const entries = preview.entries ?? [];
  return (
    <>
      <div className="specpm-meta">
        <div>
          <span className="specpm-meta-label">generated_at</span>
          <span className="specpm-meta-value">{preview.generated_at ?? "—"}</span>
        </div>
        <div>
          <span className="specpm-meta-label">file mtime</span>
          <span className="specpm-meta-value">{data.mtime_iso}</span>
        </div>
        <div>
          <span className="specpm-meta-label">entries</span>
          <span className="specpm-meta-value">{preview.entry_count ?? entries.length}</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="specpm-info">No export entries in preview.</div>
      ) : (
        entries.map((entry, i) => <EntryCard key={entry.export_id ?? i} entry={entry} />)
      )}
    </>
  );
}

function EntryCard({ entry }: { entry: PreviewEntry }) {
  const missing = entry.missing_fields_for_full_boundary_spec;
  const missingList = Array.isArray(missing) ? missing : missing ? [missing] : [];

  return (
    <section className="specpm-entry">
      <header className="specpm-entry-head">
        <div className="specpm-entry-title">
          <code>{entry.export_id ?? "(unnamed)"}</code><span className="specpm-entry-consumer"> -&gt; <code>{String(entry.consumer_id ?? "?")}</code></span>
        </div>
        <div className="specpm-badges">
          <Badge label="export" value={entry.export_status} />
          <Badge label="review" value={entry.review_state} />
          <Badge label="bridge" value={entry.consumer_bridge_state} />
          {entry.next_gap && <Badge label="next gap" value={entry.next_gap as string} />}
        </div>
      </header>

      {missingList.length > 0 && (
        <div className="specpm-section">
          <h4>Missing fields for full boundary spec</h4>
          <ul className="specpm-missing">
            {missingList.map((m, i) => (
              <li key={i}>{typeof m === "string" ? m : JSON.stringify(m)}</li>
            ))}
          </ul>
        </div>
      )}

      <JsonSection title="package_preview" value={entry.package_preview} />
      <JsonSection title="boundary_source_preview" value={entry.boundary_source_preview} />
    </section>
  );
}

function Badge({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="specpm-badges-cell" title={`${label}: ${value}`}>
      <span className="specpm-badge-label">{label}</span>
      <span className={`spec-inspector-tag specpm-tag ${badgeClass(value)}`}>{value}</span>
    </span>
  );
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  const [open, setOpen] = useState(true);
  if (value === undefined || value === null) return null;
  return (
    <div className="specpm-section">
      <h4>
        <button className="specpm-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? "▾" : "▸"} {title}
        </button>
      </h4>
      {open && <pre className="specpm-json">{JSON.stringify(value, null, 2)}</pre>}
    </div>
  );
}
