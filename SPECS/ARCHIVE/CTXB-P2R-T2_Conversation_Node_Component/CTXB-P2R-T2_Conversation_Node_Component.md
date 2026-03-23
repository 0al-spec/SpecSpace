# CTXB-P2R-T2 — Implement custom conversation node component

## Objective Summary

Create a React Flow custom node type for conversation nodes that matches the existing visual design: title, kind label, file name, checkpoint count, broken-lineage warning, selected state, and expand/collapse toggle.

## Deliverables

1. `ConversationNode.tsx` — custom React Flow node component.
2. Node type registered with React Flow via `nodeTypes` prop.
3. Visual parity with the legacy SVG cards (colors, layout, typography).
4. Expand/collapse toggle integrated.
5. TypeScript types for node data.

## Technical Approach

- Define `ConversationNodeData` type with: `title`, `conversationId`, `kind`, `fileName`, `checkpointCount`, `isExpanded`, `hasBrokenLineage`, `diagnosticCount`.
- The node renders as a styled `div` with CSS classes matching kind (root/branch/merge/broken).
- Use React Flow's `Handle` component for source (right) and target (left) connection points.
- Expand toggle dispatches a callback via node data to toggle expanded state.
- Selected state uses React Flow's built-in `selected` prop on the node.
- CSS variables match the legacy design system (`--root`, `--branch`, `--merge`, `--accent-strong`, etc.).

## Acceptance Tests

1. Conversation nodes render with title, kind, file name, checkpoint count.
2. Selected nodes show accent border.
3. Broken-lineage nodes show warning badge.
4. Expand/collapse toggle is visible and functional.
5. TypeScript compiles with zero errors.
