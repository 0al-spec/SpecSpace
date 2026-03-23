# CTXB-P2-T15 — Route cross-conversation edges to message-level nodes

## Objective Summary

When a conversation node is expanded, re-route edges so they connect to the specific message node where the branch/merge occurs, using `edge.parent_message_id` to identify the anchor point.

## Deliverables

1. Edges from an expanded parent connect at the Y position of the matching message node.
2. Edges revert to conversation-level center anchoring when collapsed.
3. The visual clearly shows which message is the branch/merge point.
4. All existing tests pass.

## Technical Approach

- In the edge rendering loop, when the parent node is expanded:
  - Find the index of the checkpoint matching `edge.parent_message_id` in `parentNode.checkpoints`
  - Compute the message node's Y center: `parentPosition.y + HEADER_HEIGHT + idx * (MSG_NODE_HEIGHT + MSG_NODE_GAP) + MSG_NODE_HEIGHT / 2`
  - Use this as `startY` instead of `edgeAnchorY`
  - `startX` remains `parentPosition.x + NODE_WIDTH`
- When collapsed, use existing `edgeAnchorY` logic (no change).
- Similarly for child edges: when the child node is expanded, find the first message node and anchor `endY` to it.

## Acceptance Tests

1. Edges connect to the specific message when parent is expanded.
2. Edges revert to conversation-level when collapsed.
3. All existing tests pass.
