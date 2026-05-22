import {
  SPEC_FLOW_NODE_INITIAL_HEIGHT,
  SPEC_FLOW_NODE_INITIAL_WIDTH,
  type SpecFlowNode,
} from "./to-flow-elements";

type FocusableNode = Pick<SpecFlowNode, "position" | "width" | "height"> & {
  measured?: {
    width?: number;
    height?: number;
  };
};

export type SpecGraphFocusBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getSpecGraphNodeFocusPoint(node: FocusableNode): {
  x: number;
  y: number;
} {
  const width = node.measured?.width ?? node.width ?? SPEC_FLOW_NODE_INITIAL_WIDTH;
  const height =
    node.measured?.height ?? node.height ?? SPEC_FLOW_NODE_INITIAL_HEIGHT;

  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

export function getSpecGraphEdgeEndpointBounds(
  sourceNode: FocusableNode | null | undefined,
  targetNode: FocusableNode | null | undefined,
): SpecGraphFocusBounds | null {
  if (!sourceNode || !targetNode) return null;

  const sourceBounds = getSpecGraphNodeBounds(sourceNode);
  const targetBounds = getSpecGraphNodeBounds(targetNode);
  const left = Math.min(sourceBounds.x, targetBounds.x);
  const top = Math.min(sourceBounds.y, targetBounds.y);
  const right = Math.max(
    sourceBounds.x + sourceBounds.width,
    targetBounds.x + targetBounds.width,
  );
  const bottom = Math.max(
    sourceBounds.y + sourceBounds.height,
    targetBounds.y + targetBounds.height,
  );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getSpecGraphNodeBounds(node: FocusableNode): SpecGraphFocusBounds {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? SPEC_FLOW_NODE_INITIAL_WIDTH,
    height:
      node.measured?.height ?? node.height ?? SPEC_FLOW_NODE_INITIAL_HEIGHT,
  };
}
