# CTXB-P2R-B3 — Expand/collapse overwrites user-dragged node positions

**Priority:** P1
**Dependencies:** CTXB-P2R-B2 (done)
**Branch:** `feature/CTXB-P2R-B3-preserve-dragged-positions`

## Problem

When a user manually drags nodes to rearrange the graph, then expands or collapses any conversation node, all nodes snap back to their dagre-computed positions. The user loses their spatial arrangement.

### Root Cause

In `App.tsx`, line 91-93:
```tsx
useEffect(() => {
  setNodes(graphNodes);
}, [graphNodes]);
```

When expand state changes, `useGraphData` rebuilds all nodes with dagre `basePositions`. The `useEffect` replaces the entire node array, discarding any position changes the user made via dragging (`onNodesChange`).

## Fix

Instead of replacing all nodes, merge new graph data with existing user-dragged positions. For each top-level node:
- If the node already exists in the current state with a user-modified position, keep that position.
- If the node is new (just appeared from a graph refresh), use the dagre-computed position.
- Child nodes (messages, headers) always use relative positions within their parent, so they are unaffected.

## Deliverables

1. **Modified `App.tsx`** — replace the `setNodes(graphNodes)` effect with a merge function that preserves existing top-level node positions.
2. **Verification** — expand/collapse does not move other nodes; dragged positions survive toggle.

## Acceptance Criteria

- [ ] Dragging a node to a new position persists across expand/collapse of any node.
- [ ] Only newly added nodes (from graph refresh) receive dagre-computed positions.
- [ ] Expanding a node resizes it in place without moving other nodes.

## Task Plan

### T1: Replace setNodes with merge logic in App.tsx
- Track which nodes have been user-dragged by comparing current positions to dagre positions.
- On `graphNodes` change, merge: keep existing top-level positions, use dagre for new nodes only.

### T2: Verify via preview
- Drag nodes, expand/collapse, confirm positions are preserved.
- Refresh graph (branch creation), confirm new nodes get dagre positions.

### T3: Run quality gates
- `make test` — all tests pass
- `make lint` — clean
- TypeScript check — clean

---
**Archived:** 2026-03-24
**Verdict:** PASS
