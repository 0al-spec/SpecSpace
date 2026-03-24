# CTXB-P2R-B4 Validation Report

**Task:** Cross-conversation edge disappears when both conversations are expanded
**Date:** 2026-03-24
**Verdict:** PASS

## Changes Made

### `viewer/app/src/useGraphData.ts` (lines 224–260)

1. **Fixed fallback source for expanded parent edges:** When parent is expanded but `parent_message_id` is not found in checkpoints, source now falls back to the parent's header node (`{conv_id}-header`) instead of the group node (`{conv_id}`). The group node has `type: "group"` with no Handle components, causing React Flow to silently drop the edge. The header node has a `"right"` source Handle.

2. **Set `sourceHandle = "right"` for all expanded-parent edges:** Previously, `sourceHandle` was only set when the message lookup succeeded. Now it's always `"right"` when the parent is expanded, since both the message node and the header fallback have a `"right"` source Handle.

3. **Added `zIndex: 1` to cross-conversation edges:** Ensures edges render above group node backgrounds (default z-index 0). This prevents edges from being occluded when expanded groups overlap due to dagre positions being computed for collapsed node sizes.

## Edge Routing Matrix

| Parent State | Child State | Source | Target | Handles |
|-------------|-------------|--------|--------|---------|
| Collapsed | Collapsed | conversation node | conversation node | default → default |
| Expanded | Collapsed | message node (or header fallback) | conversation node | right → default |
| Collapsed | Expanded | conversation node | header node | default → left |
| Expanded | Expanded | message node (or header fallback) | header node | right → left |

All four states now route to nodes with valid Handle components.

## Quality Gates

| Gate | Result |
|------|--------|
| Tests (`make test`) | PASS — 53 tests, 0 failures |
| Lint (`make lint`) | PASS — no errors |
| TypeScript (`tsc --noEmit`) | PASS — no type errors |
