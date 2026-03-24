# CTXB-P2R-B4 — Cross-conversation edge disappears when both conversations are expanded

**Priority:** P1 (Bug fix)
**Dependencies:** CTXB-P2R-B3, CTXB-P2R-T11
**Branch:** `feature/CTXB-P2R-B4-cross-conversation-edge-disappears`

## Problem

When two conversations connected by a branch/merge edge are both expanded into message sub-nodes, the edge vanishes. Edges work correctly when at least one conversation is collapsed. Sometimes a stray edge appears from a checkpoint message to the first node of the target conversation.

## Root Cause Analysis

Two issues in `viewer/app/src/useGraphData.ts` (lines 224–258):

### Issue 1: Fallback routes edge to handleless group node

When a parent conversation is expanded but `parent_message_id` is not found in the checkpoint list, the source falls back to `apiEdge.parent_conversation_id`. That ID now references a `type: "group"` node which has **no Handle components**. React Flow silently drops edges whose source/target nodes lack matching handles.

Current code (line 231–233):
```typescript
const source = isParentExpanded
  ? (msgToNodeId.get(apiEdge.parent_message_id) ?? apiEdge.parent_conversation_id)
  : apiEdge.parent_conversation_id;
```

When collapsed, the same ID references a `type: "conversation"` node that **does** have handles — so collapsed works, expanded fails.

### Issue 2: Cross-group edges render behind group backgrounds

React Flow renders edges in an SVG layer behind the HTML node layer. Group nodes have opaque backgrounds (`--panel-muted` at 88% opacity). When both source and target are child nodes inside different groups, the edge path exits one group and enters another — portions hidden behind group backgrounds. If groups overlap (dagre positions are computed for collapsed sizes, not expanded), the edge can be entirely occluded.

## Fix

### Change 1: Fallback to header node instead of group node (useGraphData.ts)

When the parent is expanded but message lookup fails, fall back to the parent conversation's **header node** (which has a `"right"` source Handle), not the group node:

```typescript
let source: string;
let sourceHandle: string | undefined;

if (isParentExpanded) {
  source = msgToNodeId.get(apiEdge.parent_message_id)
    ?? `${apiEdge.parent_conversation_id}-header`;
  sourceHandle = "right";
} else {
  source = apiEdge.parent_conversation_id;
  sourceHandle = undefined;
}
```

### Change 2: Elevate cross-conversation edges above group nodes (useGraphData.ts)

Set `zIndex: 1` on cross-conversation edges so they render above group nodes (default z-index 0):

```typescript
allEdges.push({
  id: apiEdge.edge_id,
  source,
  target,
  sourceHandle,
  targetHandle,
  label: apiEdge.link_type,
  type: "default",
  zIndex: 1,
  style: ...
});
```

## Acceptance Criteria

- Branch/merge edges remain visible and properly anchored when both source and target conversations are expanded.
- When both are collapsed, edges return to conversation-level anchors.
- Mixed states (one expanded, one collapsed) show edge connecting message node on expanded side to conversation node on collapsed side.
- No stray edges appear during state transitions.

## Deliverables

1. Updated `viewer/app/src/useGraphData.ts` — edge construction logic
2. Validation report

## Task Plan

1. Write/update tests for edge construction (if testable at this layer)
2. Apply Change 1: fix fallback source from group node to header node
3. Apply Change 2: add `zIndex: 1` to cross-conversation edges
4. Run quality gates (`make test`, `make lint`)
5. Create validation report

---
**Archived:** 2026-03-24
**Verdict:** PASS
