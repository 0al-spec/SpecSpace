import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import "./SpecNode.css";

/** Canonical rendered edge kinds — order determines top-to-bottom slot position */
export const SPEC_HANDLE_KINDS = ["depends_on", "relates_to"] as const;
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

const SLOT_TOPS = slotTops(SPEC_HANDLE_KINDS.length);

export default function SpecNode({
  data,
  selected,
}: NodeProps<SpecNodeType>) {
  const statusClass = `status-${data.status}`;
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;

  return (
    <div
      className={`spec-node ${statusClass} ${selected ? "selected" : ""}`}
    >
      {/* Target handles (left) — one slot per kind, always visible */}
      {SPEC_HANDLE_KINDS.map((kind, i) => {
        const active = data.activeTargetKinds.has(kind);
        return (
          <Handle
            key={`tgt-${kind}`}
            type="target"
            position={Position.Left}
            id={`tgt-${kind}`}
            className={`spec-handle spec-handle-${kind} ${active ? "spec-handle-active" : "spec-handle-potential"}`}
            style={{ top: `${SLOT_TOPS[i]}%` }}
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

      {/* Source handles (right) — one slot per kind, always visible */}
      {SPEC_HANDLE_KINDS.map((kind, i) => {
        const active = data.activeSourceKinds.has(kind);
        return (
          <Handle
            key={`src-${kind}`}
            type="source"
            position={Position.Right}
            id={`src-${kind}`}
            className={`spec-handle spec-handle-${kind} ${active ? "spec-handle-active" : "spec-handle-potential"}`}
            style={{ top: `${SLOT_TOPS[i]}%` }}
            title={active ? `${kind} →` : `potential ${kind} →`}
          />
        );
      })}
    </div>
  );
}
