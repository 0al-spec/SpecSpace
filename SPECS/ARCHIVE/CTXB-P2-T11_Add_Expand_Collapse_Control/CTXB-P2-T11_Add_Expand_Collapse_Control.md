# CTXB-P2-T11 — Add expand/collapse control to conversation nodes

## Objective Summary

Add a clickable expand/collapse toggle to each conversation node on the graph canvas. Clicking it toggles an `expanded` flag on the node's state. No layout or sub-node rendering yet — this task only adds the control, tracks the state, and visually indicates expanded vs collapsed.

## Deliverables

1. An expand/collapse icon (▸/▾) rendered in each conversation node SVG.
2. Per-node expanded state tracked in `graphState`.
3. Click handler on the icon that toggles the state and re-renders.

## Acceptance Tests

1. Each conversation node has a visible expand/collapse icon.
2. Clicking the icon toggles the node's expanded state.
3. The icon reflects the current state (▸ collapsed, ▾ expanded).
4. All existing tests pass.
