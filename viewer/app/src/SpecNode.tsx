import { useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import "./SpecNode.css";

/** All possible handle kinds — order determines top-to-bottom slot position */
export const SPEC_HANDLE_KINDS = ["depends_on", "refines", "relates_to"] as const;
export type SpecHandleKind = typeof SPEC_HANDLE_KINDS[number];

export interface SpecNodeData extends Record<string, unknown> {
  nodeId: string;
  title: string;
  kind: string;
  status: string;
  maturity: number | null;
  acceptanceCount: number;
  decisionsCount: number;
  hasBrokenEdges: boolean;
  /** Number of child specs that refine this node (shown as badge, no edge drawn) */
  refinedByCount: number;
  /** Edge kinds that have ≥1 outgoing edge from this node */
  activeSourceKinds: Set<string>;
  /** Edge kinds that have ≥1 incoming edge to this node */
  activeTargetKinds: Set<string>;
  /** Which handle kinds to render (subset of SPEC_HANDLE_KINDS); mode-dependent */
  visibleHandleKinds: readonly SpecHandleKind[];
  /** Number of unmet acceptance criteria — each rendered as a gap handle on the bottom */
  gapCount: number;
  /** Set when this node is an endpoint of the currently highlighted edge */
  edgeHighlighted?: boolean;
  searchDimmed?: boolean;
  timelineDimmed?: boolean;
  filterDimmed?: boolean;
  /** Whether this spec is currently expanded (sub-items loading or group shown) */
  isExpanded?: boolean;
  /** Callback to toggle expanded/collapsed state */
  onToggleExpand?: (nodeId: string) => void;
  /** Whether this node's branch (descendants) is collapsed */
  isBranchCollapsed?: boolean;
  /** Callback to toggle branch collapsed/expanded */
  onToggleBranch?: (nodeId: string) => void;
  /** Lens overlay style — injected when a lens is active */
  lensStyle?: {
    borderColor?: string;
    background?: string;
    badge?: { text: string; color: string; bg: string };
  };
  /** Briefly true after an SSE reload detected that this node changed */
  isChanged?: boolean;
}

export type SpecNodeType = Node<SpecNodeData, "spec">;

const STATUS_LABELS: Record<string, string> = {
  idea: "idea",
  stub: "stub",
  outlined: "outlined",
  specified: "specified",
  linked: "linked",
  reviewed: "reviewed",
  frozen: "frozen",
};

/** Evenly-spaced top% for N slots */
function slotTops(count: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * 100);
}

