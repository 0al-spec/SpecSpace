# CTXB-P2R-T8 — Add React Flow controls: minimap, background, keyboard shortcuts

## Objective Summary

Add React Flow's built-in `<MiniMap>`, `<Background>` (dot grid), and `<Controls>` (zoom in/out/fit) components. Add keyboard shortcut for fit-view (`F` key). Style to match the existing warm/muted design system.

## Technical Approach

- Import `MiniMap` from `@xyflow/react` and add it inside the `<ReactFlow>` wrapper in `App.tsx`.
- The `<Background>` and `<Controls>` components are already present — verify they use the design system colors.
- Add `useKeyPress` or a `useEffect` keydown listener for the `F` key to trigger `fitView()` via React Flow's `useReactFlow` hook.
- Style the MiniMap with CSS variables from `theme.css` (muted background, warm accent colors for node types).
- Add MiniMap node color function that maps node kinds to design system colors.

## Acceptance Criteria

1. Minimap shows a navigable overview of the graph.
2. Background grid provides spatial orientation.
3. Zoom controls and fit-view shortcut work.
4. Styling matches the existing design system.

## Files to Modify

- `viewer/app/src/App.tsx` — Add MiniMap, keyboard shortcut
- `viewer/app/src/theme.css` — MiniMap styling overrides

---
**Archived:** 2026-03-23
**Verdict:** PASS
