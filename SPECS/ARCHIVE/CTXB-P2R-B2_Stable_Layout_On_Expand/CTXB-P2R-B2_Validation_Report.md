# Validation Report — CTXB-P2R-B2: Stable Layout on Expand/Collapse

**Date:** 2026-03-24
**Task:** CTXB-P2R-B2 — Graph re-layouts on expand/collapse
**Branch:** feature/CTXB-P2R-B2-stable-layout
**Verdict:** PASS

---

## Changes Implemented

### 1. `viewer/app/src/layoutGraph.ts`
- Added `computeBasePositions(nodeIds, edgePairs, options)` — runs dagre once using all nodes at collapsed size (`NODE_WIDTH × NODE_HEIGHT`), returns `Map<id, {x, y}>`

### 2. `viewer/app/src/useGraphData.ts`
- Replaced `layoutNodes` import with `computeBasePositions`
- Added `basePositions` memo — depends only on `apiGraph`, runs dagre once per API response
- Removed `layoutNodes` call from the main `{nodes, edges}` memo
- All top-level node positions now read from `basePositions` map
- Main memo depends on `[apiGraph, expandedNodes, onToggleExpand, basePositions]` — `basePositions` reference is stable between expand toggles

### 3. `tests/test_smoke.py`
- Updated `test_react_app_fetches_graph_api` assertion from `"layoutNodes"` to `"computeBasePositions"`

---

## Root Cause Explained

Before: single `useMemo([apiGraph, expandedNodes])` called `layoutNodes` (dagre) on every expand/collapse → all positions recalculated → all nodes jump.

After: `basePositions` memo depends only on `apiGraph` — stable between expand toggles. Main memo reuses stored positions.

---

## Verification

Node position stability test (via `getBoundingClientRect` / transform parsing):

| Node | Before expand (x,y) | After expand (x,y) | Moved? |
|------|--------------------|--------------------|--------|
| conv-contextbuilder-merge | (736, 57) | (736, 57) | ❌ No |
| conv-trust-social-branding-branch | (368, 0) | (368, 0) | ❌ No |
| conv-trust-social-root | (0, 57) | (0, 57) | ❌ No |

All three nodes remained at exact same positions after expanding the merge conversation.

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python3 -m pytest tests/ -q` | ✅ 45 passed |
| TypeScript | `npx tsc --noEmit` | ✅ No errors |
