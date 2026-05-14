import { useEffect, useCallback, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import type {
  ConversationNodeData,
  ExpandedConversationGroupData,
} from "./types";
import { computeBasePositions, expandedNodeHeight, NODE_WIDTH, NODE_HEIGHT } from "./layoutGraph";
import { useFetchedData } from "./useFetchedData";
import { useSessionSet } from "./useSessionState";

const HEADER_HEIGHT = 40;
const MSG_HEIGHT = 36;
const MSG_GAP = 16;
const SUBFLOW_PAD = 14;
const MSG_NODE_WIDTH = NODE_WIDTH - SUBFLOW_PAD * 2;

interface ApiNode {
  conversation_id: string;
  file_name: string;
  kind: string;
  title: string;
  checkpoint_count: number;
  checkpoints: ApiCheckpoint[];
  parent_edge_ids: string[];
  child_edge_ids: string[];
  diagnostics: ApiDiagnostic[];
}

interface ApiCheckpoint {
  message_id: string;
  index: number;
  role: string;
  content: string;
  child_edge_ids: string[];
}

interface ApiDiagnostic {
  code: string;
  message: string;
}

interface ApiEdge {
  edge_id: string;
  link_type: string;
  parent_conversation_id: string;
  parent_message_id: string;
  child_conversation_id: string;
  status: string;
}

interface ApiGraph {
  nodes: ApiNode[];
  edges: ApiEdge[];
  roots: string[];
  blocked_files: unknown[];
  diagnostics: ApiDiagnostic[];
}

function readGraphResponse(json: unknown): ApiGraph {
  if (typeof json === "object" && json !== null && "graph" in json) {
    const payload = json as { graph?: unknown };
    return (payload.graph ?? json) as ApiGraph;
  }
  return json as ApiGraph;
}

export function useGraphData() {
  const {
    data: apiGraph,
    loading,
    error,
    refresh: fetchGraph,
  } = useFetchedData<ApiGraph>("/api/graph", readGraphResponse, {
    failureMessage: "Failed to fetch graph",
  });
  const [expandedNodes, setExpandedNodes] = useSessionSet("expanded_nodes");

  useEffect(() => {
    const es = new EventSource("/api/watch");
    es.addEventListener("change", () => fetchGraph());
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };
    return () => es.close();
  }, [fetchGraph]);

  const onToggleExpand = useCallback((conversationId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) {
        next.delete(conversationId);
      } else {
        next.add(conversationId);
      }
      return next;
    });
  }, []);

  // Compute stable top-level positions from dagre — only when graph topology changes,
  // NOT when expand state changes. This prevents all nodes from jumping on expand/collapse.
  const basePositions = useMemo(() => {
    if (!apiGraph) return new Map<string, { x: number; y: number }>();
    const nodeIds = apiGraph.nodes.map((n) => n.conversation_id);
    const edgePairs = apiGraph.edges.map((e) => ({
      source: e.parent_conversation_id,
      target: e.child_conversation_id,
    }));
    return computeBasePositions(nodeIds, edgePairs, { rankSep: NODE_WIDTH, nodeSep: NODE_HEIGHT / 2 });
  }, [apiGraph]);

  const { nodes, edges } = useMemo(() => {
    if (!apiGraph) return { nodes: [], edges: [] };

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];

    for (const apiNode of apiGraph.nodes) {
      const isExpanded = expandedNodes.has(apiNode.conversation_id);
      const hasBrokenLineage = apiNode.diagnostics.length > 0;
      const kindMap: Record<string, "root" | "branch" | "merge"> = {
        "root": "root",
        "canonical-root": "root",
        "branch": "branch",
        "canonical-branch": "branch",
        "merge": "merge",
        "canonical-merge": "merge",
      };
      const kind = kindMap[apiNode.kind] ?? "root";

      if (isExpanded && apiNode.checkpoints.length > 0) {
        const contentHeight = expandedNodeHeight(apiNode.checkpoints.length);
        const groupWidth = 248;
        const basePos = basePositions.get(apiNode.conversation_id) ?? { x: 0, y: 0 };

        const groupData: ExpandedConversationGroupData = {
          title: apiNode.title,
          kind,
          conversationId: apiNode.conversation_id,
          onToggleExpand,
          hasBrokenLineage,
          diagnosticCount: apiNode.diagnostics.length,
        };

        allNodes.push({
          id: apiNode.conversation_id,
          type: "group",
          position: basePos,
          data: groupData,
          style: {
            width: groupWidth,
            height: contentHeight,
            background: "var(--panel-muted)",
            border: "2px dashed var(--line)",
            borderRadius: 16,
            padding: 0,
          },
        });

        apiNode.checkpoints.forEach((cp, idx) => {
          const msgId = `${apiNode.conversation_id}-msg-${idx}`;
          allNodes.push({
            id: msgId,
            type: "message",
            position: {
              x: SUBFLOW_PAD,
              y: HEADER_HEIGHT + idx * (MSG_HEIGHT + MSG_GAP),
            },
            parentId: apiNode.conversation_id,
            extent: "parent" as const,
            data: {
              role: cp.role,
              content: cp.content,
              messageId: cp.message_id,
              index: idx,
            },
            style: { width: MSG_NODE_WIDTH, height: MSG_HEIGHT },
          });

          if (idx > 0) {
            allEdges.push({
              id: `${apiNode.conversation_id}-internal-${idx}`,
              source: `${apiNode.conversation_id}-msg-${idx - 1}`,
              target: msgId,
              type: "default",
              style: { stroke: "var(--line-strong)", strokeWidth: 1.5 },
            });
          }
        });
      } else {
        const nodeData: ConversationNodeData = {
          title: apiNode.title || apiNode.conversation_id,
          conversationId: apiNode.conversation_id,
          kind,
          fileName: apiNode.file_name,
          checkpointCount: apiNode.checkpoint_count,
          isExpanded: expandedNodes.has(apiNode.conversation_id),
          hasBrokenLineage,
          diagnosticCount: apiNode.diagnostics.length,
          onToggleExpand,
        };

        allNodes.push({
          id: apiNode.conversation_id,
          type: "conversation",
          position: basePositions.get(apiNode.conversation_id) ?? { x: 0, y: 0 },
          data: nodeData,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          style: { width: NODE_WIDTH, height: NODE_HEIGHT },
        });
      }
    }

    // "Effectively expanded" = in expandedNodes AND has at least one checkpoint.
    // Nodes that are toggled expanded but have no checkpoints still render as
    // ConversationNode (collapsed appearance), so edge routing must not treat
    // them as group nodes — otherwise targetHandle:"left" references a handle
    // that does not exist on ConversationNode and ReactFlow drops the edge.
    const effectivelyExpanded = new Set<string>();
    for (const apiNode of apiGraph.nodes) {
      if (expandedNodes.has(apiNode.conversation_id) && apiNode.checkpoints.length > 0) {
        effectivelyExpanded.add(apiNode.conversation_id);
      }
    }

    // Build message_id → node_id lookup for effectively expanded conversations
    const msgToNodeId = new Map<string, string>();
    for (const apiNode of apiGraph.nodes) {
      if (effectivelyExpanded.has(apiNode.conversation_id)) {
        apiNode.checkpoints.forEach((cp, idx) => {
          msgToNodeId.set(cp.message_id, `${apiNode.conversation_id}-msg-${idx}`);
        });
      }
    }

    // Cross-conversation edges — route to message-level nodes when conversations are expanded
    for (const apiEdge of apiGraph.edges) {
      const isBroken = apiEdge.status === "broken";
      const isParentExpanded = effectivelyExpanded.has(apiEdge.parent_conversation_id);
      const isChildExpanded = effectivelyExpanded.has(apiEdge.child_conversation_id);

      // Source: specific message node if parent is expanded; fall back to the
      // expanded group container when message_id is unknown.
      let source: string;
      let sourceHandle: string | undefined;
      if (isParentExpanded) {
        source = msgToNodeId.get(apiEdge.parent_message_id)
          ?? apiEdge.parent_conversation_id;
        sourceHandle = "right";
      } else {
        source = apiEdge.parent_conversation_id;
        sourceHandle = undefined;
      }

      // Target: expanded group container if child is expanded
      const target = isChildExpanded
        ? apiEdge.child_conversation_id
        : apiEdge.child_conversation_id;
      const targetHandle = isChildExpanded ? "left" : undefined;

      allEdges.push({
        id: apiEdge.edge_id,
        source,
        target,
        sourceHandle,
        targetHandle,
        label: apiEdge.link_type,
        type: "default",
        zIndex: 1,
        style: isBroken
          ? { stroke: "var(--broken-line)", strokeDasharray: "6 3", strokeWidth: 2 }
          : { stroke: "var(--line-strong)", strokeWidth: 2 },
        animated: isBroken,
      });
    }

    return { nodes: allNodes, edges: allEdges };
  }, [apiGraph, expandedNodes, onToggleExpand, basePositions]);

  return { nodes, edges, loading, error, refresh: fetchGraph };
}
