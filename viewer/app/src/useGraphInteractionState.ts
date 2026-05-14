import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  applyNodeChanges,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import type { ApiSpecNode, GraphMode, SpecViewOptions } from "./types";
import type { EdgeVisualState } from "./useSpecGraphData";

type HoveredPreview = { node: ApiSpecNode; rect: DOMRect } | null;
type HoveredEdge = {
  kind: string;
  visualState?: EdgeVisualState;
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
} | null;

interface UseGraphInteractionStateOptions {
  graphMode: GraphMode;
  specViewMode: SpecViewOptions["viewMode"];
  graphNodes: Node[];
  graphEdges: Edge[];
  selectedConversationId: string | null;
  setSelectedConversationId: (value: string | null) => void;
  setSelectedMessageId: (value: string | null) => void;
  setSelectedSubItemId: Dispatch<SetStateAction<string | null>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  navigateToSpec: (nodeId: string) => void;
  onSpecNodeSelect: (nodeId: string) => void;
  panToNode: (nodeId: string, delay?: number, keepZoom?: boolean) => void;
  panToPoint: (cx: number, cy: number, zoom: number, delay?: number) => void;
  getZoom: () => number;
  fitNodes: (nodeIds: string[]) => void;
  agentAvailable: boolean;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  specNodes: ApiSpecNode[] | undefined;
}

export function useGraphInteractionState({
  graphMode,
  specViewMode,
  graphNodes,
  graphEdges,
  selectedConversationId,
  setSelectedConversationId,
  setSelectedMessageId,
  setSelectedSubItemId,
  setSearchOpen,
  navigateToSpec,
  onSpecNodeSelect,
  panToNode,
  panToPoint,
  getZoom,
  fitNodes,
  agentAvailable,
  setChatOpen,
  specNodes,
}: UseGraphInteractionStateOptions) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [highlightedEdge, setHighlightedEdge] = useState<{ id: string; source: string; target: string } | null>(null);
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string> | null>(null);
  const [hoveredPreview, setHoveredPreview] = useState<HoveredPreview>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdge>(null);
  const edgeHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
  }, [graphMode, setSelectedConversationId, setSelectedMessageId]);

  const prevViewMode = useRef(specViewMode);
  const pendingLayoutSwitch = useRef(false);
  useEffect(() => {
    if (prevViewMode.current !== specViewMode) {
      prevViewMode.current = specViewMode;
      pendingLayoutSwitch.current = true;
      setNodes([]);
    }
  }, [specViewMode]);

  useEffect(() => {
    setNodes((prev) => {
      const applySelection = (node: Node) =>
        selectedConversationId && node.id === selectedConversationId
          ? { ...node, selected: true }
          : node;

      if (prev.length === 0) return graphNodes.map(applySelection);
      const prevPositions = new Map<string, { x: number; y: number }>();
      for (const node of prev) {
        if (!node.parentId) {
          prevPositions.set(node.id, node.position);
        }
      }
      return graphNodes.map((node) => {
        if (node.parentId) return applySelection(node);
        const existing = prevPositions.get(node.id);
        const patched = existing ? { ...node, position: existing } : node;
        return applySelection(patched);
      });
    });
  }, [graphNodes, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || graphNodes.length === 0) return;
    const ids = new Set(
      graphNodes.filter((node) => !node.parentId).map((node) => node.id),
    );
    if (!ids.has(selectedConversationId)) {
      setSelectedConversationId(null);
      setSelectedMessageId(null);
    }
  }, [graphNodes, selectedConversationId, setSelectedConversationId, setSelectedMessageId]);

  useEffect(() => {
    if (!pendingLayoutSwitch.current) return;
    if (nodes.length === 0 || !selectedConversationId) return;
    pendingLayoutSwitch.current = false;
    const target = graphNodes.find((node) => node.id === selectedConversationId);
    if (!target) return;
    const nodeW = 220;
    const nodeH = 110;
    const cx = target.position.x + nodeW / 2;
    const cy = target.position.y + nodeH / 2;
    panToPoint(cx, cy, getZoom() || 1, 100);
  }, [nodes, selectedConversationId, graphNodes, getZoom, panToPoint]);

  const onNodeMouseEnter: NodeMouseHandler = useCallback((event, rfNode) => {
    if (rfNode.type !== "spec") return;
    const apiNode = specNodes?.find((node) => node.node_id === rfNode.id);
    if (!apiNode) return;
    const el = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
    const rect = el?.getBoundingClientRect();
    if (!rect) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredPreview({ node: apiNode, rect }), 700);
  }, [specNodes]);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredPreview(null);
  }, []);

  const onNodeDragStart: NodeMouseHandler = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredPreview(null);
  }, []);

  const onSearchSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId);
      setSelectedMessageId(null);
      panToNode(conversationId, 50);
      setSearchOpen(false);
    },
    [setSelectedConversationId, setSelectedMessageId, panToNode, setSearchOpen],
  );

  const onSearchSelectSpec = useCallback(
    (nodeId: string) => {
      onSpecNodeSelect(nodeId);
      setSearchOpen(false);
    },
    [onSpecNodeSelect, setSearchOpen],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (event.shiftKey) return;

      if (node.type === "spec" || node.type === "expandedSpec") {
        const target = (event.target as HTMLElement).closest?.(
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
        panToNode(node.id, 50, true);
      } else if (node.type === "specSubItem") {
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
    [
      agentAvailable,
      navigateToSpec,
      panToNode,
      setChatOpen,
      setSelectedConversationId,
      setSelectedMessageId,
      setSelectedSubItemId,
    ],
  );

  const specNodeTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of specNodes ?? []) map.set(node.node_id, node.title);
    return map;
  }, [specNodes]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setHighlightedEdge((prev) => {
      if (prev?.id === edge.id) return null;
      return { id: edge.id, source: edge.source, target: edge.target };
    });
    fitNodes([edge.source, edge.target]);
  }, [fitNodes]);

  const onEdgeMouseEnter: EdgeMouseHandler = useCallback((event, edge) => {
    if (edgeHoverTimerRef.current) clearTimeout(edgeHoverTimerRef.current);
    const data = edge.data as { kind?: string; visualState?: EdgeVisualState } | undefined;
    if (!data?.kind) return;
    const x = event.clientX;
    const y = event.clientY;
    edgeHoverTimerRef.current = setTimeout(() => {
      setHoveredEdge({ kind: data.kind!, visualState: data.visualState, sourceId: edge.source, targetId: edge.target, x, y });
    }, 250);
  }, []);

  const onEdgeMouseLeave: EdgeMouseHandler = useCallback(() => {
    if (edgeHoverTimerRef.current) clearTimeout(edgeHoverTimerRef.current);
    setHoveredEdge(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedConversationId(null);
    setSelectedMessageId(null);
    setHighlightedEdge(null);
  }, [setSelectedConversationId, setSelectedMessageId]);

  return {
    nodes,
    edges: graphEdges,
    highlightedEdge,
    searchMatchIds,
    setSearchMatchIds,
    hoveredPreview,
    hoveredEdge,
    specNodeTitleMap,
    onSearchSelectConversation,
    onSearchSelectSpec,
    onNodesChange,
    onNodeClick,
    onNodeMouseEnter,
    onNodeMouseLeave,
    onNodeDragStart,
    onEdgeClick,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
    onPaneClick,
  };
}
