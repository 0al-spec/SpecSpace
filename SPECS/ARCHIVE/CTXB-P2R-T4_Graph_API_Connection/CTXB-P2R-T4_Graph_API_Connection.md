# CTXB-P2R-T4 — Connect graph API data to React Flow nodes and edges

## Objective Summary

Fetch graph data from `/api/graph`, transform the response into React Flow nodes and edges, and use `dagre` for automatic hierarchical layout. Replace hardcoded test data in App.tsx with live API data. Handle expanded/collapsed state and trigger re-layout on expand.

## Deliverables

1. `useGraphData.ts` — hook that fetches `/api/graph` and transforms to React Flow format.
2. `layoutGraph.ts` — dagre-based auto-layout for nodes and edges.
3. App.tsx updated to use live API data instead of test data.
4. `dagre` added as a dependency.

## Technical Approach

### API Response Shape

`/api/graph` returns:
```json
{
  "nodes": [{ "conversation_id", "file_name", "kind", "title", "checkpoint_count", "checkpoints": [{ "message_id", "role", "content", ... }], "parent_edge_ids", "child_edge_ids", "diagnostics" }],
  "edges": [{ "edge_id", "link_type", "parent_conversation_id", "parent_message_id", "child_conversation_id", "status" }],
  "roots": ["conversation_id"],
  "blocked_files": [...],
  "diagnostics": [...]
}
```

### Transformation
- Each API node → React Flow `Node` (type `"conversation"` or `"group"` when expanded).
- Each API edge → React Flow `Edge` (source = parent conversation, target = child conversation).
- Expanded nodes → group + subflowHeader + message children + internal edges (reuse T3 logic).
- Broken edges get dashed/red styling.

### Layout
- Use `dagre` with `rankdir: "LR"` (left-to-right) for hierarchical layout.
- Set node dimensions based on collapsed/expanded state.
- After layout, read computed positions from dagre and assign to React Flow nodes.

## Acceptance Criteria

1. The graph renders all conversation nodes and edges from the API.
2. Root, branch, merge, and broken nodes are visually distinct.
3. Layout is computed automatically and avoids overlap.
4. Expanding/collapsing a node triggers re-layout.
