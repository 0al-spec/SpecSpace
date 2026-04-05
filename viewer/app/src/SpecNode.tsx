import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import "./SpecNode.css";

export interface SpecEdgeHandle {
  handleId: string;
  edgeKind: string;
  broken: boolean;
}

export interface SpecNodeData extends Record<string, unknown> {
  nodeId: string;
  title: string;
  kind: string;
  status: string;
  maturity: number | null;
  acceptanceCount: number;
  decisionsCount: number;
  hasBrokenEdges: boolean;
  /** One entry per outgoing edge — rendered as source handles on the right */
  sourceHandles: SpecEdgeHandle[];
  /** One entry per incoming edge — rendered as target handles on the left */
  targetHandles: SpecEdgeHandle[];
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

/** Returns evenly-spaced top percentages for n handles */
function handleTops(count: number): number[] {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * 100);
}

export default function SpecNode({
  data,
  selected,
}: NodeProps<SpecNodeType>) {
  const statusClass = `status-${data.status}`;
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;

  const srcTops = handleTops(data.sourceHandles.length);
  const tgtTops = handleTops(data.targetHandles.length);

  return (
    <div
      className={`spec-node ${statusClass} ${selected ? "selected" : ""}`}
    >
      {/* Target handles (left) — one per incoming edge */}
      {data.targetHandles.length > 0
        ? data.targetHandles.map((h, i) => (
            <Handle
              key={h.handleId}
              type="target"
              position={Position.Left}
              id={h.handleId}
              className={`spec-handle ${h.broken ? "spec-handle-broken" : `spec-handle-${h.edgeKind}`}`}
              style={{ top: `${tgtTops[i]}%` }}
            />
          ))
        : <Handle type="target" position={Position.Left} className="spec-handle spec-handle-default" />
      }

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

      {/* Source handles (right) — one per outgoing edge */}
      {data.sourceHandles.length > 0
        ? data.sourceHandles.map((h, i) => (
            <Handle
              key={h.handleId}
              type="source"
              position={Position.Right}
              id={h.handleId}
              className={`spec-handle ${h.broken ? "spec-handle-broken" : `spec-handle-${h.edgeKind}`}`}
              style={{ top: `${srcTops[i]}%` }}
            />
          ))
        : <Handle type="source" position={Position.Right} className="spec-handle spec-handle-default" />
      }
    </div>
  );
}
