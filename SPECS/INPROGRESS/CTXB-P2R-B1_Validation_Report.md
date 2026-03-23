# Validation Report — CTXB-P2R-B1: MiniMap Fix

**Date:** 2026-03-24
**Task:** CTXB-P2R-B1 — MiniMap does not show graph items
**Branch:** feature/CTXB-P2R-B1-minimap-fix
**Verdict:** PASS

---

## Changes Implemented

### 1. `viewer/app/src/App.tsx`
- Added `useState<Node[]>` for local node state (required for React Flow internal store to track measured dimensions)
- Added `useEffect` to sync `graphNodes` from `useGraphData` into local `nodes` state
- Added `onNodesChange` handler using `applyNodeChanges` (required for React Flow to update internal `nodeLookup` and `measured` dimensions used by MiniMap)
- Added `minimapNodeColor` function mapping node types/kinds to theme-appropriate colors
- Added `<MiniMap>` component with `nodeColor`, `maskColor`, `pannable`, `zoomable` props
- Added `<ReactFlowProvider>` wrapper in the exported `App` component (required for hooks like `useReactFlow` in `FitViewShortcut`)
- Added `<FitViewShortcut>` component for keyboard `f` shortcut to fit view

### 2. `viewer/app/src/useGraphData.ts`
- Added explicit `width`, `height`, and `style` properties to conversation, message, and subflowHeader nodes
- Imported `NODE_WIDTH`, `NODE_HEIGHT` from `layoutGraph.ts`
- Added `MSG_NODE_WIDTH` constant for message/subflow nodes

### 3. `viewer/app/src/layoutGraph.ts`
- Exported `NODE_WIDTH` and `NODE_HEIGHT` constants (previously unexported)

### 4. `viewer/app/src/theme.css`
- Added `.react-flow__minimap` styling (background, border, border-radius matching app theme)

---

## Root Cause Analysis

React Flow v12's MiniMap renders nodes via `NodeComponentWrapperInner`, which reads from the internal `nodeLookup` store. The `nodeLookup` is only populated when React Flow operates in **controlled mode** with `onNodesChange` provided. Without `onNodesChange`, the internal store does not update `measured` dimensions after the initial render, causing `nodeHasDimensions()` to return `false` for all nodes — resulting in MiniMap rendering zero rectangles.

**Fix:** Switching to controlled mode by providing `useState` + `onNodesChange` with `applyNodeChanges` allows React Flow's internal `adoptUserNodes` to properly populate `nodeLookup` with dimension data.

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python3 -m pytest tests/ -q` | ✅ 45 passed |
| TypeScript | `npx tsc --noEmit` | ✅ No errors |

---

## Visual Verification

- MiniMap renders 3 colored rectangles (root=green, branch=blue, merge=brown/orange)
- MiniMap SVG confirmed: 3 `<rect class="react-flow__minimap-node">` elements
- Colors match `kindColorMap` in `App.tsx`
- MiniMap is pannable and zoomable
- MiniMap styled to match app theme
