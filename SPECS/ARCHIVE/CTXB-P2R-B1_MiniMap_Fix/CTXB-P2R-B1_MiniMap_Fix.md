# CTXB-P2R-B1 — MiniMap does not render graph nodes

## Objective Summary

Fix the MiniMap so it renders visible representations of all graph nodes with kind-based coloring.

## Root Cause Analysis

React Flow's `<MiniMap>` renders nodes using their `width` and `height` from the node object. Custom nodes that don't specify explicit `width`/`height` on the node data may not appear in the MiniMap because React Flow can't determine their dimensions until they are rendered in the DOM. The MiniMap uses a simplified SVG renderer that doesn't mount custom components.

Possible fixes:
1. Set explicit `width` and `height` on each node object passed to React Flow.
2. Use `nodeStrokeWidth` / `nodeColor` / `nodeBorderRadius` props on MiniMap for visibility.

## Technical Approach

- Add explicit `style: { width, height }` or `width`/`height` properties to conversation nodes and message nodes in `useGraphData.ts`.
- Verify the `nodeColor` callback in `App.tsx` receives the correct data to color nodes by kind.

## Acceptance Criteria

1. The MiniMap renders visible representations of all graph nodes.
2. Node colors match their kind (root=green, branch=blue, merge=orange).
