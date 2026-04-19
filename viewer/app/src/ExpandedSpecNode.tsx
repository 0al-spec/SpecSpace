import { useState, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import "./ExpandedSpecNode.css";
import type { SpecHandleKind } from "./SpecNode";

export interface ExpandedSpecGroupData extends Record<string, unknown> {
  nodeId: string;
  title: string;
  kind: string;
  status: string;
  maturity: number | null;
  hasBrokenEdges: boolean;
  refinedByCount: number;
  onToggleExpand: (nodeId: string) => void;
  visibleHandleKinds: readonly SpecHandleKind[];
  activeSourceKinds: Set<string>;
  activeTargetKinds: Set<string>;
  isBranchCollapsed?: boolean;
  onToggleBranch?: (nodeId: string) => void;
}

export type ExpandedSpecNodeType = Node<ExpandedSpecGroupData, "expandedSpec">;

const STATUS_LABELS: Record<string, string> = {
  idea: "idea", stub: "stub", outlined: "outlined", specified: "specified",
  linked: "linked", reviewed: "reviewed", frozen: "frozen",
};

/** Evenly-spaced top% for N handle slots within the top 50% of the node height */
function handleTops(count: number): number[] {
  const areaFrac = 0.5;
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * areaFrac * 100);
}

export default function ExpandedSpecNode({ data, selected }: NodeProps<ExpandedSpecNodeType>) {
  const statusClass = `status-${data.status}`;
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;
  const kinds = data.visibleHandleKinds;
  const tops = handleTops(kinds.length);

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

  return (
    <div
      className={`expanded-spec-node ${statusClass} ${selected ? "selected" : ""}`}
      onMouseEnter={showBtn}
      onMouseLeave={scheduleHide}
    >
      {/* Target handles (left) — same IDs as collapsed SpecNode for seamless edge routing */}
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

      {/* Collapse button — top-right, always visible */}
      <button
        className="expanded-spec-node-collapse"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleExpand(data.nodeId);
        }}
        title="Collapse"
      >
        ▾
      </button>

      {/* ── Same content as collapsed SpecNode ── */}
      <div className="expanded-spec-node-body">
        {/* ID badge */}
        <div className="spec-node-id">{data.nodeId}</div>

        {/* Title */}
        <div className="spec-node-title">{data.title}</div>

        {/* Kind + status badges */}
        <div className="spec-node-meta">
          <span className="spec-node-kind-badge">{data.kind}</span>
          <span className={`spec-node-status-badge ${statusClass}`}>{statusLabel}</span>
          {data.hasBrokenEdges && (
            <span className="spec-node-status-badge status-stub" title="Broken edge references">⚠ broken</span>
          )}
          {data.refinedByCount > 0 && (
            <span className="spec-node-status-badge spec-node-refined-by" title={`Refined by ${data.refinedByCount} child spec${data.refinedByCount > 1 ? "s" : ""}`}>
              ↳ {data.refinedByCount}
            </span>
          )}
        </div>

        {/* Maturity bar */}
        {data.maturity !== null && (
          <div className="spec-node-maturity">
            <div className="spec-node-maturity-label">maturity {Math.round(data.maturity * 100)}%</div>
            <div className="spec-node-maturity-track">
              <div
                className="spec-node-maturity-fill"
                style={{ width: `${Math.min(1, Math.max(0, data.maturity)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Divider before sub-items */}
        <div className="expanded-spec-node-divider" />
      </div>

      {/* Source handles (right) — same IDs as collapsed SpecNode */}
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
    </div>
  );
}
