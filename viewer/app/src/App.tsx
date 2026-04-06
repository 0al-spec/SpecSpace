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
import ConversationNode from "./ConversationNode";
import ExpandedConversationNode from "./ExpandedConversationNode";
import MessageNode from "./MessageNode";
import SpecNode from "./SpecNode";
import SpecInspector from "./SpecInspector";
import "./SpecNode.css";
import Sidebar, { MODE_KEY } from "./Sidebar";
import InspectorOverlay from "./InspectorOverlay";
import { useGraphData } from "./useGraphData";
import { useSpecGraphData } from "./useSpecGraphData";
import { useSessionString } from "./useSessionState";
import { CompileTargetContext } from "./CompileTargetContext";
import type { GraphMode, SpecViewOptions } from "./types";

const nodeTypes = {
  conversation: ConversationNode,
  group: ExpandedConversationNode,
  message: MessageNode,
  spec: SpecNode,
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

function loadInitialMode(): GraphMode {
  try {
    const stored = sessionStorage.getItem(MODE_KEY);
    if (stored === "specifications") return "specifications";
  } catch {
    // ignore
  }
  return "conversations";
}

const kindColorMap: Record<string, string> = {
  root: "#5d8b58",
  branch: "#4e689b",
  merge: "#b06924",
};

const specStatusColorMap: Record<string, string> = {
  idea: "#b0b0b0",
  stub: "#c8a72a",
  outlined: "#4e82b8",
  specified: "#6e5ab8",
  linked: "#3e9a58",
  reviewed: "#2a7c7c",
  frozen: "#4a5568",
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
  if (node.type === "spec") {
    const status = (node.data as { status?: string }).status ?? "";
    return specStatusColorMap[status] ?? "#9b8ec4";
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

// Check once at startup if spec support is available
async function checkSpecAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/capabilities");
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.spec_graph);
  } catch {
    return false;
  }
}

const DEFAULT_SPEC_VIEW: SpecViewOptions = {
  viewMode: "tree",
  showCrossLinks: false,
  showBlocking: true,
};

function AppInner() {
  const [graphMode, setGraphMode] = useState<GraphMode>(loadInitialMode);
  const [specAvailable, setSpecAvailable] = useState(false);
  const [specViewOptions, setSpecViewOptions] = useState<SpecViewOptions>(DEFAULT_SPEC_VIEW);

  // Check capabilities once on mount
  useEffect(() => {
    checkSpecAvailable().then(setSpecAvailable);
  }, []);

  // Conversation graph data
  const convGraph = useGraphData();

  // Spec graph data (always fetched so it's ready when mode switches)
  const specGraph = useSpecGraphData(specViewOptions);

  // Choose active graph data by mode
  const activeGraph = graphMode === "conversations" ? convGraph : specGraph;
  const { nodes: graphNodes, edges, loading, error, refresh } = activeGraph;

  const [nodes, setNodes] = useState<Node[]>([]);

  const [selectedConversationId, setSelectedConversationId] =
    useSessionString("selected_conversation");
  const [selectedMessageId, setSelectedMessageId] =
    useSessionString("selected_message");
  const [compileTargetConversationId, setCompileTargetConversationId] =
    useSessionString("compile_target_conversation_id");
  const [compileTargetMessageId, setCompileTargetMessageId] =
    useSessionString("compile_target_message_id");

  const setCompileTarget = useCallback(
    (convId: string | null, msgId: string | null) => {
      setCompileTargetConversationId(convId);
      setCompileTargetMessageId(msgId);
    },
    [setCompileTargetConversationId, setCompileTargetMessageId],
  );

  // Reset local node state when mode changes
  useEffect(() => {
    setNodes([]);
    setSelectedConversationId(null);
    setSelectedMessageId(null);
  }, [graphMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNodes((prev) => {
      if (prev.length === 0) return graphNodes;
      const prevPositions = new Map<string, { x: number; y: number }>();
      for (const n of prev) {
        if (!n.parentId) {
          prevPositions.set(n.id, n.position);
        }
      }
      return graphNodes.map((n) => {
        if (n.parentId) return n;
        const existing = prevPositions.get(n.id);
        return existing ? { ...n, position: existing } : n;
      });
    });
  }, [graphNodes]);

  // Clear stale selection
  useEffect(() => {
    if (!selectedConversationId || graphNodes.length === 0) return;
    const ids = new Set(
      graphNodes.filter((n) => !n.parentId).map((n) => n.id),
    );
    if (!ids.has(selectedConversationId)) {
      setSelectedConversationId(null);
      setSelectedMessageId(null);
    }
  }, [graphNodes, selectedConversationId, setSelectedConversationId, setSelectedMessageId]);

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
      } else if (node.type === "spec") {
        // In spec mode, use the node id as the "selected conversation" so the
        // inspector (future T7) can show spec detail.
        setSelectedConversationId(node.id);
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
    <CompileTargetContext.Provider
      value={{ compileTargetConversationId, compileTargetMessageId }}
    >
      <div className="app-layout">
        <Sidebar
          onRefresh={refresh}
          graphMode={graphMode}
          onGraphModeChange={setGraphMode}
          specAvailable={specAvailable}
          specViewOptions={specViewOptions}
          onSpecViewOptionsChange={setSpecViewOptions}
        />
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
              minZoom={0.125}
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
        {/* Spec inspector */}
        {graphMode === "specifications" && (
          <SpecInspector
            selectedNodeId={selectedConversationId}
            onDismiss={dismissInspector}
          />
        )}

        {/* Conversation inspector */}
        {graphMode === "conversations" && (
          <InspectorOverlay
            selectedConversationId={selectedConversationId}
            selectedMessageId={selectedMessageId}
            onDismiss={dismissInspector}
            onGraphRefresh={refresh}
            compileTargetConversationId={compileTargetConversationId}
            compileTargetMessageId={compileTargetMessageId}
            onSetCompileTarget={setCompileTarget}
          />
        )}
      </div>
    </CompileTargetContext.Provider>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
