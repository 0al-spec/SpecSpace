import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SubflowHeaderData } from "./types";
import type { Node } from "@xyflow/react";

type SubflowHeaderType = Node<SubflowHeaderData, "subflowHeader">;

export default function SubflowHeader({
  data,
}: NodeProps<SubflowHeaderType>) {
  return (
    <div className="subflow-header">
      <Handle type="target" position={Position.Left} />
      <span className="subflow-header-title">
        {data.title} ({data.kind})
      </span>
      <button
        className="conversation-node-expand"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleExpand(data.conversationId);
        }}
        title="Collapse"
      >
        {"\u25BE"}
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
