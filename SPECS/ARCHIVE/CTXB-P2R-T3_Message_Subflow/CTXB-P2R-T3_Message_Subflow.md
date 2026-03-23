# CTXB-P2R-T3 — Implement message subflow rendering with React Flow group nodes

## Objective Summary

When a conversation node is expanded, render it as a React Flow group (parent) node containing child message nodes. Messages show `role | trimmed content` with role-based coloring. Sequential messages are connected by internal edges. Use React Flow's native `parentId` for containment.

## Deliverables

1. `MessageNode.tsx` — custom React Flow node for individual messages.
2. Expanded conversations render as React Flow group nodes with child message nodes.
3. Internal edges connect sequential messages.
4. Collapsing returns to the compact conversation node.
5. TypeScript compiles with zero errors.

## Technical Approach

- When `isExpanded` is true, replace the single conversation node with:
  - A group node (type `"group"`) at the same position, sized to contain all message children.
  - Child message nodes with `parentId` set to the group node ID and `extent: "parent"`.
  - Internal edges between sequential messages.
- `MessageNode.tsx` renders a compact card: role label, trimmed content, role-based background color.
- The expand/collapse toggle on the group node header triggers state update that swaps between compact and expanded representations.
- Node and edge arrays are computed from the expand state in a `useMemo` or transformation function.

## Acceptance Tests

1. Expanded conversations render as group nodes with child message nodes.
2. Messages are connected by vertical edges within the group.
3. Collapsing returns to the compact conversation node.
4. TypeScript compiles with zero errors.
