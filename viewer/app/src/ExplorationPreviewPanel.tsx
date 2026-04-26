import { useCallback, useEffect, useRef, useState } from "react";
import "./SpecPMExportPreview.css";
import "./ExplorationPreviewPanel.css";
import PanelActions from "./PanelActions";
import type {
  ExplorationPreview,
  ExplorationPreviewNode,
  ExplorationPreviewEdge,
  ExplorationNodeKind,
} from "./explorationPreview";
import { NODE_KIND_COLORS } from "./explorationPreview";

interface Props {
  onClose: () => void;
  buildAvailable: boolean;
}

type PanelState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "building" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; preview: ExplorationPreview; builtAt: string | null };

const REVIEW_STATE_TONE: Record<string, string> = {
  preview_only: "tone-ready",
  blocked: "tone-blocked",
};

const NODE_KIND_LABEL: Record<ExplorationNodeKind, string> = {
  intent: "Intent",
  assumption_cluster: "Assumptions",
  hypothesis_cluster: "Hypotheses",
  proposal_cluster: "Proposals",
  review_gate: "Review Gate",
};

const EDGE_KIND_LABEL: Record<string, string> = {
  structures_assumptions: "structures assumptions",
  raises_hypotheses: "raises hypotheses",
  suggests_proposals: "suggests proposals",
  requires_human_review: "requires human review",
};

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
}

