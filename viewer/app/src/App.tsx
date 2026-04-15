import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  SelectionMode,
  type NodeMouseHandler,
  type EdgeMouseHandler,
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
import ExpandedSpecNode from "./ExpandedSpecNode";
import SpecSubItemNode from "./SpecSubItemNode";
import SpecInspector from "./SpecInspector";
import "./SpecNode.css";
import AgentChat, { AgentChatTrigger } from "./AgentChat";
import SearchPalette from "./SearchPalette";
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
  expandedSpec: ExpandedSpecNode,
  specSubItem: SpecSubItemNode,
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
  if (node.type === "spec" || node.type === "expandedSpec") {
    const status = (node.data as { status?: string }).status ?? "";
    return specStatusColorMap[status] ?? "#9b8ec4";
  }
  if (node.type === "specSubItem") return "#9b8ec4";
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

interface Capabilities {
  specAvailable: boolean;
  compileAvailable: boolean;
}

// Check once at startup which optional features are available
async function checkCapabilities(): Promise<Capabilities> {
  try {
    const res = await fetch("/api/capabilities");
    if (!res.ok) return { specAvailable: false, compileAvailable: false };
    const data = await res.json();
    return {
      specAvailable: Boolean(data.spec_graph),
      compileAvailable: Boolean(data.compile),
    };
  } catch {
    return { specAvailable: false, compileAvailable: false };
  }
}

const DEFAULT_SPEC_VIEW: SpecViewOptions = {
  viewMode: "tree",
  showCrossLinks: false,
  showBlocking: true,
  showDependsOn: true,
};

