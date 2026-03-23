import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type NodeMouseHandler,
  type NodeChange,
  type Viewport,
  type Node,
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

const kindColorMap: Record<string, string> = {
  root: "#5d8b58",
  branch: "#4e689b",
  merge: "#b06924",
};

function minimapNodeColor(node: Node): string {
  if (node.type === "group" || node.type === "conversation") {
    const kind = (node.data as { kind?: string }).kind ?? "";
    return kindColorMap[kind] ?? "#b89f7f";
  }
  if (node.type === "message") {
    const role = (node.data as { role?: string }).role;
    return role === "user" ? "#8eaed4" : "#c4a67a";
  }
  return "#b89f7f";
}

function FitViewShortcut() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        fitView({ duration: 300 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitView]);
  return null;
}

function AppInner() {
  const { nodes: graphNodes, edges, loading, error, refresh } = useGraphData();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedConversationId, setSelectedConversationId] =
    useSessionString("selected_conversation");
  const [selectedMessageId, setSelectedMessageId] =
    useSessionString("selected_message");

  useEffect(() => {
    setNodes((prev) => {
      if (prev.length === 0) return graphNodes;
      // Build lookup of current top-level node positions to preserve drag state
      const prevPositions = new Map<string, { x: number; y: number }>();
      for (const n of prev) {
        if (!n.parentId) {
          prevPositions.set(n.id, n.position);
        }
      }
      return graphNodes.map((n) => {
        if (n.parentId) return n; // child nodes use relative positions
        const existing = prevPositions.get(n.id);
        return existing ? { ...n, position: existing } : n;
      });
    });
  }, [graphNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [],
  );

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
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onMoveEnd={onMoveEnd}
            defaultViewport={savedViewport.current}
            fitView={hasFitView}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={minimapNodeColor}
              maskColor="rgba(236, 227, 212, 0.7)"
              pannable
              zoomable
            />
            <FitViewShortcut />
          </ReactFlow>
        )}
      </main>
      <InspectorOverlay
        selectedConversationId={selectedConversationId}
        selectedMessageId={selectedMessageId}
        onDismiss={dismissInspector}
        onGraphRefresh={refresh}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
