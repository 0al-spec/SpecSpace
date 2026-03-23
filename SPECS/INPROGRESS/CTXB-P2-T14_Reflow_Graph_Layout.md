# CTXB-P2-T14 — Reflow graph layout for expanded message subgraphs

## Objective Summary

When a conversation node is expanded into a message subgraph, recalculate vertical positions of nodes in the same column so expanded subflow containers don't overlap neighboring nodes.

## Deliverables

1. Layout logic uses per-node height (compact or expanded) when computing vertical positions.
2. Expanding a node pushes nodes below it downward in the same column.
3. Collapsing pulls them back to compact spacing.
4. SVG viewBox height adjusts to fit the tallest column including expanded nodes.
5. All existing tests pass.

## Technical Approach

- In the column layout loop (`columnDepths.forEach`), replace `index * (NODE_HEIGHT + NODE_GAP_Y)` with a running `yOffset` accumulator.
- For each node, compute its effective height: if expanded, use `expandedNodeHeight(checkpoints.length)`; otherwise use `NODE_HEIGHT`.
- Accumulate `yOffset += effectiveHeight + NODE_GAP_Y` for each node.
- Track the max column height for the SVG viewBox `height` calculation.
- The `expandedNodeHeight` function and `graphState.expandedNodes` are already available in the layout scope.

## Acceptance Tests

1. Expanding a node pushes sibling nodes below it to avoid overlap.
2. Collapsing restores compact spacing.
3. Cross-conversation edges follow the updated node positions.
4. SVG viewBox accommodates the tallest column.
5. All existing tests pass.
