# CTXB-P2-T13 — Render expanded messages as separate graph nodes with internal edges

## Objective Summary

When a conversation node is expanded, replace the inline message labels with proper separate SVG node groups for each message. Connect sequential messages with vertical edges. A lightweight conversation header shows the title above the message chain.

## Deliverables

1. Each message renders as its own SVG group with a card background, role label, and trimmed content.
2. Sequential messages connected by vertical edges (msg1 → msg2).
3. A conversation header (title + kind chip) above the message chain.
4. The expand toggle at the bottom of the subgraph.
5. Collapsing returns to the single compact node.

## Technical Approach

- Replace the `isExpanded` block in the node rendering loop that currently draws inline sub-node rects/labels.
- When expanded, skip the compact card and instead render:
  - A header group with conversation title
  - Individual message node groups positioned vertically
  - Internal edges between sequential message nodes
  - The expand toggle at the bottom
- Message nodes use the same width as conversation nodes but shorter height (~36px).
- The conversation boundary is implied by the header and message chain, not a bounding box.

## Acceptance Tests

1. Each message is a distinct SVG group with its own card background.
2. Sequential messages are connected by vertical edges.
3. A conversation header identifies the parent conversation.
4. Collapsing returns to compact form.
5. All existing tests pass.
