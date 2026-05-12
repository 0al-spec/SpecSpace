import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SpecNodeCard } from "@/entities/spec-node";
import { toSpecGraphFlowElements, type SpecFlowNode } from "../model/to-flow-elements";
import { useSpecGraph } from "../model/use-spec-graph";
import styles from "./SpecGraphCanvas.module.css";

type Props = {
  className?: string;
  refreshKey?: number;
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

export function SpecGraphCanvas({ className, refreshKey = 0 }: Props) {
  const state = useSpecGraph({ refreshKey });
  const { nodes, edges } = useMemo(
    () => toSpecGraphFlowElements(state.data),
    [state.data],
  );
  const classNames = className ? `${styles.root} ${className}` : styles.root;

  return (
    <section
      className={classNames}
      aria-label="SpecGraph canvas"
      data-testid="spec-graph-canvas"
      data-source={state.source}
    >
      <ReactFlowProvider>
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
        >
          <Background gap={28} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </section>
  );
}
