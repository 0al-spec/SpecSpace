import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type NodeMouseHandler,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./theme.css";
import "./ConversationNode.css";
import "./MessageNode.css";
import "./SubflowHeader.css";
import ConversationNode from "./ConversationNode";
import MessageNode from "./MessageNode";
import SubflowHeader from "./SubflowHeader";
import Sidebar from "./Sidebar";
import InspectorOverlay from "./InspectorOverlay";
import { useGraphData } from "./useGraphData";
import { useSessionString } from "./useSessionState";

const nodeTypes = {
  conversation: ConversationNode,
  message: MessageNode,
  subflowHeader: SubflowHeader,
};

function loadViewport(): Viewport | undefined {
  try {
    const stored = sessionStorage.getItem("ctxb_viewport");
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return undefined;
}

export default function App() {
  const { nodes, edges, loading, error, refresh } = useGraphData();
  const [selectedConversationId, setSelectedConversationId] =
    useSessionString("selected_conversation");
  const [selectedMessageId, setSelectedMessageId] =
    useSessionString("selected_message");

  const savedViewport = useRef(loadViewport());
  const hasFitView = !savedViewport.current;

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "conversation" || node.type === "group") {
        const convId =
          (node.data as { conversationId?: string }).conversationId || node.id;
        setSelectedConversationId(convId);
        setSelectedMessageId(null);
      } else if (node.type === "message") {
        const msgData = node.data as { messageId?: string };
        const convId = node.parentId || null;
        setSelectedConversationId(convId);
        setSelectedMessageId(msgData.messageId || null);
      } else if (node.type === "subflowHeader") {
        const headerData = node.data as { conversationId?: string };
        setSelectedConversationId(headerData.conversationId || null);
        setSelectedMessageId(null);
      }
    },
    [setSelectedConversationId, setSelectedMessageId],
  );

  const onPaneClick = useCallback(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
  }, [setSelectedConversationId, setSelectedMessageId]);

  const dismissInspector = useCallback(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
  }, [setSelectedConversationId, setSelectedMessageId]);

  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    try {
      sessionStorage.setItem("ctxb_viewport", JSON.stringify(viewport));
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        {loading && (
          <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
            Loading graph…
          </div>
        )}
        {error && (
          <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
            <p>Error loading graph: {error}</p>
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        {!loading && !error && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onMoveEnd={onMoveEnd}
            defaultViewport={savedViewport.current}
            fitView={hasFitView}
          >
            <Background />
            <Controls />
          </ReactFlow>
        )}
      </main>
      <InspectorOverlay
        selectedConversationId={selectedConversationId}
        selectedMessageId={selectedMessageId}
        onDismiss={dismissInspector}
      />
    </div>
  );
}
