# CTXB-P2R-B2 — Stable Layout on Expand/Collapse

**Status:** In Progress
**Priority:** P1
**Branch:** feature/CTXB-P2R-B2-stable-layout
**Dependencies:** CTXB-P2R-T3

---

## Problem

Every time a conversation node is expanded or collapsed, the entire graph re-runs dagre layout, repositioning ALL nodes. This destroys the user's spatial context — nodes jump to new positions on every toggle.

**Root cause:** `useGraphData.ts` has a single `useMemo` that depends on `[apiGraph, expandedNodes, onToggleExpand]`. Changing `expandedNodes` triggers `layoutNodes` (dagre) to re-run with different node sizes, producing new positions for all top-level nodes.

---

## Fix Design

**Separate layout into two memos:**

1. **`basePositions` memo** — depends only on `apiGraph`
   - Runs dagre using all conversations at collapsed (fixed) size: `NODE_WIDTH × NODE_HEIGHT`
   - Returns `Map<conversationId, {x, y}>` — stable until API data changes
   - Exported from `layoutGraph.ts` as `computeBasePositions(nodeIds, edges)`

2. **`{ nodes, edges }` memo** — depends on `apiGraph`, `expandedNodes`, `onToggleExpand`, `basePositions`
   - Builds all nodes using stored positions from `basePositions` (no dagre call)
   - Expands node style/height based on `expandedNodes` state, position stays fixed
   - Builds cross-conversation edges with message-level routing (unchanged)

---

## Implementation

### `layoutGraph.ts`
Add `computeBasePositions(nodeIds: string[], edgePairs: {source: string, target: string}[]): Map<string, {x: number, y: number}>`:
- Runs dagre once with all nodes at collapsed size
- Returns a stable position map

### `useGraphData.ts`
- Add `basePositions` memo (depends on `apiGraph` only)
- Remove `layoutNodes` call from the main `{ nodes, edges }` memo
- Use `basePositions.get(id)` for all top-level node positions

---

## Deliverables

1. `viewer/app/src/layoutGraph.ts` — add `computeBasePositions` function
2. `viewer/app/src/useGraphData.ts` — split into two memos
3. `SPECS/INPROGRESS/CTXB-P2R-B2_Validation_Report.md` — validation

---

## Acceptance Criteria

- Expanding or collapsing a conversation node does not reposition other nodes
- Node positions remain stable across multiple expand/collapse cycles
- Positions only update when `apiGraph` changes (workspace refresh)
- All 45 tests pass; no TypeScript errors
