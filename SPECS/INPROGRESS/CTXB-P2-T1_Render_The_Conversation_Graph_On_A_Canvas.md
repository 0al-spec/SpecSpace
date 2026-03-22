# CTXB-P2-T1 — Render The Conversation Graph On A Canvas

## Objective Summary

Shift the viewer from a file-list-first experience to a graph-first workspace that makes lineage visible at a glance. The main view should render the API-backed conversation graph on a pan-enabled canvas, visually distinguish roots, branches, merges, and broken links, and let the user select a node directly from the graph.

This task is intentionally limited to graph rendering and selection. It should establish the interaction shell that later tasks will deepen with checkpoint inspection, lineage navigation, compile target selection, and refresh-state persistence.

## Scope And Deliverables

### Deliverables

1. A graph canvas in `viewer/index.html` that reads from `GET /api/graph`.
2. Deterministic client-side layout logic for graph nodes and lineage edges.
3. Visual states for canonical roots, branches, merges, selected nodes, and broken lineage.
4. Mouse-driven panning for the canvas plus click selection for nodes.
5. Regression coverage for the new graph-first UI shell and README guidance for the graph workflow.

### Out Of Scope

1. Rich conversation detail and checkpoint inspection panels beyond the current transcript view.
2. Ancestor/sibling jump actions.
3. Refresh-state persistence across hard reloads.
4. Compile target selection or artifact generation.

## Success Criteria

1. The default viewer screen shows a graph canvas populated from the graph API rather than relying on the file list as the primary navigation surface.
2. Users can visually distinguish root, branch, and merge conversations, and broken parent edges remain visible instead of disappearing.
3. Users can pan the canvas and select nodes directly from the graph to inspect the selected conversation.
4. Graph ordering is deterministic for the same API payload so the canvas stays stable across refreshes.

## Acceptance Tests

### UI Behavior Acceptance

1. The viewer exposes a dedicated graph canvas section with graph summary text and selection guidance.
2. Graph nodes render different state treatments for root, branch, merge, and integrity-problem cases.
3. Clicking a node selects it, highlights it, and updates the active conversation shown in the existing transcript area.
4. Dragging the canvas updates the viewport offset without moving the underlying graph data.

### Data Contract Acceptance

1. The canvas is driven by `GET /api/graph` and reflects the returned nodes, edges, roots, and diagnostics.
2. Broken edges render with an explicit broken style instead of being omitted.
3. Node positioning remains deterministic for identical graph payloads.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.
3. `pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90` passes.

## Test-First Plan

1. Add failing tests that assert the shipped HTML contains the graph canvas shell, graph summary region, and graph-first instructional copy.
2. Add failing tests that lock the graph API data the canvas depends on, especially root and broken-edge states.
3. Implement the smallest client changes necessary to satisfy those tests, then refine layout and interaction behavior manually in the browser.

## Implementation Plan

### Phase 1: Define The Graph-First UI Shell

Inputs:
- `viewer/index.html`
- `README.md`
- `tests/test_smoke.py`

Outputs:
- graph canvas markup and status regions
- updated viewer copy describing graph-first navigation
- smoke coverage for the new shell

Steps:
1. Add a dedicated graph panel ahead of the transcript/editor sections.
2. Reframe the sidebar as supporting workspace metadata rather than the primary browsing mechanism.
3. Introduce semantic hooks and IDs for graph summary, legend, viewport, and selection status.

Verification:
- HTML-oriented smoke tests fail first, then pass once the graph shell exists.

### Phase 2: Render Nodes, Edges, And Selection State

Inputs:
- `GET /api/graph` payload
- current transcript rendering logic

Outputs:
- client-side graph fetch and layout helpers
- SVG or canvas rendering for nodes and edges
- click-driven selection wired to transcript rendering

Steps:
1. Fetch graph data separately from file listings and derive deterministic layout columns/lanes from lineage structure.
2. Render resolved and broken edges distinctly and map node kinds to visual treatments.
3. Keep the selected conversation synchronized between the graph canvas and the existing conversation rendering.

Verification:
- Manual inspection shows roots, branches, merges, and broken edges with distinct states.

### Phase 3: Add Viewport Interaction And Documentation

Inputs:
- rendered graph panel
- existing refresh workflow

Outputs:
- pointer-driven panning
- README documentation for the graph canvas workflow

Steps:
1. Track viewport translation in browser state and apply it to the rendered graph group.
2. Add drag handling without interfering with node click selection.
3. Document graph-first browsing and the meaning of the node/edge states in `README.md`.

Verification:
- `make test`, `make lint`, and coverage gate all pass after the interaction pass.

## Decision Points

1. The graph should be rendered with platform-native browser primitives already available in the repository, avoiding new frontend build tooling.
2. Selection should reuse the current transcript renderer instead of inventing a new detail panel before `CTXB-P2-T2`.
3. The file list can remain available as a secondary control surface, but the graph canvas must become the primary navigation affordance.

## Notes

Update `README.md` only for behavior that ships in this task: graph-first navigation, node-state meaning, and the continued presence of file editing controls. Leave checkpoint inspection and navigation details to later PRDs.
