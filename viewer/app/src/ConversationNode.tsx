import { useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ConversationNodeData } from "./types";
import type { Node } from "@xyflow/react";
import { CompileTargetContext } from "./CompileTargetContext";

type ConversationNodeType = Node<ConversationNodeData, "conversation">;

const kindLabels: Record<string, string> = {
  root: "Root",
  branch: "Branch",
  merge: "Merge",
};

export default function ConversationNode({
  data,
  selected,
}: NodeProps<ConversationNodeType>) {
  const { compileTargetConversationId, compileTargetMessageId } =
    useContext(CompileTargetContext);
  const isCompileTarget =
    compileTargetConversationId === data.conversationId && !compileTargetMessageId;
  const kindClass = data.hasBrokenLineage ? "broken" : data.kind;

  return (
    <div
      className={`conversation-node ${kindClass} ${selected ? "selected" : ""} ${isCompileTarget ? "compile-target" : ""}`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="conversation-node-title">{data.title}</div>
      <div className="conversation-node-meta">
        {kindLabels[data.kind] || data.kind}
      </div>
      <div className="conversation-node-footer">
        <span className="conversation-node-filename">{data.fileName}</span>
        <span className="conversation-node-checkpoints">
          {data.checkpointCount} checkpoints
        </span>
      </div>

      {data.hasBrokenLineage && (
        <div className="conversation-node-warning">
          {data.diagnosticCount
            ? `${data.diagnosticCount} issue${data.diagnosticCount === 1 ? "" : "s"}`
            : "Broken lineage"}
        </div>
      )}

      <button
        className="conversation-node-expand"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleExpand(data.conversationId);
        }}
        title={data.isExpanded ? "Collapse" : "Expand"}
      >
        {data.isExpanded ? "\u25BE" : "\u25B8"}
      </button>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
