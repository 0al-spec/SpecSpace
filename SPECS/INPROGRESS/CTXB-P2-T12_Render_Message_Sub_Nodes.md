# CTXB-P2-T12 — Render message sub-nodes inside expanded conversation nodes

## Objective Summary

When a conversation node is expanded, render its messages as vertically stacked sub-nodes inside the conversation boundary. Each message sub-node shows `role | first 25 characters of content`. The conversation node resizes to fit its messages.

## Deliverables

1. When expanded, render message sub-nodes as SVG elements inside the conversation node group.
2. Each sub-node shows `role | {trimmed content}` (25 chars max).
3. The conversation node card (rect) grows in height to contain all message sub-nodes.
4. Collapsing returns the node to its compact size (NODE_HEIGHT).
5. The expand toggle moves to the bottom of the expanded node.

## Acceptance Tests

1. Expanding a node reveals its messages as labeled sub-nodes.
2. Each sub-node shows `role | {trimmed content}`.
3. The node boundary grows to contain all sub-nodes.
4. Collapsing returns to compact size.
5. All existing tests pass.
