import { useState, useEffect, useCallback, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { ConversationNodeData } from "./types";
import { layoutNodes, expandedNodeHeight, NODE_WIDTH, NODE_HEIGHT } from "./layoutGraph";
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

export function useGraphData() {
  const [apiGraph, setApiGraph] = useState<ApiGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useSessionSet("expanded_nodes");

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: ApiGraph = json.graph ?? json;
      setApiGraph(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
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

        allNodes.push({
          id: apiNode.conversation_id,
          type: "group",
          position: { x: 0, y: 0 },
          data: {},
          style: {
            width: groupWidth,
            height: contentHeight,
            background: "var(--panel-muted)",
            border: "2px dashed var(--line)",
            borderRadius: 16,
            padding: 0,
          },
        });

        allNodes.push({
          id: `${apiNode.conversation_id}-header`,
          type: "subflowHeader",
          position: { x: SUBFLOW_PAD, y: 4 },
          parentId: apiNode.conversation_id,
          extent: "parent" as const,
          data: {
            title: apiNode.title,
            kind: apiNode.kind,
            conversationId: apiNode.conversation_id,
            onToggleExpand,
          },
          style: { width: MSG_NODE_WIDTH, height: HEADER_HEIGHT - 8 },
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
          isExpanded: false,
          hasBrokenLineage,
          diagnosticCount: apiNode.diagnostics.length,
          onToggleExpand,
        };

        allNodes.push({
          id: apiNode.conversation_id,
          type: "conversation",
          position: { x: 0, y: 0 },
          data: nodeData,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          style: { width: NODE_WIDTH, height: NODE_HEIGHT },
        });
      }
    }

    // Cross-conversation edges
    for (const apiEdge of apiGraph.edges) {
      const isBroken = apiEdge.status === "broken";
      allEdges.push({
        id: apiEdge.edge_id,
        source: apiEdge.parent_conversation_id,
        target: apiEdge.child_conversation_id,
        label: apiEdge.link_type,
        type: "default",
        style: isBroken
          ? { stroke: "var(--broken-line)", strokeDasharray: "6 3", strokeWidth: 2 }
          : { stroke: "var(--line-strong)", strokeWidth: 2 },
        animated: isBroken,
      });
    }

    // Layout top-level nodes using dagre
    const laidOut = layoutNodes(allNodes, allEdges);

    return { nodes: laidOut, edges: allEdges };
  }, [apiGraph, expandedNodes, onToggleExpand]);

  return { nodes, edges, loading, error, refresh: fetchGraph };
}
