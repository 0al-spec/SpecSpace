# CTXB-P2R-T11 — Route Cross-Conversation Edges to Message-Level Nodes

**Status:** In Progress
**Priority:** P2
**Branch:** feature/CTXB-P2R-T11-message-level-edges
**Dependencies:** CTXB-P2R-T3, CTXB-P2R-T4

---

## Problem

When a conversation node is expanded (showing individual message sub-nodes), cross-conversation edges still connect to the parent group node rather than the specific message where the branch/merge originated. This breaks the visual lineage story — you can't see which specific message in the parent conversation spawned the branch, or where the merged conversation connects into the child.

**API data available:** `ApiEdge.parent_message_id` specifies exactly which message in the parent conversation is the branch/merge point.

---

## Goal

When conversations are expanded:
- **Edge source** routes from the specific `parent_message_id` message node (not the group container)
- **Edge target** routes to the subflow header of the child conversation (not the group container)

When conversations are collapsed: behavior unchanged (edges connect to conversation nodes as before).

---

## Data Model

Edge structure from API:
```
edge_id, link_type, parent_conversation_id, parent_message_id, child_conversation_id, status
```

Example edge: root's `msg-root-2` → branch conversation

Node IDs:
- Message nodes: `${conversation_id}-msg-${idx}` (idx = 0-based index in checkpoints array)
- Subflow header: `${conversation_id}-header`

---

## Implementation Plan

In `useGraphData.ts`, before building cross-conversation edges:
1. Build `msgToNodeId: Map<string, string>` — maps `message_id` → `node_id` for all expanded conversations' checkpoints
2. For each cross-conversation edge:
   - `source`: if parent is expanded → look up `msgToNodeId.get(parent_message_id)` else use `parent_conversation_id`
   - `target`: if child is expanded → use `${child_conversation_id}-header` else use `child_conversation_id`

In `MessageNode.tsx`:
- Add a `Position.Right` source handle alongside the existing `Position.Bottom` one, for cross-conversation outgoing edges
- Specify `sourceHandle="right"` on cross-conversation edges from message nodes

In `SubflowHeader.tsx`:
- Already has `Handle type="target" position={Position.Left}` — correct for receiving cross-conversation edges

---

## Deliverables

1. `viewer/app/src/useGraphData.ts` — smart edge routing logic
2. `viewer/app/src/MessageNode.tsx` — add Right source handle (id="right")
3. `SPECS/INPROGRESS/CTXB-P2R-T11_Validation_Report.md` — validation report

---

## Acceptance Criteria

- When a conversation is expanded, an edge from that conversation's specific message node (by `parent_message_id`) connects to the child conversation or its subflow header
- When a conversation is collapsed, edges connect to the conversation node as before
- Visual result: expanding a parent conversation shows the branch edge coming from the specific last message that was branched from
- All 45 tests pass; no TypeScript errors
