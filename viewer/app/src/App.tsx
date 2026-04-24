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
import CollapsedBranchNode from "./CollapsedBranchNode";
import SpecInspector from "./SpecInspector";
import SpecLens from "./SpecLens.tsx";
import SpecPMExportPreview from "./SpecPMExportPreview.tsx";
import SpecForceGraph from "./SpecForceGraph";
import "./SpecNode.css";
import AgentChat, { AgentChatTrigger } from "./AgentChat";
import SearchPalette from "./SearchPalette";
import Sidebar, { MODE_KEY, COLLAPSE_KEY } from "./Sidebar";
import InspectorOverlay from "./InspectorOverlay";
import { useGraphData } from "./useGraphData";
import { useSpecGraphData } from "./useSpecGraphData";
import { useSessionString } from "./useSessionState";
import { useNavHistory } from "./useNavHistory";
import { CompileTargetContext } from "./CompileTargetContext";
import TimelineFilter, { type TimelineField } from "./TimelineFilter";
import FilterBar, { type FilterOptions, type FilterStatus, DEFAULT_FILTER, isFilterActive } from "./FilterBar";
import PanelBtn from "./PanelBtn";
import "./PanelBtn.css";
import { ToastProvider } from "./Toast";
import GraphDashboard from "./GraphDashboard";
import { useSpecOverlayData } from "./useSpecOverlayData";
import { lensStyleFor } from "./specLens";
import type { SpecLensMode } from "./types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faBars, faFilter } from "@fortawesome/free-solid-svg-icons";
import type { GraphMode, SpecViewOptions } from "./types";

const nodeTypes = {
  conversation: ConversationNode,
  group: ExpandedConversationNode,
  message: MessageNode,
  spec: SpecNode,
  expandedSpec: ExpandedSpecNode,
  specSubItem: SpecSubItemNode,
  collapsedBranch: CollapsedBranchNode,
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
  const d = node.data as {
    kind?: string; status?: string; role?: string;
    searchDimmed?: boolean; timelineDimmed?: boolean; filterDimmed?: boolean;
  };
  if (d.searchDimmed || d.timelineDimmed || d.filterDimmed) return "rgba(180,180,180,0.18)";
  if (node.type === "group" || node.type === "conversation") {
    return kindColorMap[d.kind ?? ""] ?? "#b89f7f";
  }
  if (node.type === "message") {
    return d.role === "user" ? "#8eaed4" : "#c4a67a";
  }
  if (node.type === "spec" || node.type === "expandedSpec") {
    return specStatusColorMap[d.status ?? ""] ?? "#9b8ec4";
  }
  if (node.type === "specSubItem") return "#9b8ec4";
  if (node.type === "collapsedBranch") return "#4e689b";
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
  dashboardAvailable: boolean;
  specOverlayAvailable: boolean;
  specpmPreviewAvailable: boolean;
  agentAvailable: boolean;
}