export default function ExplorationPreviewPanel({ onClose, buildAvailable }: Props) {
  const [intent, setIntent] = useState("");
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (buildAvailable) textareaRef.current?.focus();
  }, [buildAvailable]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadExisting = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/exploration-preview");
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setState({
          kind: "error",
          message: typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
        });
        return;
      }
      setState({ kind: "loaded", preview: body.data as ExplorationPreview, builtAt: null });
    } catch (err) {
      setState({ kind: "error", message: String(err) });
    }
  }, []);

  // When build is unavailable, auto-load existing artifact on open.
  useEffect(() => {
    if (!buildAvailable) loadExisting();
  }, [buildAvailable, loadExisting]);

  const handleBuild = useCallback(async () => {
    const trimmed = intent.trim();
    if (!trimmed) return;
    setState({ kind: "building" });
    try {
      const buildRes = await fetch("/api/exploration-preview/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: trimmed }),
      });
      const buildBody = await buildRes.json().catch(() => ({})) as Record<string, unknown>;
      if (!buildRes.ok) {
        const tail =
          typeof buildBody.stderr_tail === "string" && buildBody.stderr_tail
            ? `\n${buildBody.stderr_tail}`
            : "";
        setState({
          kind: "error",
          message:
            typeof buildBody.error === "string"
              ? buildBody.error + tail
              : `Build failed: HTTP ${buildRes.status}${tail}`,
        });
        return;
      }
      const builtAt =
        typeof buildBody.built_at === "string" ? buildBody.built_at : null;

      const getRes = await fetch("/api/exploration-preview");
      const getBody = await getRes.json().catch(() => ({})) as Record<string, unknown>;
      if (!getRes.ok) {
        setState({
          kind: "error",
          message:
            typeof getBody.error === "string"
              ? getBody.error
              : `Failed to load preview: HTTP ${getRes.status}`,
        });
        return;
      }
      setState({
        kind: "loaded",
        preview: getBody.data as ExplorationPreview,
        builtAt,
      });
    } catch (err) {
      setState({ kind: "error", message: String(err) });
    }
  }, [intent]);

  const busy = state.kind === "building" || state.kind === "loading";

  const preview = state.kind === "loaded" ? state.preview : null;
  const boundaryViolation =
    preview &&
    (preview.canonical_mutations_allowed !== false ||
      preview.tracked_artifacts_written !== false ||
      preview.artifact_kind !== "exploration_preview");

  return (
    <div className="specpm-overlay" onClick={onClose}>
      <div className="specpm-panel exploration-panel" onClick={(e) => e.stopPropagation()}>
        <div className="specpm-titlebar">
          <div className="specpm-title">
            <span className="specpm-title-main">Exploration Preview</span>
            <span className="specpm-title-sub">Assumption-mode draft, not canonical</span>
          </div>
          <PanelActions onClose={onClose} />
        </div>

        {!buildAvailable && (
          <div className="exploration-build-unavailable">
            Build unavailable: SpecGraph supervisor does not support{" "}
            <code>--build-exploration-preview</code> in this checkout. Showing existing
            artifact (read-only).
            <button
              className="exploration-reload-btn"
              disabled={busy}
              onClick={loadExisting}
            >
              {busy ? "Loading…" : "Reload"}
            </button>
          </div>
        )}

        {buildAvailable && (
          <div className="exploration-intent-row">
            <textarea
              ref={textareaRef}
              className="exploration-intent-input"
              placeholder="Enter a root intent to generate a preview"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!busy && intent.trim()) handleBuild();
                }
              }}
              rows={3}
              disabled={busy}
            />
            <button
              className="exploration-build-btn"
              disabled={busy || !intent.trim()}
              onClick={handleBuild}
            >
              {busy ? "Building…" : "Build Exploration Preview"}
            </button>
          </div>
        )}

        {state.kind === "error" && (
          <div className="specpm-build-error">
            <strong>Error:</strong>
            <pre>{state.message}</pre>
          </div>
        )}

        {boundaryViolation && (
          <div className="exploration-boundary-warning">
            Boundary violation: this artifact may allow canonical mutations.
            Do not use these results.
          </div>
        )}

        <div className="specpm-body">
          {state.kind === "idle" && (
            <div className="specpm-info">
              Enter a root intent to generate a preview
            </div>
          )}
          {state.kind === "loading" && (
            <div className="specpm-info">Loading existing preview…</div>
          )}
          {state.kind === "building" && (
            <div className="specpm-info">Building preview…</div>
          )}
          {state.kind === "loaded" && preview && !boundaryViolation && (
            <PreviewContent preview={preview} builtAt={state.builtAt} />
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewContent({
  preview,
  builtAt,
}: {
  preview: ExplorationPreview;
  builtAt: string | null;
}) {
  const edgesBySource = preview.edges.reduce<Record<string, ExplorationPreviewEdge[]>>(
    (acc, e) => {
      (acc[e.source] ??= []).push(e);
      return acc;
    },
    {},
  );

  return (
    <>
      <div className="exploration-summary-chips">
        <SummaryChip
          label="status"
          value={preview.review_state}
          tone={REVIEW_STATE_TONE[preview.review_state]}
        />
        <SummaryChip label="input" value={preview.input.input_status} />
        <SummaryChip label="nodes" value={String(preview.node_count)} />
        <SummaryChip label="edges" value={String(preview.edge_count)} />
        {preview.next_gap && (
          <SummaryChip label="next gap" value={preview.next_gap} tone="tone-draft" />
        )}
        {builtAt && (
          <SummaryChip label="built" value={fmtTime(builtAt) ?? builtAt} />
        )}
      </div>

      <div className="exploration-nodes">
        {preview.nodes.map((node) => (
          <NodeCard key={node.id} node={node} edges={edgesBySource[node.id] ?? []} />
        ))}
        {preview.nodes.length === 0 && (
          <div className="specpm-info">
            {preview.input.input_status === "missing_root_intent"
              ? "Root intent required"
              : "No nodes in preview"}
          </div>
        )}
      </div>
    </>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className="specpm-badges-cell">
      <span className="specpm-badge-label">{label}</span>
      <span className={`spec-inspector-tag specpm-tag ${tone ?? ""}`}>{value}</span>
    </span>
  );
}

function NodeCard({
  node,
  edges,
}: {
  node: ExplorationPreviewNode;
  edges: ExplorationPreviewEdge[];
}) {
  const color = NODE_KIND_COLORS[node.kind as ExplorationNodeKind] ?? "var(--cb-text, #1f2937)";
  const kindLabel = NODE_KIND_LABEL[node.kind as ExplorationNodeKind] ?? node.kind;

  return (
    <div className={`exploration-node-card exploration-node-${node.kind}`}>
      <div className="exploration-node-header">
        <span className="exploration-node-kind-badge" style={{ color }}>
          {kindLabel}
        </span>
      </div>
      <div className="exploration-node-label">{node.label}</div>
      {node.text && node.text !== node.label && (
        <div className="exploration-node-text">{node.text}</div>
      )}
      <div className="exploration-node-meta">
        {node.status && <span className="exploration-node-meta-item">{node.status}</span>}
        {node.confidence && node.confidence !== "explicit" && (
          <span className="exploration-node-meta-item">{node.confidence}</span>
        )}
      </div>
      {edges.length > 0 && (
        <div className="exploration-node-edges">
          {edges.map((e, i) => (
            <span key={i} className="exploration-edge-chip">
              → {EDGE_KIND_LABEL[e.edge_kind] ?? e.edge_kind}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
