import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SpecNodeCard } from "@/entities/spec-node";
import { getSpecGraphNodeFocusPoint } from "../model/focus-point";
import { buildSpecGraphSelection, type SpecGraphSelection } from "../model/selection";
import { toSpecGraphFlowElements, type SpecFlowNode } from "../model/to-flow-elements";
import type { UseSpecGraphState } from "../model/use-spec-graph";
import styles from "./SpecGraphCanvas.module.css";

type Props = {
  state: UseSpecGraphState;
  className?: string;
  selectedNodeId?: string | null;
  onSelectedNodeIdChange?: (nodeId: string | null) => void;
  onSelectionChange?: (selection: SpecGraphSelection | null) => void;
};

function SpecFlowNodeView({ data, selected }: NodeProps<SpecFlowNode>) {
  return (
    <div className={styles.nodeShell}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <SpecNodeCard node={data.spec} selected={selected} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

const nodeTypes = {
  specNode: SpecFlowNodeView,
};

export function SpecGraphCanvas({
  state,
  className,
  selectedNodeId,
  onSelectedNodeIdChange,
  onSelectionChange,
}: Props) {
  return (
    <ReactFlowProvider>
      <SpecGraphCanvasInner
        state={state}
        className={className}
        selectedNodeId={selectedNodeId}
        onSelectedNodeIdChange={onSelectedNodeIdChange}
        onSelectionChange={onSelectionChange}
      />
    </ReactFlowProvider>
  );
}

function SpecGraphCanvasInner({
  state,
  className,
  selectedNodeId,
  onSelectedNodeIdChange,
  onSelectionChange,
}: Props) {
  const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
  const {
    getNode,
    setCenter,
    viewportInitialized,
  } = useReactFlow<SpecFlowNode>();
  const activeSelectedNodeId = selectedNodeId === undefined ? internalSelectedNodeId : selectedNodeId;
  const { nodes: baseNodes, edges } = useMemo(
    () => toSpecGraphFlowElements(state.data),
    [state.data],
  );
  const nodes = useMemo(
    () =>
      baseNodes.map((node) => ({
        ...node,
        selected: node.id === activeSelectedNodeId,
      })),
    [baseNodes, activeSelectedNodeId],
  );
  const selection = useMemo(
    () => buildSpecGraphSelection(state.data, activeSelectedNodeId ?? null),
    [state.data, activeSelectedNodeId],
  );
  const classNames = className ? `${styles.root} ${className}` : styles.root;
  const updateSelectedNodeId = useCallback(
    (nodeId: string | null) => {
      if (selectedNodeId === undefined) setInternalSelectedNodeId(nodeId);
      onSelectedNodeIdChange?.(nodeId);
    },
    [onSelectedNodeIdChange, selectedNodeId],
  );

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [onSelectionChange, selection]);

  useEffect(() => {
    if (activeSelectedNodeId && !selection) updateSelectedNodeId(null);
  }, [activeSelectedNodeId, selection, updateSelectedNodeId]);

  useEffect(() => {
    if (!activeSelectedNodeId || !viewportInitialized) return;

    const selectedNode =
      getNode(activeSelectedNodeId) ??
      baseNodes.find((node) => node.id === activeSelectedNodeId);
    if (!selectedNode) return;

    const focusPoint = getSpecGraphNodeFocusPoint(selectedNode);
    void setCenter(focusPoint.x, focusPoint.y, {
      duration: 360,
      zoom: 0.78,
    });
  }, [activeSelectedNodeId, baseNodes, getNode, setCenter, viewportInitialized]);

  return (
    <section
      className={classNames}
      aria-label="SpecGraph canvas"
      data-testid="spec-graph-canvas"
      data-source={state.source}
    >
      <ReactFlow<SpecFlowNode>
        className={styles.flow}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{ type: "smoothstep" }}
        minZoom={0.08}
        maxZoom={1.6}
        nodesDraggable={false}
        onNodeClick={(_, node) => updateSelectedNodeId(node.id)}
        onPaneClick={() => updateSelectedNodeId(null)}
      >
        <Background gap={28} size={1} />
        <MiniMap
          ariaLabel="SpecGraph minimap"
          className={styles.miniMap}
          position="bottom-left"
          pannable
          zoomable
          nodeBorderRadius={0}
          nodeColor="var(--gs-paper-3)"
          nodeStrokeColor="var(--gs-muted-2)"
          nodeStrokeWidth={1}
          maskColor="rgba(244, 242, 237, 0.68)"
          maskStrokeColor="var(--gs-accent)"
          maskStrokeWidth={1}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </section>
  );
}
