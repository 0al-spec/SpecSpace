import { useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ConversationNodeData } from "./types";
import type { Node } from "@xyflow/react";
import { CompileTargetContext } from "./CompileTargetContext";
import KindBadge from "./KindBadge";

type ConversationNodeType = Node<ConversationNodeData, "conversation">;


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
      className={`conversation-node ${kindClass} ${selected ? "selected" : ""} ${isCompileTarget ? "compile-target" : ""} ${(data as ConversationNodeData & { searchDimmed?: boolean }).searchDimmed ? "search-dimmed" : ""}`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="conversation-node-title">{data.title}</div>
      <div className="conversation-node-meta">
        <KindBadge kind={data.hasBrokenLineage ? "invalid" : data.kind} />
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
