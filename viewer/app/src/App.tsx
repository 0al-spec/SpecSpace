import { useCallback, useMemo, useState } from "react";
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
import "./MessageNode.css";
import "./SubflowHeader.css";
import ConversationNode from "./ConversationNode";
import MessageNode from "./MessageNode";
import SubflowHeader from "./SubflowHeader";
import type { Checkpoint } from "./types";

const nodeTypes = {
  conversation: ConversationNode,
  message: MessageNode,
  subflowHeader: SubflowHeader,
};

interface TestConversation {
  id: string;
  conversationId: string;
  title: string;
  kind: "root" | "branch" | "merge";
  fileName: string;
  checkpoints: Checkpoint[];
  hasBrokenLineage: boolean;
  diagnosticCount: number;
  position: { x: number; y: number };
}

const testConversations: TestConversation[] = [
  {
    id: "root",
    conversationId: "conv-trust-social-root",
    title: "Trust Social Root Conversation",
    kind: "root",
    fileName: "root_conversation.json",
    checkpoints: [
      {
        message_id: "msg-root-1",
        role: "user",
        content: "Outline the core idea for a trust-based social network.",
      },
      {
        message_id: "msg-root-2",
        role: "assistant",
        content:
          "Root from local trust elements: identity verification, community governance.",
      },
    ],
    hasBrokenLineage: false,
    diagnosticCount: 0,
    position: { x: 0, y: 0 },
  },
  {
    id: "branch",
    conversationId: "conv-trust-social-branding",
    title: "Trust Social Branding Branch",
    kind: "branch",
    fileName: "branch_conversation.json",
    checkpoints: [
      {
        message_id: "msg-branch-1",
        role: "user",
        content: "Continue from the prototype with branding ideas.",
      },
      {
        message_id: "msg-branch-2",
        role: "assistant",
        content: "Use a warm product brand with earthy tones and organic shapes.",
      },
    ],
    hasBrokenLineage: false,
    diagnosticCount: 0,
    position: { x: 400, y: 0 },
  },
  {
    id: "merge",
    conversationId: "conv-contextbuilder-merge",
    title: "ContextBuilder Merge",
    kind: "merge",
    fileName: "merge_conversation.json",
    checkpoints: [
      {
        message_id: "msg-merge-1",
        role: "user",
        content: "Merge the branding branch back into the main line.",
      },
    ],
    hasBrokenLineage: false,
    diagnosticCount: 0,
    position: { x: 800, y: 0 },
  },
];

const testCrossEdges: Edge[] = [
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

const MSG_HEIGHT = 36;
const MSG_GAP = 16;
const HEADER_HEIGHT = 40;
const SUBFLOW_PAD = 14;

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

  const { nodes, edges } = useMemo(() => {
    const allNodes: Node[] = [];
    const allEdges: Edge[] = [...testCrossEdges];

    for (const conv of testConversations) {
      const isExpanded = expandedNodes.has(conv.conversationId);

      if (isExpanded && conv.checkpoints.length > 0) {
        // Group node (subflow container)
        const contentHeight =
          HEADER_HEIGHT +
          conv.checkpoints.length * (MSG_HEIGHT + MSG_GAP) -
          MSG_GAP +
          SUBFLOW_PAD * 2;
        const groupWidth = 248;

        allNodes.push({
          id: conv.id,
          type: "group",
          position: conv.position,
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

        // Header node inside group
        allNodes.push({
          id: `${conv.id}-header`,
          type: "subflowHeader",
          position: { x: SUBFLOW_PAD, y: 4 },
          parentId: conv.id,
          extent: "parent" as const,
          data: {
            title: conv.title,
            kind: conv.kind,
            conversationId: conv.conversationId,
            onToggleExpand,
          },
        });

        // Message nodes inside group
        conv.checkpoints.forEach((cp, idx) => {
          const msgId = `${conv.id}-msg-${idx}`;
          allNodes.push({
            id: msgId,
            type: "message",
            position: {
              x: SUBFLOW_PAD,
              y: HEADER_HEIGHT + idx * (MSG_HEIGHT + MSG_GAP),
            },
            parentId: conv.id,
            extent: "parent" as const,
            data: {
              role: cp.role,
              content: cp.content,
              messageId: cp.message_id,
              index: idx,
            },
          });

          // Internal edge to previous message
          if (idx > 0) {
            allEdges.push({
              id: `${conv.id}-internal-${idx}`,
              source: `${conv.id}-msg-${idx - 1}`,
              target: msgId,
              type: "default",
              style: { stroke: "var(--line-strong)", strokeWidth: 1.5 },
            });
          }
        });
      } else {
        // Compact conversation node
        allNodes.push({
          id: conv.id,
          type: "conversation",
          position: conv.position,
          data: {
            title: conv.title,
            conversationId: conv.conversationId,
            kind: conv.kind,
            fileName: conv.fileName,
            checkpointCount: conv.checkpoints.length,
            isExpanded: false,
            hasBrokenLineage: conv.hasBrokenLineage,
            diagnosticCount: conv.diagnosticCount,
            onToggleExpand,
          },
        });
      }
    }

    return { nodes: allNodes, edges: allEdges };
  }, [expandedNodes, onToggleExpand]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
