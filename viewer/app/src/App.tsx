import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./theme.css";
import "./ConversationNode.css";
import "./MessageNode.css";
import "./SubflowHeader.css";
import ConversationNode from "./ConversationNode";
import MessageNode from "./MessageNode";
import SubflowHeader from "./SubflowHeader";
import { useGraphData } from "./useGraphData";

const nodeTypes = {
  conversation: ConversationNode,
  message: MessageNode,
  subflowHeader: SubflowHeader,
};

export default function App() {
  const { nodes, edges, loading, error, refresh } = useGraphData();

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
        Loading graph…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
        <p>Error loading graph: {error}</p>
        <button onClick={refresh}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
