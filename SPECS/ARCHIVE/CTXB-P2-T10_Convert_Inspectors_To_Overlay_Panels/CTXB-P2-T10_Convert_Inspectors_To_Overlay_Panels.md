# CTXB-P2-T10 — Convert inspectors to right-side overlay panels

## Objective Summary

Move the Conversation Inspector and Checkpoint Inspector from below the graph into overlay panels that slide in from the right edge of the viewport. The graph canvas expands to fill all available main-area space. Panels appear/disappear based on selection state.

## Deliverables

1. Remove the `.inspection-grid` below the graph; graph panel fills the main area.
2. Conversation Inspector becomes a fixed/absolute overlay panel on the right side, visible only when a graph node is selected.
3. Checkpoint Inspector appears (stacked below or nested within the conversation panel) only when a checkpoint is selected.
4. Clicking empty graph canvas space hides both inspector panels.
5. Status line and editor remain outside the overlay flow.

## Acceptance Tests

1. The graph canvas fills all main-area space (no inspection grid below).
2. Selecting a graph node slides in the Conversation Inspector from the right.
3. Selecting a checkpoint within the inspector reveals the Checkpoint Inspector.
4. Clicking empty graph space dismisses both panels.
5. All existing tests pass.
