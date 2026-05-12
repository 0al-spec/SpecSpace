import type { SpecFlowNode } from "./to-flow-elements";

type FocusableNode = Pick<SpecFlowNode, "position" | "width" | "height"> & {
  measured?: {
    width?: number;
    height?: number;
  };
};

const FALLBACK_NODE_WIDTH = 320;
const FALLBACK_NODE_HEIGHT = 144;

export function getSpecGraphNodeFocusPoint(node: FocusableNode): {
  x: number;
  y: number;
} {
  const width = node.measured?.width ?? node.width ?? FALLBACK_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? FALLBACK_NODE_HEIGHT;

  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}
