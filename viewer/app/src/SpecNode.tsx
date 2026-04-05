import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import "./SpecNode.css";

export interface SpecNodeData extends Record<string, unknown> {
  nodeId: string;
  title: string;
  kind: string;
  status: string;
  maturity: number | null;
  acceptanceCount: number;
  decisionsCount: number;
  hasBrokenEdges: boolean;
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
      <Handle type="target" position={Position.Left} />

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

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
