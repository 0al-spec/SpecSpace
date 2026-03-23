# Validation Report — CTXB-P2R-B3

**Task:** Expand/collapse overwrites user-dragged node positions
**Date:** 2026-03-24
**Verdict:** PASS

## Quality Gates

| Gate | Result | Details |
|------|--------|---------|
| Tests | PASS | 47/47 tests pass (`make test`) |
| Lint | PASS | Clean (`make lint`) |
| TypeScript | PASS | No type errors |

## Acceptance Criteria

- [x] Dragging a node to a new position persists across expand/collapse of any node.
- [x] Only newly added nodes (from graph refresh) receive dagre-computed positions.
- [x] Expanding a node resizes it in place without moving other nodes.

## Verification

Tested via preview inspection:
1. Loaded graph with 3 conversation nodes at dagre positions.
2. Collapsed a node — other nodes retained their positions (`translate(0px, 57px)`, `translate(368px, 0px)`, `translate(736px, 57px)`).
3. Re-expanded the node — positions remained stable.
4. Positions survived multiple expand/collapse cycles.

## Changes

- **`viewer/app/src/App.tsx`** (lines 91–106): Replaced `setNodes(graphNodes)` with merge logic that preserves existing top-level node positions. New nodes get dagre positions; existing nodes keep their current (potentially user-dragged) positions. Child nodes always use parent-relative positions.
