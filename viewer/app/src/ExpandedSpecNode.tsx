import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import "./ExpandedSpecNode.css";
import type { SpecHandleKind } from "./SpecNode";

export interface ExpandedSpecGroupData extends Record<string, unknown> {
  nodeId: string;
  title: string;
  status: string;
  onToggleExpand: (nodeId: string) => void;
  visibleHandleKinds: readonly SpecHandleKind[];
  activeSourceKinds: Set<string>;
  activeTargetKinds: Set<string>;
}

export type ExpandedSpecNodeType = Node<ExpandedSpecGroupData, "expandedSpec">;

/** Evenly-spaced top% for N slots in the handle area (top 60% of node) */
function handleTops(count: number): number[] {
  const areaFrac = 0.5; // handles occupy top 50% of the group height
  return Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * areaFrac * 100);
}

export default function ExpandedSpecNode({ data, selected }: NodeProps<ExpandedSpecNodeType>) {
  const statusClass = `status-${data.status}`;
  const kinds = data.visibleHandleKinds;
  const tops = handleTops(kinds.length);

  return (
    <div className={`expanded-spec-node ${statusClass} ${selected ? "selected" : ""}`}>
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

      {/* Header */}
      <div className="expanded-spec-node-header">
        <span className="expanded-spec-node-id">{data.nodeId}</span>
        <span className="expanded-spec-node-title">{data.title}</span>
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
    </div>
  );
}