function AppInner() {
  const [graphMode, setGraphMode] = useState<GraphMode>(loadInitialMode);
  const [specAvailable, setSpecAvailable] = useState(false);
  const [compileAvailable, setCompileAvailable] = useState(false);
  const [specViewOptions, setSpecViewOptions] = useState<SpecViewOptions>(DEFAULT_SPEC_VIEW);

  // Check capabilities once on mount
  useEffect(() => {
    checkCapabilities().then(({ specAvailable, compileAvailable }) => {
      setSpecAvailable(specAvailable);
      setCompileAvailable(compileAvailable);
    });
  }, []);

  // Conversation graph data
  const convGraph = useGraphData();

  // Spec graph data (always fetched so it's ready when mode switches)
  const specGraph = useSpecGraphData(specViewOptions);

  // Choose active graph data by mode
  const activeGraph = graphMode === "conversations" ? convGraph : specGraph;
  const { nodes: graphNodes, edges, loading, error, refresh } = activeGraph;

  const [nodes, setNodes] = useState<Node[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedEdge, setHighlightedEdge] = useState<{ id: string; source: string; target: string } | null>(null);
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string> | null>(null);

  const [selectedConversationId, setSelectedConversationId] =
    useSessionString("selected_conversation");
  const [selectedMessageId, setSelectedMessageId] =
    useSessionString("selected_message");
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null);
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

  const { getNode, setCenter, getZoom } = useReactFlow();

  // Inspector panel width in px (matches SpecInspector.css)
  const INSPECTOR_WIDTH = 440;

  /** Measure the visible canvas area (ReactFlow element minus any open inspector overlay). */
  const getVisibleCanvas = useCallback(() => {
    const canvas = document.querySelector<HTMLElement>(".react-flow");
    const canvasW = canvas?.offsetWidth ?? window.innerWidth;
    const inspectorOpen = !!document.querySelector(
      ".spec-inspector.visible, .inspector-overlay.visible",
    );
    return {
      width: inspectorOpen ? canvasW - INSPECTOR_WIDTH : canvasW,
      offsetX: inspectorOpen ? INSPECTOR_WIDTH : 0,
    };
  }, []);

  /** Pan viewport to center on a world-coordinate point, accounting for
   *  any open inspector panel. */
  const panToPoint = useCallback(
    (cx: number, cy: number, zoom: number, delay = 0) => {
      const run = () => {
        const { offsetX } = getVisibleCanvas();
        setCenter(cx + offsetX / 2 / zoom, cy, { duration: 400, zoom });
      };
      if (delay > 0) setTimeout(run, delay);
      else run();
    },
    [setCenter, getVisibleCanvas],
  );

  /** Pan to a node by ID.
   *  keepZoom=true preserves current zoom (graph clicks);
   *  keepZoom=false (default) zooms to 1.2 (inspector badge, search). */
  const panToNode = useCallback(
    (nodeId: string, delay = 0, keepZoom = false) => {
      const node = getNode(nodeId);
      if (!node) return;
      const nodeW = node.measured?.width ?? 220;
      const nodeH = node.measured?.height ?? 110;
      const cx = node.position.x + nodeW / 2;
      const cy = node.position.y + nodeH / 2;
      const zoom = keepZoom ? (getZoom() || 1) : 1.2;
      panToPoint(cx, cy, zoom, delay);
    },
    [getNode, getZoom, panToPoint],
  );

  /** Fit viewport to show multiple nodes, accounting for sidebar and inspector. */
  const fitNodes = useCallback(
    (nodeIds: string[]) => {
      const rects = nodeIds
        .map(getNode)
        .filter(Boolean)
        .map((n) => {
          const w = n!.measured?.width ?? 220;
          const h = n!.measured?.height ?? 110;
          return { x: n!.position.x, y: n!.position.y, w, h };
        });
      if (rects.length === 0) return;
      const minX = Math.min(...rects.map((r) => r.x));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxX = Math.max(...rects.map((r) => r.x + r.w));
      const maxY = Math.max(...rects.map((r) => r.y + r.h));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const { width: visibleW } = getVisibleCanvas();
      const visibleH = document.querySelector<HTMLElement>(".react-flow")?.offsetHeight ?? window.innerHeight;
      const padding = 80;
      const z = getZoom() || 1;
      const fitZoom = Math.min(
        z,
        (visibleW - padding * 2) / Math.max(contentW, 1),
        (visibleH - padding * 2) / Math.max(contentH, 1),
      );
      panToPoint(cx, cy, fitZoom, 0);
    },
    [getNode, getZoom, getVisibleCanvas, panToPoint],
  );

  /** Select a node (open inspector) and pan to it. */
  const onSpecNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedConversationId(nodeId);
      setSelectedMessageId(null);
      // Defer until inspector has opened so the offset is correct
      panToNode(nodeId, 50);
    },
    [setSelectedConversationId, setSelectedMessageId, panToNode],
  );

  /** Pan to a node without selecting it (no inspector change). */
  const onFocusNode = useCallback(
    (nodeId: string) => {
      panToNode(nodeId);
    },
    [panToNode],
  );

  /** Select a conversation node by file name (sidebar FILES click). */
  const onConversationFileSelect = useCallback(
    (fileName: string) => {
      const node = graphNodes.find(
        (n) => !n.parentId && (n.data as { fileName?: string }).fileName === fileName,
      );
      if (!node) return;
      setSelectedConversationId(node.id);
      setSelectedMessageId(null);
      panToNode(node.id, 50);
    },
    [graphNodes, setSelectedConversationId, setSelectedMessageId, panToNode],
  );

  // Reset local node state when graph mode changes (full reset)
  useEffect(() => {
    setNodes([]);
    setSelectedConversationId(null);
    setSelectedMessageId(null);
  }, [graphMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset node positions (but keep selection) when spec view mode changes
  const prevViewMode = useRef(specViewOptions.viewMode);
  const pendingLayoutSwitch = useRef(false);
  useEffect(() => {
    if (prevViewMode.current !== specViewOptions.viewMode) {
      prevViewMode.current = specViewOptions.viewMode;
      pendingLayoutSwitch.current = true;
      setNodes([]);
    }
  }, [specViewOptions.viewMode]);

  useEffect(() => {
    setNodes((prev) => {
      const applySelection = (n: Node) =>
        selectedConversationId && n.id === selectedConversationId
          ? { ...n, selected: true }
          : n;

      if (prev.length === 0) return graphNodes.map(applySelection);
      const prevPositions = new Map<string, { x: number; y: number }>();
      for (const n of prev) {
        if (!n.parentId) {
          prevPositions.set(n.id, n.position);
        }
      }
      return graphNodes.map((n) => {
        if (n.parentId) return applySelection(n);
        const existing = prevPositions.get(n.id);
        const patched = existing ? { ...n, position: existing } : n;
        return applySelection(patched);
      });
    });
  }, [graphNodes, selectedConversationId]);

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

  // After layout switch: pan to the previously selected node once new nodes render
  useEffect(() => {
    if (!pendingLayoutSwitch.current) return;
    if (nodes.length === 0 || !selectedConversationId) return;
    pendingLayoutSwitch.current = false;
    const target = graphNodes.find((n) => n.id === selectedConversationId);
    if (!target) return;
    const nodeW = 220;
    const nodeH = 110;
    const cx = target.position.x + nodeW / 2;
    const cy = target.position.y + nodeH / 2;
    panToPoint(cx, cy, getZoom() || 1, 100);
  }, [nodes, selectedConversationId, graphNodes, getZoom, panToPoint]);

  // Cmd+K / Ctrl+K toggles search palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onSearchSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId);
      setSelectedMessageId(null);
      panToNode(conversationId, 50);
      setSearchOpen(false);
    },
    [setSelectedConversationId, setSelectedMessageId, panToNode],
  );

  const onSearchSelectSpec = useCallback(
    (nodeId: string) => {
      onSpecNodeSelect(nodeId);
      setSearchOpen(false);
    },
    [onSpecNodeSelect],
  );

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
      // Shift+click: ReactFlow handles multi-selection visually — skip inspector
      if (_event.shiftKey) return;

      // Clicking a free (potential/gap) handle on a spec node → open agent chat
      if (node.type === "spec" || node.type === "expandedSpec") {
        const target = (_event.target as HTMLElement).closest?.(
          ".spec-handle-potential, .spec-handle-gap",
        );
        if (target) {
          setSelectedConversationId(node.id);
          setSelectedMessageId(null);
          setChatOpen(true);
          return;
        }
      }

      if (node.type === "conversation" || node.type === "group") {
        const convId =
          (node.data as { conversationId?: string }).conversationId || node.id;
        setSelectedConversationId(convId);
        setSelectedMessageId(null);
        panToNode(convId, 50, true);
      } else if (node.type === "message") {
        const msgData = node.data as { messageId?: string };
        const convId = node.parentId || null;
        setSelectedConversationId(convId);
        setSelectedMessageId(msgData.messageId || null);
      } else if (node.type === "spec" || node.type === "expandedSpec") {
        setSelectedConversationId(node.id);
        setSelectedMessageId(null);
        setSelectedSubItemId(null);
        panToNode(node.id, 50, true);
      } else if (node.type === "specSubItem") {
        // Select the parent spec for the inspector and highlight the sub-item
        const parentId = node.parentId ?? null;
        const subData = node.data as { subKind?: string; index?: number };
        if (parentId) {
          setSelectedConversationId(parentId);
          setSelectedMessageId(null);
          setSelectedSubItemId(
            subData.subKind != null && subData.index != null
              ? `${subData.subKind}-${subData.index}`
              : null,
          );
          panToNode(parentId, 50, true);
        }
      }
    },
    [setSelectedConversationId, setSelectedMessageId, setSelectedSubItemId, panToNode],
  );

  const displayNodes = useMemo(() => {
    const edgeEndpoints = highlightedEdge
      ? new Set([highlightedEdge.source, highlightedEdge.target])
      : null;
    if (!edgeEndpoints && !searchMatchIds) return nodes;
    return nodes.map((n) => {
      const edgeHl = edgeEndpoints?.has(n.id);
      // For child nodes (messages), match against parent ID
      const matchKey = n.parentId ?? n.id;
      const searchDim = searchMatchIds ? !searchMatchIds.has(matchKey) : false;
      if (!edgeHl && !searchDim) return n;
      return {
        ...n,
        data: {
          ...n.data,
          ...(edgeHl ? { edgeHighlighted: true } : {}),
          ...(searchDim ? { searchDimmed: true } : {}),
        },
      };
    });
  }, [nodes, highlightedEdge, searchMatchIds]);

  const displayEdges = useMemo(() => {
    if (!highlightedEdge) return edges;
    return edges.map((e) =>
      e.id === highlightedEdge.id
        ? { ...e, className: ((e.className ?? "") + " edge-highlight").trim() }
        : e
    );
  }, [edges, highlightedEdge]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setHighlightedEdge((prev) => {
      if (prev?.id === edge.id) return null;
      return { id: edge.id, source: edge.source, target: edge.target };
    });
    fitNodes([edge.source, edge.target]);
  }, [fitNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
    setHighlightedEdge(null);
  }, [setSelectedConversationId, setSelectedMessageId]);

  const onMiniMapClick = useCallback(
    (_event: React.MouseEvent, position: { x: number; y: number }) => {
      const z = getZoom() || 1;
      setCenter(position.x, position.y, { duration: 300, zoom: z });
    },
    [setCenter, getZoom],
  );

  const dismissInspector = useCallback(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
    setSelectedSubItemId(null);
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
          onSpecNodeSelect={onSpecNodeSelect}
          selectedSpecNodeId={graphMode === "specifications" ? selectedConversationId : null}
          onSelectFile={onConversationFileSelect}
          selectedFile={
            graphMode === "conversations" && selectedConversationId
              ? (graphNodes.find((n) => n.id === selectedConversationId)?.data as { fileName?: string })?.fileName ?? null
              : null
          }
        />
        <main className="app-main">
          {/* Initial load spinner — only when there are no nodes yet */}
          {loading && nodes.length === 0 && (
            <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
              Loading graph…
            </div>
          )}
          {error && nodes.length === 0 && (
            <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
              <p>Error loading graph: {error}</p>
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {/* ReactFlow stays mounted during background refreshes to preserve zoom/pan */}
          <ErrorBoundary label="Canvas">
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onMoveEnd={onMoveEnd}
              defaultViewport={savedViewport.current}
              fitView={hasFitView}
              minZoom={0.125}
              style={{ opacity: loading && nodes.length > 0 ? 0.6 : 1, transition: "opacity 150ms" }}
              multiSelectionKeyCode="Shift"
              selectionKeyCode="Shift"
              selectionMode={SelectionMode.Partial}
              edgesFocusable={false}
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={minimapNodeColor}
                maskColor="rgba(236, 227, 212, 0.7)"
                pannable
                zoomable
                onClick={onMiniMapClick}
              />
              <FitViewShortcut />
            </ReactFlow>
          </ErrorBoundary>
        </main>
        {/* Spec inspector */}
        {graphMode === "specifications" && (
          <ErrorBoundary label="SpecInspector">
            <SpecInspector
              selectedNodeId={selectedConversationId}
              selectedSubItemId={selectedSubItemId}
              onDismiss={dismissInspector}
              onFocusNode={onFocusNode}
              onSelectSubItem={setSelectedSubItemId}
            />
          </ErrorBoundary>
        )}

        {/* Conversation inspector */}
        {graphMode === "conversations" && (
          <ErrorBoundary label="InspectorOverlay">
            <InspectorOverlay
              selectedConversationId={selectedConversationId}
              selectedMessageId={selectedMessageId}
              onDismiss={dismissInspector}
              onGraphRefresh={refresh}
              compileTargetConversationId={compileTargetConversationId}
              compileTargetMessageId={compileTargetMessageId}
              onSetCompileTarget={setCompileTarget}
              compileAvailable={compileAvailable}
            />
          </ErrorBoundary>
        )}
        {/* Agent chat */}
        <AgentChatTrigger onClick={() => setChatOpen((v) => !v)} active={chatOpen} />
        <AgentChat
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          contextNodeId={graphMode === "specifications" ? selectedConversationId : null}
        />
        <SearchPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          graphMode={graphMode}
          nodes={nodes}
          onSelectConversation={onSearchSelectConversation}
          onSelectSpec={onSearchSelectSpec}
          onMatchingIdsChange={setSearchMatchIds}
        />
      </div>
    </CompileTargetContext.Provider>
  );
}

export default function App() {
  return (
    <ErrorBoundary label="App">
      <ReactFlowProvider>
        <AppInner />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
