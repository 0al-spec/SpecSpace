import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
  {
    id: "test-1",
    position: { x: 100, y: 100 },
    data: { label: "ContextBuilder — React Flow" },
    style: {
      background: "#f5f0e8",
      border: "2px solid rgba(93, 139, 88, 0.82)",
      borderRadius: 16,
      padding: "12px 18px",
      fontFamily: "system-ui, sans-serif",
      fontSize: 14,
      fontWeight: 600,
    },
  },
];

const initialEdges: Edge[] = [];

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow nodes={initialNodes} edges={initialEdges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
