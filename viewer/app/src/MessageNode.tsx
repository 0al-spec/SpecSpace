import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MessageNodeData } from "./types";
import type { Node } from "@xyflow/react";

type MessageNodeType = Node<MessageNodeData, "message">;

export default function MessageNode({ data }: NodeProps<MessageNodeType>) {
  const trimmed = (data.content || "").slice(0, 25).replace(/\n/g, " ");
  const label = `${data.role} | ${trimmed}${(data.content || "").length > 25 ? "\u2026" : ""}`;
  const roleClass = data.role === "user" ? "msg-user" : "msg-assistant";

  return (
    <div className={`message-node ${roleClass}`}>
      <Handle type="target" position={Position.Top} />
      <span className="message-node-label">{label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
