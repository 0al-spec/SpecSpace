# CTXB-P3-B1 Validation Report

**Task:** Expanding an empty merge node hides parent edges
**Date:** 2026-03-25
**Branch:** `feature/CTXB-P3-B1-expand-empty-merge-hides-edges`

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | ✅ PASS — 54 tests, 0 failures |
| Lint | `make lint` | ✅ PASS — no errors |

---

## Changes

**`viewer/app/src/useGraphData.ts`** — 2 fixes:

1. **`effectivelyExpanded` set** — replaces bare `expandedNodes.has(...)` in the `msgToNodeId` lookup and in `isParentExpanded` / `isChildExpanded` edge routing. A node is "effectively expanded" only when it is in `expandedNodes` AND has `checkpoints.length > 0`. This prevents the edge routing from setting `targetHandle: "left"` (an id only present on `ExpandedConversationNode`) for a node that renders as a plain `ConversationNode`.

2. **`isExpanded` in `else` branch** — changed from hardcoded `false` to `expandedNodes.has(apiNode.conversation_id)`. This makes the expand/collapse button icon (▾ vs ▸) accurately reflect the node's expand state even when it has no checkpoints.

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Expanding an empty merge node keeps all inbound edges visible | ✅ Fixed by `effectivelyExpanded` |
| Collapsing restores default handle routing | ✅ Same path, no regression |
| Expand button shows ▾ when node is in expanded set | ✅ `isExpanded` now uses real value |
| Generalises to n-parent merges and empty branch nodes | ✅ Set-based, no hard-coding |
| All existing tests continue to pass | ✅ 54/54 |

---

## Verdict: PASS
