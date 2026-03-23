import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./theme.css";
import "./ConversationNode.css";
import ConversationNode from "./ConversationNode";
import type { ConversationNodeData } from "./types";

const nodeTypes = { conversation: ConversationNode };

function makeTestNodes(
  expandedNodes: Set<string>,
  onToggleExpand: (id: string) => void,
): Node<ConversationNodeData>[] {
  return [
    {
      id: "root",
      type: "conversation",
      position: { x: 0, y: 0 },
      data: {
        title: "Trust Social Root Conversation",
        conversationId: "conv-trust-social-root",
        kind: "root",
        fileName: "root_conversation.json",
        checkpointCount: 2,
        isExpanded: expandedNodes.has("conv-trust-social-root"),
        hasBrokenLineage: false,
        diagnosticCount: 0,
        onToggleExpand,
      },
    },
    {
      id: "branch",
      type: "conversation",
      position: { x: 400, y: 0 },
      data: {
        title: "Trust Social Branding Branch",
        conversationId: "conv-trust-social-branding",
        kind: "branch",
        fileName: "branch_conversation.json",
        checkpointCount: 3,
        isExpanded: expandedNodes.has("conv-trust-social-branding"),
        hasBrokenLineage: false,
        diagnosticCount: 0,
        onToggleExpand,
      },
    },
    {
      id: "merge",
      type: "conversation",
      position: { x: 800, y: 0 },
      data: {
        title: "ContextBuilder Merge",
        conversationId: "conv-contextbuilder-merge",
        kind: "merge",
        fileName: "merge_conversation.json",
        checkpointCount: 1,
        isExpanded: expandedNodes.has("conv-contextbuilder-merge"),
        hasBrokenLineage: true,
        diagnosticCount: 2,
        onToggleExpand,
      },
    },
  ];
}

const testEdges: Edge[] = [
  {
    id: "e-root-branch",
    source: "root",
    target: "branch",
    label: "branch",
    type: "default",
  },
  {
    id: "e-branch-merge",
    source: "branch",
    target: "merge",
    label: "merge",
    type: "default",
  },
];

export default function App() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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

  const nodes = makeTestNodes(expandedNodes, onToggleExpand);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={testEdges}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