export default function SpecNode({
  data,
  selected,
}: NodeProps<SpecNodeType>) {
  const statusClass = `status-${data.status}`;
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;

  const kinds = data.visibleHandleKinds;
  const tops = slotTops(kinds.length);

  const [btnVisible, setBtnVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBtn = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setBtnVisible(true);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setBtnVisible(false), 2000);
  }, []);

  // Preview card — shown after 300 ms hover delay, hidden immediately on leave
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => setPreviewVisible(true), 300);
  }, []);

  const hidePreview = useCallback(() => {
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    setPreviewVisible(false);
  }, []);

  // Clear preview when node becomes selected (inspector opens)
  useEffect(() => { if (selected) hidePreview(); }, [selected, hidePreview]);

  return (
    <div
      className={`spec-node ${statusClass} ${selected ? "selected" : ""} ${data.edgeHighlighted ? "edge-endpoint-highlight" : ""} ${data.searchDimmed || data.timelineDimmed || data.filterDimmed ? "search-dimmed" : ""} ${data.isChanged ? "spec-node--changed" : ""}`}
      onMouseEnter={() => { showBtn(); showPreview(); }}
      onMouseLeave={() => { scheduleHide(); hidePreview(); }}
      style={{
        ...(data.lensStyle?.borderColor ? { borderColor: data.lensStyle.borderColor } : {}),
        ...(data.lensStyle?.background ? { background: data.lensStyle.background } : {}),
      }}
    >
      {/* Target handles (left) — one slot per visible kind */}
      {kinds.map((kind, i) => {
        const active = data.activeTargetKinds.has(kind);
        return (
          <Handle
            key={`tgt-${kind}`}
            type="target"
            position={Position.Left}
            id={`tgt-${kind}`}
            className={`spec-handle spec-handle-${kind} ${active ? "spec-handle-active" : "spec-handle-potential"}`}
            style={{ top: `${tops[i]}%` }}
            title={active ? `← ${kind}` : `potential ← ${kind}`}
          />
        );
      })}

      {/* ID badge */}
      <div className="spec-node-id">{data.nodeId}</div>

      {/* Title */}
      <div className="spec-node-title">{data.title}</div>

      {/* Kind + status badges */}
      <div className="spec-node-meta">
        <span className="spec-node-kind-badge">{data.kind}</span>
        <span className={`spec-node-status-badge ${statusClass}`}>
          {statusLabel}
        </span>
        {data.lensStyle?.badge && (
          <span
            className="spec-node-status-badge spec-node-lens-badge"
            style={{ background: data.lensStyle.badge.bg, color: data.lensStyle.badge.color, border: `1px solid ${data.lensStyle.badge.color === "#fff" ? data.lensStyle.badge.bg : data.lensStyle.badge.color}` }}
          >
            {data.lensStyle.badge.text}
          </span>
        )}
        {data.hasBrokenEdges && (
          <span className="spec-node-status-badge status-stub" title="Broken edge references">
            ⚠ broken
          </span>
        )}
        {data.refinedByCount > 0 && (
          <span
            className="spec-node-status-badge spec-node-refined-by"
            title={`Refined by ${data.refinedByCount} child spec${data.refinedByCount > 1 ? "s" : ""}`}
          >
            ↳ {data.refinedByCount}
          </span>
        )}
      </div>

      {/* Maturity bar */}
      {data.maturity !== null && (
        <div className="spec-node-maturity">
          <div className="spec-node-maturity-label">
            maturity {Math.round(data.maturity * 100)}%
          </div>
          <div className="spec-node-maturity-track">
            <div
              className="spec-node-maturity-fill"
              style={{ width: `${Math.min(1, Math.max(0, data.maturity)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Source handles (right) — one slot per visible kind */}
      {kinds.map((kind, i) => {
        const active = data.activeSourceKinds.has(kind);
        return (
          <Handle
            key={`src-${kind}`}
            type="source"
            position={Position.Right}
            id={`src-${kind}`}
            className={`spec-handle spec-handle-${kind} ${active ? "spec-handle-active" : "spec-handle-potential"}`}
            style={{ top: `${tops[i]}%` }}
            title={active ? `${kind} →` : `potential ${kind} →`}
          />
        );
      })}

      {/* Gap handles (bottom) — one slot per gap */}
      {data.gapCount > 0 && slotTops(data.gapCount).map((pct, i) => (
        <Handle
          key={`gap-${i}`}
          type="source"
          position={Position.Bottom}
          id={`gap-${i}`}
          className="spec-handle spec-handle-gap"
          style={{ left: `${pct}%` }}
          data-tooltip={`gap ${i + 1}/${data.gapCount}`}
        />
      ))}

      {/* Expand/collapse button — shown when node has expandable sub-items */}
      {(data.acceptanceCount > 0 || data.decisionsCount > 0) && data.onToggleExpand && (
        <button
          className={`spec-node-expand${data.isExpanded ? " expanded" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleExpand!(data.nodeId);
          }}
          title={data.isExpanded ? "Collapse sub-items" : "Expand sub-items"}
        >
          {data.isExpanded ? "▾" : "▸"}
        </button>
      )}

      {/* Branch collapse button — shown when node has children */}
      {data.refinedByCount > 0 && data.onToggleBranch && (
        <button
          className="spec-node-branch-btn"
          style={{ opacity: btnVisible ? 1 : 0, pointerEvents: btnVisible ? "auto" : "none" }}
          onMouseEnter={showBtn}
          onMouseLeave={scheduleHide}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleBranch!(data.nodeId);
          }}
          title={data.isBranchCollapsed ? "Expand branch" : "Collapse branch"}
        >
          <FontAwesomeIcon icon={data.isBranchCollapsed ? faChevronRight : faChevronDown} />
        </button>
      )}

      {/* Hover preview card — visible after 300 ms, hidden while selected */}
      {!selected && (
        <div className={`spec-node-preview${previewVisible ? " spec-node-preview--visible" : ""}`}>
          <div className="spec-node-preview-id">{data.nodeId}</div>
          <div className="spec-node-preview-title">{data.title}</div>
          <div className="spec-node-preview-badges">
            <span className="spec-node-kind-badge">{data.kind}</span>
            <span className={`spec-node-status-badge status-${data.status}`}>{data.status}</span>
          </div>
          {data.maturity !== null && (
            <div className="spec-node-maturity spec-node-preview-maturity">
              <div className="spec-node-maturity-track">
                <div
                  className="spec-node-maturity-fill"
                  style={{ width: `${Math.min(1, Math.max(0, data.maturity)) * 100}%` }}
                />
              </div>
            </div>
          )}
          {(data.acceptanceCount > 0 || data.gapCount > 0 || data.decisionsCount > 0) && (
            <div className="spec-node-preview-counters">
              {data.acceptanceCount > 0 && (
                <span className="spec-node-preview-counter">
                  {data.acceptanceCount} criterion{data.acceptanceCount !== 1 ? "a" : ""}
                </span>
              )}
              {data.decisionsCount > 0 && (
                <span className="spec-node-preview-counter">
                  {data.decisionsCount} decision{data.decisionsCount !== 1 ? "s" : ""}
                </span>
              )}
              {data.gapCount > 0 && (
                <span className="spec-node-preview-counter spec-node-preview-counter--gap">
                  ⚠ {data.gapCount} gap{data.gapCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
