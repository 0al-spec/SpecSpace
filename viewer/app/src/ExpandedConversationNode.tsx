import { useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import "./ExpandedConversationNode.css";
import SubflowHeader from "./SubflowHeader";
import type { ExpandedConversationGroupData } from "./types";
import { CompileTargetContext } from "./CompileTargetContext";
import { useLODLevel } from "./useLODLevel";

type ExpandedConversationNodeType = Node<ExpandedConversationGroupData, "group">;

export default function ExpandedConversationNode({
  data,
  selected,
}: NodeProps<ExpandedConversationNodeType>) {
  const { compileTargetConversationId, compileTargetMessageId } =
    useContext(CompileTargetContext);
  const isCompileTarget =
    compileTargetConversationId === data.conversationId && !compileTargetMessageId;
  const kindClass = data.hasBrokenLineage ? "broken" : data.kind;
  const lod = useLODLevel();

  const handles = (
    <>
      <Handle type="target" position={Position.Left} id="left" style={{ top: 18 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ top: 18 }} />
    </>
  );

  if (lod === "minimal") {
    return (
      <div
        className={`expanded-conversation-node expanded-conversation-node--lod-minimal ${kindClass} ${selected ? "selected" : ""} ${isCompileTarget ? "compile-target" : ""}`}
      >
        {handles}
        <div className="subflow-header">
          <span className="subflow-header-title">{data.title}</span>
        </div>
      </div>
    );
  }

  if (lod === "compact") {
    return (
      <div
        className={`expanded-conversation-node expanded-conversation-node--lod-compact ${kindClass} ${selected ? "selected" : ""} ${isCompileTarget ? "compile-target" : ""}`}
      >
        {handles}
        <SubflowHeader data={data} />
      </div>
    );
  }

  return (
    <div
      className={`expanded-conversation-node ${kindClass} ${selected ? "selected" : ""} ${isCompileTarget ? "compile-target" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ top: 18 }}
      />

      <SubflowHeader data={data} />

      {data.hasBrokenLineage && (
        <div className="conversation-node-warning">
          {data.diagnosticCount
            ? `${data.diagnosticCount} issue${data.diagnosticCount === 1 ? "" : "s"}`
            : "Broken lineage"}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ top: 18 }}
      />
    </div>
  );
}
