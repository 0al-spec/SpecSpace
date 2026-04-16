import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import "./CollapsedBranchNode.css";

export interface CollapsedBranchNodeData extends Record<string, unknown> {
  collapsedRootId: string;
  count: number;
  onExpand: (nodeId: string) => void;
}

export type CollapsedBranchNodeType = Node<CollapsedBranchNodeData, "collapsedBranch">;

export default function CollapsedBranchNode({ data }: NodeProps<CollapsedBranchNodeType>) {
  return (
    <div
      className="collapsed-branch-node"
      onClick={(e) => {
        e.stopPropagation();
        data.onExpand(data.collapsedRootId);
      }}
      title={`${data.count} hidden node${data.count !== 1 ? "s" : ""} — click to expand`}
    >
      <Handle type="target" position={Position.Left}  id="tgt" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}   id="tgt-top" style={{ opacity: 0 }} />
      <div className="collapsed-branch-count">{data.count}</div>
      <div className="collapsed-branch-label">nodes</div>
      <Handle type="source" position={Position.Right}  id="src" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="src-bottom" style={{ opacity: 0 }} />
    </div>
  );
}