// Check once at startup which optional features are available
async function checkCapabilities(): Promise<Capabilities> {
  try {
    const res = await fetch("/api/capabilities");
    if (!res.ok) return { specAvailable: false, compileAvailable: false, dashboardAvailable: false, specOverlayAvailable: false, specpmPreviewAvailable: false, agentAvailable: false };
    const data = await res.json();
    return {
      specAvailable: Boolean(data.spec_graph),
      compileAvailable: Boolean(data.compile),
      dashboardAvailable: Boolean(data.graph_dashboard),
      specOverlayAvailable: Boolean(data.spec_overlay),
      specpmPreviewAvailable: Boolean(data.specpm_preview),
      agentAvailable: Boolean(data.agent),
    };
  } catch {
    return { specAvailable: false, compileAvailable: false, dashboardAvailable: false, specOverlayAvailable: false, specpmPreviewAvailable: false, agentAvailable: false };
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
  const [dashboardAvailable, setDashboardAvailable] = useState(false);
  const [specOverlayAvailable, setSpecOverlayAvailable] = useState(false);
  const [specpmPreviewAvailable, setSpecpmPreviewAvailable] = useState(false);
  const [agentAvailable, setAgentAvailable] = useState(false);
  const [specpmPreviewOpen, setSpecpmPreviewOpen] = useState(false);
  const [specLens, setSpecLens] = useState<SpecLensMode>("none");
  const [specViewOptions, setSpecViewOptions] = useState<SpecViewOptions>(DEFAULT_SPEC_VIEW);

  // Check capabilities once on mount
  useEffect(() => {
    checkCapabilities().then(({ specAvailable, compileAvailable, dashboardAvailable, specOverlayAvailable, specpmPreviewAvailable, agentAvailable }) => {
      setSpecAvailable(specAvailable);
      setCompileAvailable(compileAvailable);
      setDashboardAvailable(dashboardAvailable);
      setSpecOverlayAvailable(specOverlayAvailable);
      setSpecpmPreviewAvailable(specpmPreviewAvailable);
      setAgentAvailable(agentAvailable);
    });
  }, []);

  // Conversation graph data
  const convGraph = useGraphData();

  // Spec graph data (always fetched so it's ready when mode switches)
  const specGraph = useSpecGraphData(specViewOptions);

  // Fetch spec overlay data (health / implementation / evidence planes)
  const { overlays: specOverlays } = useSpecOverlayData(specOverlayAvailable);

  // Choose active graph data by mode
  const activeGraph = graphMode === "conversations" ? convGraph : specGraph;
  const { nodes: graphNodes, edges, loading, error, refresh } = activeGraph;

  const [nodes, setNodes] = useState<Node[]>([]);

  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedEdge, setHighlightedEdge] = useState<{ id: string; source: string; target: string } | null>(null);
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string> | null>(null);

  // ── Filter bar ────────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(DEFAULT_FILTER);

  // ── Sidebar collapse ─────────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return sessionStorage.getItem(COLLAPSE_KEY) === "true";
  });
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }, []);

  // ── Timeline filter ───────────────────────────────────────────────────────
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineField, setTimelineField] = useState<TimelineField>("updated_at");
  const [timelineRange, setTimelineRange] = useState<[number, number] | null>(null);

  const [selectedConversationId, setSelectedConversationId] =
    useSessionString("selected_conversation");
  const [selectedMessageId, setSelectedMessageId] =
    useSessionString("selected_message");
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null);
  const [lensNodeId, setLensNodeId] = useState<string | null>(null);

  // ── Spec navigation history ───────────────────────────────────────────────
  // One shared stack for now; architecture supports multiple independent
  // stacks (just call useNavHistory() again in a future refactor).
  const specNav = useNavHistory<string>();
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

  /**
   * Navigate to a spec node — the single choke-point for all spec navigation.
   * Pushes to history by default; pass addToHistory=false when the caller
   * already moved the history pointer (back / forward).
   */
  const navigateToSpec = useCallback(
    (nodeId: string, { addToHistory = true } = {}) => {
      if (addToHistory) specNav.push(nodeId);
      setSelectedConversationId(nodeId);
      setSelectedMessageId(null);
      setSelectedSubItemId(null);
      panToNode(nodeId, 50);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specNav.push, setSelectedConversationId, setSelectedMessageId, setSelectedSubItemId, panToNode],
  );

  /** Kept as alias so existing call-sites in this file don't all need renaming. */
  const onSpecNodeSelect = navigateToSpec;

  /** Navigate to a spec node from an inspector badge / FieldList chip.
   *  Previously only panned; now also selects and records history. */
  const onFocusNode = useCallback(
    (nodeId: string) => { navigateToSpec(nodeId); },
    [navigateToSpec],
  );

  /** Go back one step in spec history. */
  const onSpecNavBack = useCallback(() => {
    const id = specNav.back();
    if (!id) return;
    setSelectedConversationId(id);
    setSelectedMessageId(null);
    setSelectedSubItemId(null);
    panToNode(id, 50);
  }, [specNav, setSelectedConversationId, setSelectedMessageId, setSelectedSubItemId, panToNode]);

  /** Go forward one step in spec history. */
  const onSpecNavForward = useCallback(() => {
    const id = specNav.forward();
    if (!id) return;
    setSelectedConversationId(id);
    setSelectedMessageId(null);
    setSelectedSubItemId(null);
    panToNode(id, 50);
  }, [specNav, setSelectedConversationId, setSelectedMessageId, setSelectedSubItemId, panToNode]);

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

  // Clear selection when graph mode changes. Do NOT clear `nodes` here:
  // spec and dashboard share the same underlying specGraph, so graphNodes
  // keeps the same reference and the repopulation effect below would not
  // re-fire — leaving the canvas empty after Specs → Dashboard → Specs.
  // The repopulation effect handles real graph swaps (conv ↔ spec) via its
  // `graphNodes` dep; node IDs don't overlap so positions won't bleed over.
  useEffect(() => {
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

  // Alt+ArrowLeft / Alt+ArrowRight — spec history back / forward
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || graphMode !== "specifications") return;
      if (e.key === "ArrowLeft")  { e.preventDefault(); onSpecNavBack(); }
      if (e.key === "ArrowRight") { e.preventDefault(); onSpecNavForward(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [graphMode, onSpecNavBack, onSpecNavForward]);

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
          if (agentAvailable) setChatOpen(true);
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
        navigateToSpec(node.id);
        panToNode(node.id, 50, true); // keepZoom=true for canvas clicks
      } else if (node.type === "specSubItem") {
        // Select the parent spec for the inspector and highlight the sub-item
        const parentId = node.parentId ?? null;
        const subData = node.data as { subKind?: string; index?: number };
        if (parentId) {
          navigateToSpec(parentId);
          setSelectedSubItemId(
            subData.subKind != null && subData.index != null
              ? `${subData.subKind}-${subData.index}`
              : null,
          );
          panToNode(parentId, 50, true);
        }
      }
    },
    [navigateToSpec, setSelectedConversationId, setSelectedMessageId, setSelectedSubItemId, panToNode],
  );

  // ── Spec nav tooltip labels ───────────────────────────────────────────────
  const specNavLabel = useCallback(
    (id: string | null) => {
      if (!id) return "";
      const node = specGraph.rawGraph?.nodes.find((n) => n.node_id === id);
      return node ? `${id} — ${node.title}` : id;
    },
    [specGraph.rawGraph],
  );
  const specNavBackLabel    = specNavLabel(specNav.peek(-1));
  const specNavForwardLabel = specNavLabel(specNav.peek(+1));

  // ── Timeline computed values ──────────────────────────────────────────────
  const timelineFullRange = useMemo((): [number, number] | null => {
    if (!specGraph.rawGraph) return null;
    const timestamps = specGraph.rawGraph.nodes
      .map((n) => n[timelineField])
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => new Date(v).getTime())
      .filter((t) => !isNaN(t));
    if (timestamps.length === 0) return null;
    return [Math.min(...timestamps), Math.max(...timestamps)];
  }, [specGraph.rawGraph, timelineField]);

  const timelineMatchIds = useMemo((): Set<string> | null => {
    if (!timelineOpen || !timelineRange || !specGraph.rawGraph) return null;
    const [minTs, maxTs] = timelineRange;
    return new Set(
      specGraph.rawGraph.nodes
        .filter((n) => {
          const v = n[timelineField];
          if (!v) return true; // no date → always shown
          const ts = new Date(v).getTime();
          return !isNaN(ts) && ts >= minTs && ts <= maxTs;
        })
        .map((n) => n.node_id),
    );
  }, [timelineOpen, timelineRange, timelineField, specGraph.rawGraph]);

  const filterMatchIds = useMemo((): Set<string> | null => {
    if (!isFilterActive(filterOptions) || !specGraph.rawGraph) return null;
    return new Set(
      specGraph.rawGraph.nodes
        .filter((n) => {
          const statusOk = filterOptions.statuses.size === 0 || filterOptions.statuses.has(n.status as FilterStatus);
          const gapsOk = !filterOptions.hasGaps || (n.gap_count ?? 0) > 0;
          const brokenOk = !filterOptions.hasBroken || n.diagnostics.length > 0;
          return statusOk && gapsOk && brokenOk;
        })
        .map((n) => n.node_id),
    );
  }, [filterOptions, specGraph.rawGraph]);

  const displayNodes = useMemo(() => {
    const edgeEndpoints = highlightedEdge
      ? new Set([highlightedEdge.source, highlightedEdge.target])
      : null;
    const lensActive = graphMode === "specifications" && specLens !== "none";
    if (!edgeEndpoints && !searchMatchIds && !timelineMatchIds && !filterMatchIds && !lensActive) return nodes;
    return nodes.map((n) => {
      const edgeHl = edgeEndpoints?.has(n.id);
      // For child nodes (messages), match against parent ID
      const matchKey = n.parentId ?? n.id;
      const searchDim = searchMatchIds ? !searchMatchIds.has(matchKey) : false;
      const timelineDim = timelineMatchIds ? !timelineMatchIds.has(matchKey) : false;
      const filterDim = filterMatchIds ? !filterMatchIds.has(matchKey) : false;
      // Apply lens style to spec nodes only
      let lensStyle: ReturnType<typeof lensStyleFor> | undefined;
      if (lensActive && (n.type === "spec" || n.type === "expandedSpec")) {
        const ls = lensStyleFor(n.id, specLens, specOverlays);
        if (Object.keys(ls).length > 0) lensStyle = ls;
      }
      if (!edgeHl && !searchDim && !timelineDim && !filterDim && !lensStyle) return n;
      return {
        ...n,
        data: {
          ...n.data,
          ...(edgeHl ? { edgeHighlighted: true } : {}),
          ...(searchDim ? { searchDimmed: true } : {}),
          ...(timelineDim ? { timelineDimmed: true } : {}),
          ...(filterDim ? { filterDimmed: true } : {}),
          ...(lensStyle ? { lensStyle } : {}),
        },
      };
    });
  }, [nodes, highlightedEdge, searchMatchIds, timelineMatchIds, filterMatchIds, graphMode, specLens, specOverlays]);

  const displayEdges = useMemo(() => {
    if (!highlightedEdge) return edges;
    return edges.map((e) =>
      e.id === highlightedEdge.id
        ? { ...e, className: ((e.className ?? "") + " edge-highlight").trim() }
        : e
    );
  }, [edges, highlightedEdge]);

  /** Reset the timeline range to match a specific field's full extent */
  const resetTimelineRangeForField = useCallback((f: TimelineField) => {
    const tss = (specGraph.rawGraph?.nodes ?? [])
      .map((n) => n[f])
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .map((v) => new Date(v).getTime())
      .filter((t) => !isNaN(t));
    if (tss.length > 0) setTimelineRange([Math.min(...tss), Math.max(...tss)]);
  }, [specGraph.rawGraph]);

  const handleTimelineFieldChange = useCallback((f: TimelineField) => {
    setTimelineField(f);
    resetTimelineRangeForField(f);
  }, [resetTimelineRangeForField]);

  const toggleTimeline = useCallback(() => {
    setTimelineOpen((open) => {
      if (open) {
        // closing — reset range so re-opening starts fresh
        setTimelineRange(null);
        return false;
      } else {
        // opening — initialise to full span
        if (timelineFullRange) setTimelineRange(timelineFullRange);
        return true;
      }
    });
  }, [timelineFullRange]);

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
          dashboardAvailable={dashboardAvailable}
          specOverlayAvailable={specOverlayAvailable}
          specLens={specLens}
          onSpecLensChange={setSpecLens}
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
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
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
          {/* Dashboard view */}
          {graphMode === "dashboard" && <GraphDashboard />}

          {/* Force-directed view — replaces ReactFlow when viewMode === "force" */}
          {graphMode === "specifications" && specViewOptions.viewMode === "force" && specGraph.rawGraph && (
            <ErrorBoundary label="SpecForceGraph">
              <SpecForceGraph
                apiGraph={specGraph.rawGraph}
                selectedNodeId={selectedConversationId}
                onSelectNode={onSpecNodeSelect}
              />
            </ErrorBoundary>
          )}

          {/* ReactFlow stays mounted during background refreshes to preserve zoom/pan.
              Hidden (not unmounted) in force/dashboard mode so zoom/pan state is preserved. */}
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
              minZoom={0.4}
              maxZoom={2}
              style={{
                opacity: loading && nodes.length > 0 ? 0.6 : 1,
                transition: "opacity 150ms",
                display: graphMode === "dashboard" || (graphMode === "specifications" && specViewOptions.viewMode === "force") ? "none" : undefined,
              }}
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

          {/* ── Top-left canvas overlay: sidebar toggle + timeline filter ─── */}
          <div className="timeline-overlay">
            {/* Sidebar show button — visible only when sidebar is collapsed */}
            {sidebarCollapsed && (
              <PanelBtn
                icon={<FontAwesomeIcon icon={faBars} />}
                title="Show sidebar"
                onClick={toggleSidebar}
              />
            )}

            {/* Timeline filter — spec mode + ReactFlow view only */}
            {graphMode === "specifications" && specViewOptions.viewMode !== "force" && (
              <>
                <div className="timeline-header">
                  <PanelBtn
                    icon={<FontAwesomeIcon icon={faClock} />}
                    title={timelineOpen ? "Close timeline filter" : "Open timeline filter"}
                    onClick={toggleTimeline}
                    className={timelineOpen ? "timeline-btn-active" : undefined}
                  />
                  {timelineOpen && (
                    <div className="tl-segment">
                      <button
                        className={`tl-seg-btn${timelineField === "created_at" ? " active" : ""}`}
                        onClick={() => handleTimelineFieldChange("created_at")}
                      >Created</button>
                      <button
                        className={`tl-seg-btn${timelineField === "updated_at" ? " active" : ""}`}
                        onClick={() => handleTimelineFieldChange("updated_at")}
                      >Updated</button>
                    </div>
                  )}
                </div>
                {timelineOpen && timelineFullRange && timelineRange && (
                  <TimelineFilter
                    range={timelineRange}
                    onRangeChange={setTimelineRange}
                    fullRange={timelineFullRange}
                  />
                )}
              </>
            )}
          </div>

          {/* ── Top-left canvas overlay: filter bar (independent position) ── */}
          {graphMode === "specifications" && specViewOptions.viewMode !== "force" && (
            <div className="filter-overlay">
              <PanelBtn
                icon={<FontAwesomeIcon icon={faFilter} />}
                title={filterOpen ? "Close filter" : "Filter nodes"}
                onClick={() => {
                  if (filterOpen) {
                    setFilterOpen(false);
                    setFilterOptions(DEFAULT_FILTER);
                  } else {
                    setFilterOpen(true);
                  }
                }}
                className={isFilterActive(filterOptions) ? "filter-btn-active" : undefined}
              />
              {filterOpen && (
                <FilterBar filter={filterOptions} onChange={setFilterOptions} />
              )}
            </div>
          )}

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
              onOpenLens={setLensNodeId}
              onOpenSpecpmPreview={specpmPreviewAvailable ? () => setSpecpmPreviewOpen(true) : undefined}
              rawGraph={specGraph.rawGraph}
              canGoBack={specNav.canGoBack}
              canGoForward={specNav.canGoForward}
              onBack={onSpecNavBack}
              onForward={onSpecNavForward}
              backLabel={specNavBackLabel}
              forwardLabel={specNavForwardLabel}
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
        {/* Spec lens — floating content viewer (position: fixed, top-level) */}
        {graphMode === "specifications" && lensNodeId && (
          <ErrorBoundary label="SpecLens">
            <SpecLens
              nodeId={lensNodeId}
              onClose={() => setLensNodeId(null)}
              onNavigate={(id) => {
                setLensNodeId(id);
                navigateToSpec(id);
              }}
              selectedSubItemId={selectedSubItemId}
              onSelectSubItem={setSelectedSubItemId}
              canGoBack={specNav.canGoBack}
              canGoForward={specNav.canGoForward}
              onBack={() => {
                const id = specNav.back();
                if (!id) return;
                setLensNodeId(id);
                setSelectedConversationId(id);
                setSelectedMessageId(null);
                setSelectedSubItemId(null);
              }}
              onForward={() => {
                const id = specNav.forward();
                if (!id) return;
                setLensNodeId(id);
                setSelectedConversationId(id);
                setSelectedMessageId(null);
                setSelectedSubItemId(null);
              }}
              backLabel={specNavBackLabel}
              forwardLabel={specNavForwardLabel}
            />
          </ErrorBoundary>
        )}

        {/* SpecPM export preview overlay */}
        {specpmPreviewOpen && (
          <ErrorBoundary label="SpecPMExportPreview">
            <SpecPMExportPreview onClose={() => setSpecpmPreviewOpen(false)} />
          </ErrorBoundary>
        )}

        {/* Agent chat — trigger always visible; panel requires capabilities.agent */}
        <AgentChatTrigger onClick={() => setChatOpen((v) => !v)} active={chatOpen} />
        {agentAvailable && (
          <AgentChat
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            contextNodeId={graphMode === "specifications" ? selectedConversationId : null}
          />
        )}
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
    <ToastProvider>
      <ErrorBoundary label="App">
        <ReactFlowProvider>
          <AppInner />
        </ReactFlowProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}
