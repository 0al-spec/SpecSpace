import type { NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import "./SpecSubItemNode.css";

export interface SpecSubItemNodeData extends Record<string, unknown> {
  subKind: "acceptance" | "decision" | "invariant";
  index: number;
  label: string;
  met?: boolean;
}

export type SpecSubItemNodeType = Node<SpecSubItemNodeData, "specSubItem">;

const KIND_LABELS: Record<SpecSubItemNodeData["subKind"], string> = {
  acceptance: "AC",
  decision: "DEC",
  invariant: "INV",
};

export default function SpecSubItemNode({ data, selected }: NodeProps<SpecSubItemNodeType>) {
  return (
    <div
      className={[
        "spec-sub-item-node",
        `spec-sub-item-${data.subKind}`,
        selected ? "selected" : "",
        data.met ? "met" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="spec-sub-item-kind">{KIND_LABELS[data.subKind]}</span>
      <span className="spec-sub-item-label">{data.label}</span>
    </div>
  );
}
