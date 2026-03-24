# CTXB-P3-B1 — Expanding an empty merge node hides parent edges

**Status:** In Progress
**Priority:** P1
**Dependencies:** CTXB-P3-T2, CTXB-P2R-T11
**Branch:** `feature/CTXB-P3-B1-expand-empty-merge-hides-edges`

---

## Bug Description

When a user creates a merge conversation (which starts with an empty `messages` array) and then clicks its expand button, all inbound edges from the parent conversations to this merge node disappear from the canvas.

## Root Cause

In `useGraphData.ts`, the expand branch condition is:

```js
if (isExpanded && apiNode.checkpoints.length > 0) {
  // renders as group node (ExpandedConversationNode)
} else {
  // renders as conversation node (ConversationNode)
}
```

An empty merge node with `checkpoints.length === 0` always falls into the `else` branch — it renders as a `ConversationNode` regardless of expand state.

However, the cross-conversation edge routing further down reads `isChildExpanded = expandedNodes.has(...)`, which is `true` for the expanded-but-empty node. It then sets `targetHandle: "left"` on the edge. `ExpandedConversationNode` has a target handle with `id="left"`, but `ConversationNode` only has an unnamed handle. ReactFlow cannot find the `"left"` handle on the `ConversationNode` and silently drops the edge.

Secondary issue: the expand button in the `else` branch is passed `isExpanded: false` (hardcoded), so even when the node is in `expandedNodes` the button shows ▸ instead of ▾.

## Fix

In `useGraphData.ts`, within the `useMemo`:

1. Build an `effectivelyExpanded` set — conversations that are in `expandedNodes` AND have `checkpoints.length > 0`.
2. Replace all `expandedNodes.has(...)` calls in the `msgToNodeId` lookup and in the edge routing (`isParentExpanded`, `isChildExpanded`) with `effectivelyExpanded.has(...)`.
3. In the `else` branch, pass `isExpanded: expandedNodes.has(apiNode.conversation_id)` (the real value) so the button icon reflects the true expand state.

## Acceptance Criteria

- Expanding an empty merge node keeps all inbound parent edges visible and correctly anchored.
- Collapsing the same node keeps edges visible and restores default handle routing.
- The expand button shows ▾ when the node is in the expanded set (even if it has no checkpoints).
- The fix generalises to n-parent merge nodes and to empty branch nodes.
- All existing tests continue to pass.
