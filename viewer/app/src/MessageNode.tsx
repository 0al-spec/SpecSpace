import { useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MessageNodeData } from "./types";
import type { Node } from "@xyflow/react";
import { CompileTargetContext } from "./CompileTargetContext";

type MessageNodeType = Node<MessageNodeData, "message">;

export default function MessageNode({
  data,
  parentId,
}: NodeProps<MessageNodeType>) {
  const { compileTargetConversationId, compileTargetMessageId } =
    useContext(CompileTargetContext);
  const isCompileTarget =
    compileTargetConversationId === parentId &&
    compileTargetMessageId === data.messageId;
  const trimmed = (data.content || "").slice(0, 25).replace(/\n/g, " ");
  const label = `${data.role} | ${trimmed}${(data.content || "").length > 25 ? "\u2026" : ""}`;
  const roleClass = data.role === "user" ? "msg-user" : "msg-assistant";

  return (
    <div className={`message-node ${roleClass} ${isCompileTarget ? "compile-target" : ""}`}>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <span className="message-node-label">{label}</span>
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
}
