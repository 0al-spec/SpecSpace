# ContextBuilder Workplan

## Overview

This workplan implements the product defined in [SPECS/PRD.md](/Users/egor/Development/GitHub/0AL/ContextBuilder/SPECS/PRD.md): a local-first conversation graph tool that reads JSON conversation files from disk, preserves lineage between branches and merges, lets the user choose a thought direction on a canvas, and compiles that selection into a Hyperprompt-backed Markdown context artifact for continuation with an external LLM or agent.

### Key Assumptions and Constraints

- JSON files on disk are the only required conversation persistence layer for v1.
- Stable `conversation_id` and `message_id` values are required for graph integrity.
- ContextBuilder owns graph structure, validation, selection, export, and compile orchestration, but not model execution.
- Browser support target is the latest stable desktop Safari and the latest stable desktop Chrome.
- Hyperprompt is an external local compiler dependency that must be configured or discoverable.
- Refresh safety, deterministic export, and lineage preservation take precedence over permissive writes.

### Non-Goals

- Running LLMs, agents, prompts, or tool execution inside ContextBuilder.
- Semantic retrieval or inferred graph construction from arbitrary corpora in v1.
- Browser capture, raw HTML parsing, auth, collaboration, or cloud sync.
- Automatic semantic merging or summarization of conversation content in v1.

## Phase 1: Canonical Graph Foundation

Intent: establish the deterministic data model, validation rules, and graph API required by every later workflow, including authoring and context compilation.

### ✅ CTXB-P1-T1 — Define the canonical conversation and lineage schema
- **Description:** Specify the required JSON contract for root, branch, and merge conversations, including stable conversation identifiers, message identifiers, and parent reference metadata.
- **Priority:** P0
- **Dependencies:** none
- **Parallelizable:** no
- **Outputs / Artifacts:** schema rules in docs, example JSON fixtures, server-side schema helpers
- **Acceptance Criteria:**
  - Root, branch, and merge conversations share one documented contract.
  - Parent references require `conversation_id`, `message_id`, and `link_type`.
  - The contract matches PRD sections §4.2, §4.4, and §6.

### ✅ CTXB-P1-T2 — Normalize imported conversations into graph roots or linked nodes
- **Description:** Implement deterministic rules for classifying externally supplied files as valid roots, valid linked conversations, or invalid inputs that require normalization.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** normalization logic, import classification path, fixture coverage for valid and invalid imports
- **Acceptance Criteria:**
  - Files with sufficient identifiers but no lineage metadata become explicit graph roots.
  - Files missing stable conversation or message identity are rejected with actionable errors.
  - No imported file enters the graph with ambiguous provenance.

### ✅ CTXB-P1-T3 — Validate lineage integrity and reject ambiguous graph state
- **Description:** Add validation for duplicate conversation IDs, duplicate message IDs in lineage contexts, missing parent references, invalid filenames, and malformed lineage payloads.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** validation layer in `viewer/server.py`, integrity error payloads, regression tests for invalid cases
- **Acceptance Criteria:**
  - Ambiguous or malformed files are rejected before save or graph inclusion.
  - Broken lineage references are reported explicitly instead of being silently ignored.
  - Validation covers PRD FR-7, FR-8, NFR-5, and NFR-7.

### ✅ CTXB-P1-T4 — Build the conversation graph index and diagnostics model
- **Description:** Convert the validated file set into an in-memory graph model that resolves conversation nodes, checkpoint relationships, parent edges, child edges, merge edges, and broken-link diagnostics.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T2, CTXB-P1-T3
- **Parallelizable:** no
- **Outputs / Artifacts:** graph indexing logic in `viewer/server.py`, graph payload model, fixture tests
- **Acceptance Criteria:**
  - The server returns graph-ready data for valid roots, branches, and merges.
  - Broken edges remain visible as diagnostics in the model.
  - Graph indexing satisfies PRD FR-1 and lineage rules in §4.2.

### ✅ CTXB-P1-T5 — Expose graph-aware API contracts for UI and compilation
- **Description:** Extend the local HTTP API so the UI and export pipeline can fetch graph data, checkpoint metadata, integrity issues, and compile-relevant selection metadata safely.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T4
- **Parallelizable:** no
- **Outputs / Artifacts:** API endpoints or payload extensions, API tests, contract documentation
- **Acceptance Criteria:**
  - The client can retrieve graph data, node metadata, checkpoint metadata, and blocking issues through the API.
  - API responses clearly separate valid graph data from blocking validation errors.
  - The contract supports PRD FR-1, FR-3, FR-11, and FR-16.

### ✅ CTXB-P1-T6 — Correct compile-target root metadata for incomplete lineage
- **Description:** Ensure graph selections with unresolved parent edges expose partial lineage honestly and never label the selected conversation as a reachable root unless it is a true root conversation.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T5
- **Parallelizable:** yes
- **Outputs / Artifacts:** compile-target helper adjustment in `viewer/server.py`, regression tests for broken-lineage selection metadata, README contract clarification
- **Acceptance Criteria:**
  - Incomplete lineage selections do not include synthetic roots in `root_conversation_ids`.
  - The API contract clearly distinguishes reachable roots from partial or broken ancestry.
  - Regression tests cover broken-parent and missing-parent-message compile-target responses.

## Phase 2: Graph Navigation and Orientation UX

Intent: replace the flat file-browser mental model with a canvas-based graph experience that makes lineage visible, keeps the user oriented, and exposes the information needed to select a continuation path.

### ✅ CTXB-P2-T1 — Render the conversation graph on a canvas
- **Description:** Replace the current flat sidebar-first browsing flow with a canvas that renders conversation nodes, branch edges, merge edges, and node state.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5
- **Parallelizable:** no
- **Outputs / Artifacts:** graph canvas in `viewer/index.html`, rendering logic, visual states for roots, branches, merges, and broken links
- **Acceptance Criteria:**
  - Users can visually distinguish root conversations, branch conversations, and merge conversations.
  - The canvas supports panning and node selection.
  - The rendered graph reflects the lineage data returned by the API.

### ✅ CTXB-P2-T2 — Add conversation detail and checkpoint inspection panels
- **Description:** When a conversation node is selected, show transcript messages, checkpoint metadata, lineage information, and available navigation or authoring actions.
- **Priority:** P0
- **Dependencies:** CTXB-P2-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** detail panel UI in `viewer/index.html`, selection state management, transcript rendering for graph nodes
- **Acceptance Criteria:**
  - Selecting a node reveals its messages and lineage metadata.
  - The detail panel exposes checkpoint-level actions for branch, merge, and compile workflows.
  - The task satisfies PRD FR-3 and the inspection portions of Flow A.

### ✅ CTXB-P2-T3 — Implement ancestor and sibling lineage navigation
- **Description:** Add explicit navigation actions that jump from a derived conversation to its parent checkpoint and from that checkpoint to related sibling branches or merge-related nodes.
- **Priority:** P0
- **Dependencies:** CTXB-P2-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** navigation controls in `viewer/index.html`, graph-centering logic, checkpoint highlighting behavior
- **Acceptance Criteria:**
  - A user can navigate from a branch to its ancestor checkpoint in one action.
  - A user can continue from the ancestor context to sibling branches without manual file lookup.
  - The implementation satisfies PRD FR-6 and Flow D.

### ✅ CTXB-P2-T4 — Preserve graph context across hard refresh
- **Description:** Persist and restore the active conversation, active checkpoint, and canvas viewport across `Cmd+R` or manual reload when those objects still exist after the refresh.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T1, CTXB-P2-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** browser-side restoration logic, storage keys or URL strategy, refresh restoration tests
- **Acceptance Criteria:**
  - Reload restores the previous graph context when the referenced conversation and checkpoint still exist.
  - If the prior objects were removed externally, the UI falls back to the nearest valid state with a clear notice.
  - The behavior satisfies PRD FR-9, NFR-6, and Flow E.

### ✅ CTXB-P2-T5 — Surface integrity issues directly in the graph UI
- **Description:** Show broken references, duplicate IDs, unsupported files, and compile-blocking validation errors in the UI so the user can distinguish data issues from missing content.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T3, CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** UI error states in `viewer/index.html`, graph badges or notices, integrity summaries
- **Acceptance Criteria:**
  - Broken lineage is visible on the canvas and in the details UI.
  - Unsupported files or blocking errors are explicit and actionable.
  - The UI does not silently suppress graph inconsistencies.

### ✅ CTXB-P2-T6 — Add collapsible sidebar toggle
- **Description:** Add a button that collapses and expands the sidebar so the graph canvas and inspectors can use the full viewport width when the file list is not needed.
- **Priority:** P2
- **Dependencies:** CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** toggle button in `viewer/index.html`, sidebar collapse/expand CSS and state
- **Acceptance Criteria:**
  - A visible toggle button collapses the sidebar in one click.
  - Clicking the toggle again restores the sidebar.
  - The graph canvas and inspector panels expand to fill the freed space.

### ✅ CTXB-P2-T7 — Remove the "Graph canvas" heading from the graph panel
- **Description:** Remove the static "Graph canvas" eyebrow and "Conversation lineage" heading from the graph panel. The graph summary line and legend are sufficient orientation.
- **Priority:** P2
- **Dependencies:** CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** HTML and CSS cleanup in `viewer/index.html`
- **Acceptance Criteria:**
  - The "Graph canvas" eyebrow and "Conversation lineage" heading are removed.
  - The graph summary, legend, and canvas remain fully functional.

### ✅ CTXB-P2-T8 — Simplify sidebar file list interactions
- **Description:** Remove the "Open" button from sidebar file entries — clicking anywhere on the file cell should open/select the file. Replace the "Delete" button with a compact trash icon or "X" symbol that triggers a confirmation dialog before deletion.
- **Priority:** P2
- **Dependencies:** CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated file list rendering in `viewer/index.html`, confirmation dialog for delete
- **Acceptance Criteria:**
  - Clicking a file cell opens/selects that file without needing a separate "Open" button.
  - Delete is triggered by a compact icon that shows a confirmation dialog before proceeding.
  - No accidental deletions are possible.

### ✅ CTXB-P2-T9 — Remove the redundant file toolbar block
- **Description:** Remove the block that shows the selected file name, message count, kind label, and the "Save current file", "Save as new file", "Delete current file" buttons. This information duplicates the conversation inspector and the sidebar, and the actions are either redundant or better placed elsewhere.
- **Priority:** P2
- **Dependencies:** CTXB-P2-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** HTML removal in `viewer/index.html`, any orphaned JS cleanup
- **Acceptance Criteria:**
  - The file toolbar block is removed from the page.
  - No functionality is lost — equivalent actions remain accessible from the sidebar or inspectors.
  - All existing tests continue to pass.

### ✅ CTXB-P2-T10 — Convert inspectors to right-side overlay panels driven by selection state
- **Description:** Move the Conversation Inspector and Checkpoint Inspector from below the graph into overlay panels that slide in from the right edge of the viewport. The graph canvas expands to fill all available space (excluding the sidebar). The Conversation Inspector appears when a graph node is selected; the Checkpoint Inspector appears only when a checkpoint is selected within the Conversation Inspector. Clicking empty space on the graph dismisses both panels.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T2, CTXB-P2-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** overlay panel CSS and layout changes in `viewer/index.html`, selection-driven show/hide logic, click-on-empty-space dismissal
- **Acceptance Criteria:**
  - The graph canvas fills all main-area space (no inspection grid below it).
  - The Conversation Inspector slides in as a right-side overlay when a graph node is selected.
  - The Checkpoint Inspector appears (stacked or nested) only when a checkpoint is selected.
  - Clicking empty graph canvas space hides both inspector panels.
  - All existing tests continue to pass.

### ✅ CTXB-P2-T11 — Add expand/collapse control to conversation nodes
- **Description:** Add a clickable expand/collapse toggle to each conversation node on the graph canvas. Clicking it toggles an `expanded` flag on the node's state. No layout changes yet — this task only adds the control, tracks the state, and visually indicates whether the node is expanded or collapsed.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** expand/collapse control in SVG node rendering, per-node expanded state
- **Acceptance Criteria:**
  - Each conversation node has a visible expand/collapse icon (e.g., ▸/▾).
  - Clicking the icon toggles the node's expanded state.
  - The icon reflects the current state (collapsed vs expanded).
  - All existing tests continue to pass.

### ✅ CTXB-P2-T12 — Render message sub-nodes inside expanded conversation nodes
- **Description:** When a conversation node is expanded, render its messages as vertically stacked sub-nodes inside the conversation boundary. Each message sub-node shows `role | first 25 characters of content`. The conversation node resizes to fit its messages. Other nodes and edges are not repositioned yet.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T11
- **Parallelizable:** no
- **Outputs / Artifacts:** message sub-node SVG rendering, dynamic node height calculation
- **Acceptance Criteria:**
  - Expanding a node reveals its messages as labeled sub-nodes inside the conversation boundary.
  - Each sub-node shows `role | {trimmed content}`.
  - The conversation node boundary grows to contain all message sub-nodes.
  - Collapsing returns the node to its compact size.
  - All existing tests continue to pass.

### ✅ CTXB-P2-T13 — Render expanded messages as separate graph nodes with internal edges
- **Description:** When a conversation node is expanded, replace the inline message labels (from T12) with proper separate SVG node groups for each message. Connect sequential messages with vertical edges (msg1 → msg2 → msg3). A lightweight conversation header shows the title above the message chain. This creates a true subgraph that T14 can route cross-conversation edges into.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T12
- **Parallelizable:** no
- **Outputs / Artifacts:** message node SVG groups, internal edge rendering, conversation header
- **Acceptance Criteria:**
  - Each message renders as its own graph node (distinct SVG group with card background).
  - Sequential messages within a conversation are connected by vertical edges.
  - A conversation header label identifies the parent conversation.
  - Collapsing returns to the single compact node.
  - All existing tests continue to pass.

### ✅ CTXB-P2-T14 — Reflow graph layout for expanded message subgraphs
- **Description:** When a conversation node expands into a message subgraph, recalculate positions of sibling and downstream conversation nodes so they don't overlap. The expanded message chain occupies more vertical space; neighboring nodes must shift to accommodate.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T13
- **Parallelizable:** no
- **Outputs / Artifacts:** layout reflow logic in graph rendering
- **Acceptance Criteria:**
  - Expanding a node pushes neighboring nodes to avoid overlap.
  - Collapsing pulls them back.
  - Cross-conversation edges update to follow the new node positions.
  - All existing tests continue to pass.

### ✅ CTXB-P2-T15 — Route cross-conversation edges to message-level nodes
- **Description:** When a conversation is expanded into message nodes, re-route branch and merge edges so they connect to the specific message node where the fork or join occurs (using the parent `message_id` from the edge data). When collapsed, edges connect at the conversation node level as before.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T13
- **Parallelizable:** yes
- **Outputs / Artifacts:** edge anchor recalculation in graph rendering
- **Acceptance Criteria:**
  - Branch/merge edges connect to the exact message node when the parent conversation is expanded.
  - Edges revert to conversation-level anchors when collapsed.
  - The visual clearly shows which message is the branch/merge point.
  - All existing tests continue to pass.

### ~~CTXB-P2-T16~~ — Click message node to select checkpoint in inspector
- **Status:** Absorbed into CTXB-P2R-T6 (inspector overlay migration)
- **Description:** Clicking a message node in the expanded subgraph selects it as the active checkpoint in the inspector overlay. This connects the graph-level message view with the existing checkpoint inspection flow.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T13, CTXB-P2-T10
- **Parallelizable:** yes
- **Outputs / Artifacts:** click handler on message nodes, checkpoint selection integration
- **Acceptance Criteria:**
  - Clicking a message node selects the corresponding checkpoint in the inspector.
  - The clicked message node gets a visual highlight (active state).
  - The checkpoint inspector overlay shows the selected message's details.
  - All existing tests continue to pass.

## Phase 2R: Migrate Viewer to React Flow

Intent: replace the custom SVG graph renderer (~500 lines of manual layout, edge routing, pan/zoom, and subflow code) with React Flow, gaining built-in interaction primitives (drag, zoom, minimap, smart edge routing, native subflows) and a component-based architecture that scales for Phase 3+ features.

### ✅ CTXB-P2R-T1 — Scaffold Vite + React + React Flow project in viewer
- **Description:** Initialize a Vite + React + TypeScript project inside `viewer/`. Install React Flow as a dependency. Set up dev server proxy to the existing Python backend on port 8001. Create a minimal `App` component that renders a React Flow canvas with a single hardcoded node to prove the toolchain works end-to-end. Keep the old `index.html` as `index.legacy.html` until migration is complete.
- **Priority:** P0
- **Dependencies:** none
- **Parallelizable:** no
- **Outputs / Artifacts:** `viewer/package.json`, `viewer/vite.config.ts`, `viewer/src/App.tsx`, dev server running
- **Acceptance Criteria:**
  - `npm run dev` in `viewer/` starts a dev server that renders a React Flow canvas.
  - API calls to `/api/*` proxy to the Python backend.
  - The legacy `index.html` remains functional at its current path.

### ✅ CTXB-P2R-T2 — Implement custom conversation node component
- **Description:** Create a React Flow custom node type for conversation nodes. It renders the same visual as the current SVG cards: title, kind label, file name, checkpoint count, and broken-lineage warning. Supports `selected` state styling. Includes the expand/collapse toggle.
- **Priority:** P0
- **Dependencies:** CTXB-P2R-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** `ConversationNode.tsx` component, node type registration
- **Acceptance Criteria:**
  - Conversation nodes render with title, kind, file name, checkpoint count.
  - Selected nodes show accent border.
  - Broken-lineage nodes show warning badge.
  - Expand/collapse toggle is visible and functional.

### ✅ CTXB-P2R-T3 — Implement message subflow rendering with React Flow group nodes
- **Description:** When a conversation node is expanded, render it as a React Flow group (parent) node containing child message nodes. Each message node shows `role | trimmed content` with role-based coloring. Sequential messages are connected by internal edges. Use React Flow's native `parentId` and `extent: 'parent'` for containment.
- **Priority:** P0
- **Dependencies:** CTXB-P2R-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** `MessageNode.tsx` component, subflow layout logic, internal edge generation
- **Acceptance Criteria:**
  - Expanded conversations render as React Flow group nodes with child message nodes.
  - Messages are connected by vertical edges within the group.
  - Collapsing returns to the compact conversation node.
  - Edges from other conversations route to the specific message node (parent_message_id).

### ✅ CTXB-P2R-T4 — Connect graph API data to React Flow nodes and edges
- **Description:** Fetch graph data from `/api/graph`, transform conversation nodes into React Flow node objects and lineage edges into React Flow edge objects. Handle expanded/collapsed state, kind-based styling, and broken-edge visual states. Use `dagre` or `elkjs` for automatic layout (replacing the manual column-based layout).
- **Priority:** P0
- **Dependencies:** CTXB-P2R-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** graph data fetching hook, node/edge transformation, auto-layout integration
- **Acceptance Criteria:**
  - The graph renders all conversation nodes and edges from the API.
  - Root, branch, merge, and broken nodes are visually distinct.
  - Layout is computed automatically and avoids overlap.
  - Expanding/collapsing a node triggers re-layout.

### ✅ CTXB-P2R-T5 — Migrate sidebar to React component
- **Description:** Convert the sidebar (workspace path, file list, refresh/new-file buttons, collapse toggle) from inline HTML+JS to a React component. Preserve all existing interactions: click-to-select, delete with confirmation, sidebar collapse/expand with sessionStorage persistence.
- **Priority:** P0
- **Dependencies:** CTXB-P2R-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** `Sidebar.tsx` component, file list state management
- **Acceptance Criteria:**
  - Sidebar renders workspace info and file list.
  - Click-to-select, delete with confirmation, and collapse toggle work.
  - Collapse state persists across refresh via sessionStorage.

### ✅ CTXB-P2R-T6 — Migrate inspector overlay to React component
- **Description:** Convert the conversation inspector and checkpoint inspector overlays to React components. Selection-driven visibility: conversation inspector appears when a graph node is selected; checkpoint inspector appears when a checkpoint is selected. Click-on-empty-canvas dismisses both. Preserve lineage navigation buttons (go-to-parent, open-child-conversation).
- **Priority:** P0
- **Dependencies:** CTXB-P2R-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** `InspectorOverlay.tsx`, `ConversationInspector.tsx`, `CheckpointInspector.tsx` components
- **Acceptance Criteria:**
  - Conversation inspector slides in when a node is selected.
  - Checkpoint inspector appears when a checkpoint/message is selected.
  - Clicking empty canvas dismisses both.
  - Lineage navigation (parent, children) works.
  - Message clicking in the graph selects the checkpoint in the inspector (absorbs T16).

### ✅ CTXB-P2R-T7 — Restore session persistence and graph context
- **Description:** Persist and restore selected conversation, selected checkpoint, expanded nodes, and viewport position across page reload using sessionStorage. Match the behavior of the legacy implementation.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T4, CTXB-P2R-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** session persistence hooks, restore-on-mount logic
- **Acceptance Criteria:**
  - Reload restores selected conversation, checkpoint, expanded nodes, and viewport.
  - If referenced objects no longer exist, falls back gracefully.

### ✅ CTXB-P2R-T8 — Add React Flow controls: minimap, background, and keyboard shortcuts
- **Description:** Add React Flow's built-in `<MiniMap>`, `<Background>` (dot grid), and `<Controls>` (zoom in/out/fit) components. Add keyboard shortcut for fit-view (e.g., `F` key). Style to match the existing warm/muted design system.
- **Priority:** P2
- **Dependencies:** CTXB-P2R-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** minimap, background, controls integration, keyboard handlers
- **Acceptance Criteria:**
  - Minimap shows a navigable overview of the graph.
  - Background grid provides spatial orientation.
  - Zoom controls and fit-view shortcut work.
  - Styling matches the existing design system.

### ✅ CTXB-P2R-T9 — Remove legacy viewer and update tests
- **Description:** Delete `index.legacy.html` (the old single-file viewer). Update smoke tests to validate the new React-based viewer build output. Update the Python server to serve the Vite build output. Ensure `npm run build` produces a production bundle.
- **Priority:** P0
- **Dependencies:** CTXB-P2R-T5, CTXB-P2R-T6, CTXB-P2R-T7
- **Parallelizable:** no
- **Outputs / Artifacts:** legacy file removal, updated smoke tests, production build config
- **Acceptance Criteria:**
  - The legacy `index.html` is removed.
  - `npm run build` produces a working production bundle.
  - The Python server serves the built viewer.
  - All smoke tests pass against the new viewer.
  - T16 functionality (click message → select checkpoint) is verified.

### ✅ CTXB-P2R-B1 — MiniMap does not render graph nodes
- **Description:** The MiniMap component appears in the bottom-right corner but does not display any node representations inside it. The minimap viewport box is visible but the graph items (conversation nodes, message nodes) are missing.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T8
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - The MiniMap renders visible representations of all graph nodes.
  - Node colors match their kind (root=green, branch=blue, merge=orange).

### ✅ CTXB-P2R-T10 — Fix expand/collapse button position to top-right corner
- **Description:** The expand/collapse toggle button on conversation nodes jumps between bottom-center (collapsed `ConversationNode`) and top-left (expanded `SubflowHeader`). Move it to a consistent top-right position in both states so the control stays in a predictable location when toggling.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T2
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - The expand/collapse button is positioned in the top-right corner of both the collapsed conversation node and the expanded subflow header.
  - Button position does not shift when toggling between collapsed and expanded states.

### ✅ CTXB-P2R-B2 — Graph re-layouts entirely when expanding a conversation node
- **Description:** Every time a conversation node is expanded or collapsed, the entire graph runs dagre layout again, causing all nodes to jump to new positions. This is disorienting — users lose spatial context. Root cause: the `useMemo` in `useGraphData` that calls `layoutNodes` (dagre) depends on `expandedNodes`, so it re-runs on every toggle. Fix: compute base positions once when `apiGraph` changes and reuse them when expand state changes.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T3
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - Expanding or collapsing a conversation node does not reposition any other nodes.
  - Node positions are stable across expand/collapse toggles.
  - Positions only update when the API graph data changes (new conversations added/removed).

### CTXB-P2R-B3 — Expand/collapse overwrites user-dragged node positions ✅
- **Description:** When a user manually drags nodes to rearrange the graph, then expands or collapses any conversation node, all nodes snap back to their dagre-computed positions. Root cause: the `useMemo` in `useGraphData` rebuilds all nodes with `basePositions` (dagre), and `setNodes(graphNodes)` in `App.tsx` replaces the current node array — discarding any position changes applied via `onNodesChange` (drag). Fix: when expand state changes, merge the new node data with existing user-dragged positions instead of replacing them. Only use dagre positions for nodes that have no user-set position yet.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-B2
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - Dragging a node to a new position persists across expand/collapse of any node.
  - Only newly added nodes (from graph refresh) receive dagre-computed positions.
  - Expanding a node resizes it in place without moving other nodes.

### ✅ CTXB-P2R-B4 — Cross-conversation edge disappears when both conversations are expanded
- **Description:** When two conversations (e.g. `Агентная_Операционная_Система_-_Pre-Implementation_Balance_Metrics.json` and `Агентная_Операционная_Система_-_SIB_Metrics_Full.json`) are connected via a branch/merge edge, the edge is visible when at least one conversation is collapsed. However, when both conversations are expanded into their message sub-nodes, the edge vanishes entirely. In the broken case, sometimes a stray edge appears from a specific checkpoint message to the first node of the target conversation, suggesting the edge routing logic may be creating or destroying edges at the wrong collapse/expand boundaries. Root cause unknown — likely in `useGraphData` edge-building logic or React Flow's handling of edges crossing parent group boundaries.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-B3, CTXB-P2R-T11
- **Parallelizable:** no
- **Acceptance Criteria:**
  - Branch/merge edges remain visible and properly anchored when both source and target conversations are expanded.
  - When both are collapsed, edges return to conversation-level anchors.
  - Mixed states (one expanded, one collapsed) show edge connecting message node on expanded side to conversation node on collapsed side.
  - No stray edges appear during state transitions.

### ✅ CTXB-P2R-T11 — Route cross-conversation edges to message-level nodes in expanded subflows
- **Description:** When a conversation is expanded into message sub-nodes, route cross-conversation edges (branch/merge) to the specific message node identified by `parent_message_id` from the API edge data. Currently edges always connect at the conversation/group level even when expanded. React Flow supports edges between child nodes in sub-flows via `parentId`. When both source and target conversations are expanded, edges should connect the exact message nodes. When only one side is expanded, the edge should connect the message node on the expanded side to the conversation node on the collapsed side.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T3, CTXB-P2R-T4
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - When a parent conversation is expanded, branch/merge edges originate from the specific message node matching `parent_message_id`.
  - When collapsed, edges revert to conversation-level anchors.
  - The visual clearly shows which message is the branch/merge point.

### ✅ CTXB-P2R-B5 — Message node title is draggable and shows sockets; overlapped by message node; collapse button floats
- **Description:** The first message sub-node within an expanded conversation node has several rendering and interaction issues: (1) the sub-node title renders as a draggable node instead of a non-interactive decorator, causing it to show two sockets (input/output); (2) the title is visually overlapped by the first actual message node below it; (3) the conversation expand/collapse button floats alongside the title node instead of being fixed to the conversation header. The title is meant to be a lightweight label for the subflow, not an interactive node. Suggested fix: render the subflow title as a simple text decorator (label, badge, or SVG text) rather than as a React Flow node, so it does not participate in edge anchoring or dragging.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T3, CTXB-P2R-T4
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - The conversation header (title) inside an expanded subflow is a non-interactive decorator (text label or badge).
  - The header does not render sockets or respond to drag.
  - Message nodes are rendered below the header without overlap.
  - The expand/collapse button is positioned at the conversation node level, not floating with sub-nodes.
  - All existing tests continue to pass.

### ✅ CTXB-P2R-B6 — Selecting a conversation node or message subnode does not populate the right inspector
- **Description:** Clicking a conversation node or a message sub-node on the graph canvas does not populate the right-side inspector panel — the inspector remains empty. Expected behaviour: selecting any conversation node should load that conversation's detail (title, lineage edges, integrity, checkpoints) into the inspector; selecting a message sub-node should load that checkpoint's detail.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** Fix in `viewer/app/src/`; regression tests or manual verification steps
- **Acceptance Criteria:**
  - Clicking a conversation node populates the inspector with conversation detail (title, kind, parent/child edges, checkpoints).
  - Clicking a message sub-node populates the inspector with checkpoint detail.
  - Inspector content updates on every subsequent selection.
  - Deselecting clears or retains the last selection gracefully (no blank flash).

### CTXB-P2R-B7 — Cross-conversation edge becomes internal to child conversation on sequential expand
- **Description:** When two connected conversations are expanded in sequence — first the ROOT (`Агентная_Операционная_Система_-_SpecGraph_-_RLM.json`), then its BRANCH child (`Агентная_Операционная_Система_-_SpecGraph_-_RLM_-_Graph-native_recursive_reasoning_runtime.json`) — the edge that correctly connected the two conversations (or their message nodes) before the second expand is replaced by an edge that appears _inside_ the second conversation's subflow. The edge looks like an internal link within the BRANCH conversation rather than a cross-conversation edge. Before expanding the second conversation, the edge is rendered correctly.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-B4, CTXB-P2R-T11
- **Parallelizable:** no
- **Source:** User-reported, 2026-04-12
- **Repro steps:**
  1. Open the CONVERSATIONS graph.
  2. Expand `Агентная_Операционная_Система_-_SpecGraph_-_RLM | ROOT`.
  3. Observe: the edge to the BRANCH child is correctly drawn.
  4. Expand `Агентная_Операционная_Система_-_SpecGraph_-_RLM_-_Graph-native_recursive_reasoning_runtime | BRANCH`.
  5. Observe: the cross-conversation edge disappears and is replaced by an edge that appears to be internal to the BRANCH conversation subflow.
- **Hypothesis:** When the BRANCH conversation is expanded, edge endpoint re-mapping (in `useGraphData`) produces a target node that has the BRANCH group as its `parentId`. React Flow then treats the edge as internal to that group and clips or re-routes it within the group's coordinate space. The edge loses its cross-group identity. Possibly the message node chosen as the target already existed in the collapsed representation (as a synthetic root message node), and expanding adds a real `parentId`, causing the edge to be silently adopted into the group.
- **Acceptance Criteria:**
  - Expanding both conversations in any order leaves the cross-conversation edge correctly routed between the two subflows.
  - The edge connects the specific message node (branch point) in the ROOT subflow to the first message node of the BRANCH subflow.
  - No "internal" edge appears within either conversation's subflow as a side effect of expanding.
  - Collapsing either conversation returns the edge to conversation-level anchors.

### ✅ CTXB-P2R-T12 — Increase maximum zoom-out on the graph canvas
- **Description:** Allow the graph canvas to zoom out ~4× further than the current limit so large graphs with many nodes fit in the viewport without panning. Achieved by lowering `minZoom` on the React Flow component (e.g. from the default `0.5` to `0.125`).
- **Priority:** P2
- **Dependencies:** CTXB-P2R-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** `minZoom` prop update in `viewer/app/src/App.tsx`
- **Acceptance Criteria:**
  - The user can zoom out until the graph is approximately 4× smaller than the previous minimum zoom level.
  - All existing tests continue to pass.

## Phase 3: Authoring and Compile Target Selection

Intent: implement the workflows that mutate graph structure safely and let the user mark a concrete line of reasoning as the target for context compilation.

### ✅ CTXB-P3-T1 — Implement branch creation from any checkpoint
- **Description:** Add the UI and API workflow that creates a new conversation file from a selected checkpoint while preserving the exact parent conversation and parent message identifiers.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** branch creation controls in `viewer/index.html`, safe write path in `viewer/server.py`, branch creation tests
- **Acceptance Criteria:**
  - A user can create a new conversation from any checkpoint message.
  - The created file includes valid lineage metadata and appears as a child node after reload.
  - Branch creation satisfies PRD FR-4 and Flow B.

### ✅ CTXB-P3-T2 — Implement merge conversation creation with multi-parent lineage
- **Description:** Add the workflow that creates a new conversation file referencing two or more parent checkpoints without attempting to synthesize or auto-merge message bodies.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** merge selection UI, multi-parent save logic, merge workflow tests
- **Acceptance Criteria:**
  - A user can create a merge conversation from multiple checkpoints.
  - The created file records every parent reference deterministically.
  - The resulting node renders with multiple inbound edges and no implicit transcript synthesis.

### ✅ CTXB-P3-B1 — Expanding an empty merge node hides parent edges
- **Description:** When a user creates a merge conversation (which starts with empty `messages`) and clicks its expand button, the edges from both parent conversations to this merge node disappear from the canvas.
- **Priority:** P1
- **Dependencies:** CTXB-P3-T2, CTXB-P2R-T11
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - Expanding an empty merge node keeps all inbound parent edges visible and correctly anchored.
  - Collapsing the same node restores conversation-level edge anchors without data loss.
  - The fix covers both the two-parent case and any future n-parent merge nodes.
  - All existing tests continue to pass.

### ✅ CTXB-P3-T3 — Define the compile target model and export workspace layout
- **Description:** Specify what a selected branch means for compilation, how merge parents are represented, and where generated export artifacts are written on disk.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** compile-target contract, export directory contract, API and UI data model updates
- **Acceptance Criteria:**
  - The product can represent a chosen branch or lineage path as a deterministic compile target.
  - Export artifacts have a stable local directory structure.
  - Merge provenance is preserved explicitly in the selection model.

### ✅ CTXB-P3-T4 — Let the user select the active branch as a compile target
- **Description:** Add UI actions and state handling so the user can mark the active conversation or checkpoint lineage as the branch to compile into external context.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T3
- **Parallelizable:** no
- **Outputs / Artifacts:** compile target selection UI, selection persistence, API request payloads
- **Acceptance Criteria:**
  - The user can choose a concrete thought direction for compilation from the graph UI.
  - The selected target is unambiguous and serializable.
  - The workflow satisfies PRD FR-11 and Flow D / Flow E preconditions.

### ✅ CTXB-P3-T5 — Re-index and reconcile external file changes
- **Description:** Allow the user to refresh or re-index the workspace so that file additions, edits, or deletions performed by external agents or tools become visible without restarting the application.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T4, CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** refresh/re-index controls in `viewer/index.html`, server-side re-read logic, external-change tests
- **Acceptance Criteria:**
  - Newly added files appear after a refresh or re-index.
  - Deleted or modified files update the graph and current selection safely.
  - The implementation satisfies PRD FR-10 and NFR-8.

### ✅ CTXB-P3-T6 — Add message authoring to conversations — DONE (PASS, 2026-05-16)
- **Description:** Let the user add messages to an existing conversation via the inspector. The user provides role and content (paste or type). Messages are appended and persisted via `POST /api/file` with `overwrite: true`. Each new message gets a deterministic `message_id`.
- **Priority:** P1
- **Dependencies:** CTXB-P3-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** message authoring UI in inspector overlay, message ID generation logic, authoring tests
- **Acceptance Criteria:**
  - A user can add a message (role + content) to any conversation from the inspector.
  - The message is persisted to the conversation file and appears after graph refresh.
  - Each added message receives a unique, deterministic `message_id`.
  - Validation errors are surfaced to the user.

### CTXB-P3-T7 — Expose delete conversation action in the UI
- **Description:** Add a delete button to the conversation inspector that calls `DELETE /api/file` and refreshes the graph. Include a confirmation step to prevent accidental deletion.
- **Priority:** P1
- **Dependencies:** CTXB-P2-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** delete button in inspector overlay, confirmation dialog, delete action tests
- **Acceptance Criteria:**
  - A delete button is visible in the conversation inspector.
  - Clicking it shows a confirmation dialog before proceeding.
  - On confirm, the file is deleted via the API and the graph refreshes without the removed node.
  - Child conversations with lineage references to the deleted conversation show broken edges.

### CTXB-P3-T8 — Reorder messages within a conversation
- **Description:** Allow the user to change the linear order of messages inside a conversation. The inspector shows drag handles or move-up/move-down controls on each message. Reordering updates the `messages` array and persists via `POST /api/file` with `overwrite: true`. Cross-conversation edges that reference moved `message_id` values remain valid because IDs don't change — only array position does.
- **Priority:** P2
- **Dependencies:** CTXB-P3-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** message reorder UI in inspector, array mutation logic, reorder tests
- **Acceptance Criteria:**
  - A user can move a message up or down within the same conversation.
  - The reordered array is persisted and survives a graph refresh.
  - Existing lineage edges referencing any reordered message remain resolved.

### CTXB-P3-T9 — Move messages between conversations
- **Description:** Allow the user to move (cut + paste) a message from one conversation to another. The source conversation loses the message and the target conversation gains it. If the moved message was a lineage anchor (referenced by a child conversation's parent edge), the edge becomes broken — the UI warns before proceeding. Persists both files atomically.
- **Priority:** P2
- **Dependencies:** CTXB-P3-T6, CTXB-P3-T8
- **Parallelizable:** no
- **Outputs / Artifacts:** move-message action in inspector, two-file atomic save, broken-edge warning, move tests
- **Acceptance Criteria:**
  - A user can move a message from one conversation to another.
  - Both source and target files are updated and persisted.
  - If the message is a lineage anchor, the user is warned before the move proceeds.
  - The graph refreshes showing the updated message locations.

### CTXB-P3-T10 — Duplicate a conversation with its messages
- **Description:** Add a "Duplicate" action on the conversation inspector that creates a copy of the selected conversation with all its messages. The copy gets a new `conversation_id` and file name, and new `message_id` values for each message. The copy's lineage references the same parents as the original (if any), creating a sibling branch.
- **Priority:** P2
- **Dependencies:** CTXB-P3-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** duplicate action in inspector, ID regeneration logic, duplicate tests
- **Acceptance Criteria:**
  - A user can duplicate any conversation from the inspector.
  - The copy has distinct `conversation_id` and `message_id` values.
  - The copy preserves the same lineage parent references as the original.
  - The new node appears in the graph as a sibling of the original.

### CTXB-P3-T11 — Copy and paste messages across conversations
- **Description:** Implement clipboard-style copy/paste for messages. Copying a message stores it in an in-memory clipboard. Paste behavior depends on context: (A) paste with no conversation selected creates a new single-message conversation (a new root with no lineage), (B) paste with a conversation selected inserts the message into that conversation without automatic lineage connections — the user must manually connect it (reorder, set as anchor, etc.).
- **Priority:** P2
- **Dependencies:** CTXB-P3-T6, CTXB-P3-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** message clipboard state, paste-as-new-conversation logic, paste-into-conversation logic, copy/paste tests
- **Acceptance Criteria:**
  - A user can copy a message from the checkpoint inspector.
  - Pasting with no selection creates a new root conversation containing only the copied message.
  - Pasting with a conversation selected inserts the message into that conversation without creating lineage edges.
  - The pasted message gets a new unique `message_id`.
  - The graph refreshes after each paste operation.

### CTXB-P3-T12 — Connect messages across conversations via branch creation
- **Description:** Allow the user to connect a message from one conversation to a message in another conversation. Instead of creating a direct message-to-message edge (which would violate the schema) or duplicating entire chains (unpredictable), this action creates a new branch conversation from the source message containing a single copy of the target message with a new `message_id`. The result is a clean, predictable one-node branch that the user can extend. The UI flow: select a checkpoint (source), choose "Connect to…", select a checkpoint in another conversation (target), system creates a new branch from source with a copy of the target message.
- **Priority:** P2
- **Dependencies:** CTXB-P3-T1, CTXB-P3-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** cross-conversation connect action in inspector, branch-with-copied-message logic, connect tests
- **Acceptance Criteria:**
  - A user can initiate a connection from a checkpoint in one conversation to a checkpoint in another.
  - The action creates a new branch conversation from the source checkpoint.
  - The new branch contains one message: a copy of the target checkpoint's content with a new unique `message_id`.
  - No existing conversations or messages are modified.
  - The graph refreshes showing the new branch node with a lineage edge from the source.

### ✅ CTXB-P3-T13 — Apply external lineage manifest to canonicalize imported conversations
- **Description:** Add a `make canonicalize` command that reads a `lineage.json` manifest (produced by ChatGPTDialogs' `detect_lineage.py`) from a source dialog directory and outputs canonical conversation files with injected `conversation_id` and `lineage` fields into a target directory. This bridges the open-source detection step in ChatGPTDialogs with ContextBuilder's proprietary canonicalization pipeline. The command reads each file listed in the manifest, injects the detected metadata, validates the result against the canonical schema, and writes it to `canonical_json/` (or a user-specified output dir). Files not present in the manifest become explicit roots with a slug-derived `conversation_id`.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T1, CTXB-P1-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** `viewer/canonicalize.py` script, `make canonicalize` Makefile target, canonicalize tests
- **Acceptance Criteria:**
  - Running `make canonicalize DIALOG_DIR=… OUTPUT_DIR=…` produces canonical JSON files with `conversation_id` and `lineage` fields for all detected branches.
  - Files with no parent in the manifest are written as roots with a slug-derived `conversation_id`.
  - Output files pass the existing schema validation (`CTXB-P1-T1` rules).
  - The command is idempotent — running it twice on the same inputs produces identical output.
  - ContextBuilder server can load the output directory and display the full lineage graph with edges.

### CTXB-P3-T14 — Workspace validation pass after canonicalize
- **Description:** After `make canonicalize` writes all canonical files, run a cross-file workspace validation pass using `schema.validate_workspace`. Report any files with missing parent conversations or duplicate `conversation_id` values. This catches cases where a parent file failed to canonicalize but its child was written — the child's lineage edge will be broken and the user needs to know.
- **Priority:** P2
- **Dependencies:** CTXB-P3-T13
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - After writing all files, `canonicalize.py` runs `schema.validate_workspace` on the output directory.
  - Files with missing parent references are reported with a clear error message.
  - The command exits non-zero if any workspace-level errors are found.

## Phase 4: Hyperprompt Export and Compilation Pipeline

Intent: turn the selected branch into actual filesystem artifacts that Hyperprompt can compile, then produce the final continuation-ready Markdown context.

### ✅ CTXB-P4-T1 — Export selected graph nodes into deterministic Markdown files
- **Description:** Materialize the selected branch as a set of `.md` node files under `{dialog_dir}/export/{target_id}/nodes/`. Each file corresponds to one message and carries role, content, source `conversation_id`, and `message_id` in a stable front-matter + body representation. These files are the leaf inputs to the Hyperprompt `.hc` root file generated in CTXB-P4-T2.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T3, CTXB-P3-T4
- **Parallelizable:** no
- **Outputs / Artifacts:** generated `.md` export nodes under `{export_dir}/nodes/`, export metadata
- **Compiler context:** Hyperprompt binary at `/Users/egor/Development/GitHub/0AL/Hyperprompt/.build/release/hyperprompt` — reads `.hc` root file and resolves `.md` references relative to `--root`. Leaf `.md` files produced here are referenced by the `.hc` file generated in CTXB-P4-T2.
- **Acceptance Criteria:**
  - Repeated export of unchanged inputs yields identical Markdown node files.
  - Each export node preserves source `conversation_id`, `message_id`, role, and content.
  - Node filenames are deterministic (e.g., `{index:04d}_{message_id}.md`).
  - The output directory structure satisfies PRD FR-12 and §6.4.

### ✅ CTXB-P4-T2 — Generate a valid Hyperprompt root file for the selected branch
- **Description:** Build a root `.hc` file at `{export_dir}/root.hc` that references the exported Markdown nodes in deterministic order and nesting, matching Hyperprompt syntax. Hyperprompt syntax uses 4-space indentation, double-quoted strings, and detects file references by path separators (`.` or `/`). For merge conversations, parent lineage chains appear in `lineage.parents` order; merge messages come last. This controls the final compiled prompt structure.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** `{export_dir}/root.hc`, root-file generation logic
- **Hyperprompt `.hc` syntax:**
  - Each line: `"path/to/file.md"` or `"path/to/sub.hc"` or `"Inline text"`
  - Nesting: 4 spaces per level → Markdown heading depth
  - Comments: lines starting with `#`
  - Example: `"nodes/0001_msg_id.md"` nested under `"Conversation Title"`
- **Acceptance Criteria:**
  - The `.hc` file passes `hyperprompt root.hc --dry-run` with exit code 0.
  - References only `.md` files inside `{export_dir}/nodes/` — no path traversal.
  - For merge conversations, parent lineage chains appear in `lineage.parents` order.
  - The generated structure satisfies PRD FR-13 and §6.5.

### ✅ CTXB-P4-T3 — Integrate Hyperprompt compiler invocation
- **Description:** Invoke the Hyperprompt compiler (`/Users/egor/Development/GitHub/0AL/Hyperprompt/.build/release/hyperprompt`) as a subprocess to compile the generated `root.hc` into a final Markdown context artifact and manifest.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** `{export_dir}/compiled.md`, `{export_dir}/manifest.json`, compile diagnostics
- **Invocation:**
  ```
  hyperprompt {export_dir}/root.hc \
    --root {export_dir} \
    --output {export_dir}/compiled.md \
    --manifest {export_dir}/manifest.json \
    --stats
  ```
- **Exit codes to handle:** 0 success, 1 IO error, 2 syntax error, 3 resolution/circular error, 4 internal error
- **Acceptance Criteria:**
  - Successful compile writes `compiled.md` and `manifest.json` to `{export_dir}`.
  - Non-zero exits surface the exit code and stderr as actionable errors to the user.
  - Missing binary at the configured path surfaces a clear "Hyperprompt not found" error.
  - The integration satisfies PRD FR-14, FR-15, and NFR-11.

### ✅ CTXB-P4-T4 — Expose compile results and artifact locations
- **Description:** Show compile status, output paths, and failure details in the UI and API so the user can immediately use the generated context artifact with an external agent.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** result panel or artifact summary UI, compile status payloads
- **Acceptance Criteria:**
  - The user can find the generated `.hc` and final compiled `.md` without manual filesystem inspection.
  - Failed compiles show actionable diagnostics instead of silent failure.
  - The task satisfies PRD FR-15 and Flow D.

### ✅ CTXB-P4-T5 — Preserve provenance from compiled artifact back to graph selection
- **Description:** Ensure that the generated artifacts remain traceable to the originating graph selection and source conversation files.
- **Priority:** P1
- **Dependencies:** CTXB-P4-T1, CTXB-P4-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** traceability metadata, artifact naming or metadata conventions
- **Acceptance Criteria:**
  - A user can determine which compile target produced a given compiled Markdown artifact.
  - Artifact provenance survives refresh and repeated compilation.
  - The implementation satisfies PRD FR-16 and §6.6.

## Phase 5: Hardening, Tests, and Documentation

Intent: lock down graph and compile behavior with regression coverage and make the end-to-end workflow understandable for contributors and operators.

### ✅ CTXB-P5-T1 — Add automated tests for schema validation and graph integrity failures
- **Description:** Extend the test suite to cover invalid imports, duplicate IDs, missing parents, malformed lineage, and graph diagnostics.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5
- **Parallelizable:** yes
- **Outputs / Artifacts:** expanded test fixtures and server tests
- **Acceptance Criteria:**
  - Duplicate IDs, missing parents, and malformed lineage are covered by automated tests.
  - The suite fails when graph integrity behavior regresses.

### ✅ CTXB-P5-T2 — Add automated tests for branch, merge, and compile target selection workflows
- **Description:** Cover the authoring and selection flows that create or choose the reasoning branch to export.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** authoring and selection test coverage
- **Acceptance Criteria:**
  - Branch and merge workflows are protected by automated tests.
  - Compile target selection is deterministic and regression-tested.

### ✅ CTXB-P5-T3 — Add automated tests for Markdown export, `.hc` generation, and Hyperprompt compile integration
- **Description:** Cover export node generation, root `.hc` creation, compiler invocation, missing compiler failures, and successful compiled artifact output.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** export and compile integration tests, Hyperprompt-backed fixtures or mocks
- **Acceptance Criteria:**
  - The pipeline catches broken references, invalid compiler setup, and incorrect artifact generation.
  - Successful compile flows are covered end-to-end.

### ✅ CTXB-P5-T4 — Update product and contributor documentation for the graph-to-context workflow
- **Description:** Rewrite repository documentation so it matches the graph product scope, the canonical file contract, the Hyperprompt dependency, and the compile workflow.
- **Priority:** P1
- **Dependencies:** CTXB-P4-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** `README.md` and supporting docs
- **Acceptance Criteria:**
  - The docs explain what ContextBuilder owns and what external agents own.
  - The docs describe root, branch, merge, export node, `.hc`, and compiled artifact concepts.
  - A contributor can understand the local graph-to-context pipeline.

### CTXB-P5-T6 — Add HYPERPROMPT_BINARY variable to Makefile serve target
- **Description:** Add a `HYPERPROMPT_BINARY` make variable to the `serve` target so contributors can pass a custom Hyperprompt binary path via `make serve` without editing the Makefile directly.
- **Priority:** P2
- **Dependencies:** CTXB-P5-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** Updated `Makefile`
- **Acceptance Criteria:**
  - `make serve DIALOG_DIR=... HYPERPROMPT_BINARY=...` passes the binary path to `viewer/server.py --hyperprompt-binary`.
  - Default value matches `DEFAULT_HYPERPROMPT_BINARY` in `server.py`.

### ✅ CTXB-P5-B1 — Compile fails with "Hyperprompt not found" for branch compilation on arm64 build layout
- **Description:** Reproduce and fix runtime compile failure shown in UI:
  - `Compile`
  - `COMPILE ERROR`
  - `Hyperprompt not found`
  - `Binary not found at: /Users/egor/Development/GitHub/0AL/Hyperprompt/.build/release/hyperprompt`
  The real local binary path is `/Users/egor/Development/GitHub/0AL/Hyperprompt/.build/arm64-apple-macosx/release/hyperprompt`. Fix path resolution so branch compilation works out of the box on this layout. Optional implementation: maintain a project-local copy/symlink under `deps/` and use that as default fallback.
- **Priority:** P1
- **Dependencies:** CTXB-P4-T3, CTXB-P5-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated binary resolution strategy (`server.py` and/or `Makefile`), docs note for local Hyperprompt path
- **Acceptance Criteria:**
  - Compile succeeds without manual path edits when Hyperprompt exists at the arm64 path above.
  - UI no longer shows "Hyperprompt not found" for this environment.
  - `POST /api/compile` returns actionable path diagnostics when both default and fallback locations are missing.
  - If `deps/` fallback is used, setup and lookup behavior are documented.

### ✅ CTXB-P5-B2 — Compile fails with Hyperprompt syntax error: multiple root nodes in generated export
- **Description:** Reproduce and fix compile failure when compiling a conversation chain:
  - `COMPILE ERROR — EXIT CODE: 2`
  - `Hyperprompt compiler failed: Syntax error`
  - `Error: Multiple root nodes (depth 0) found at line 2, line 9, line 20, line 39, line 64, line 91. Hypercode documents must have exactly one root. Exit code: 2.`
  The generated `.hc` structure appears to emit multiple depth-0 roots. Investigate and adjust export formatting so the document has exactly one root and all included conversation/message nodes are nested at a single intended indentation level.
- **Priority:** P1
- **Dependencies:** CTXB-P4-T2, CTXB-P4-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated `.hc` generation strategy in `viewer/server.py`, regression tests for compile success on multi-conversation chains, docs note for expected root.hc structure
- **Acceptance Criteria:**
  - Compiling the same conversation chain no longer fails with "Multiple root nodes (depth 0)".
  - Generated `root.hc` has exactly one depth-0 root node.
  - Conversation/message includes are emitted with consistent one-level nesting under that root.
  - `POST /api/compile` succeeds for the affected chain and existing compile tests remain green.

### ✅ CTXB-P5-B3 — Compile fails when selected branch has zero checkpoints (empty title node in root.hc)
- **Description:** When a BRANCH conversation has no checkpoints (0 messages), the export still emits it as a title-only node (`    "Testing"`) in `root.hc` with no file children. Depending on Hyperprompt parser behaviour, an empty container node may cause a compile error. Reproduces with `conv-march-branch` from the canonical 30-file workspace — the compile panel shows `COMPILE ERROR — EXIT CODE: 2` with a "Multiple root nodes" message (observed against a stale server, but the underlying edge case — a branch with no content — is not yet handled or tested). Fix the export to either skip zero-checkpoint conversations or emit them in a valid form; add a regression test.
- **Priority:** P2
- **Dependencies:** CTXB-P5-B2
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated export logic in `viewer/server.py`, regression test in `tests/test_export.py`
- **Acceptance Criteria:**
  - Selecting a BRANCH node with 0 checkpoints and clicking Compile does not produce a Hyperprompt syntax error.
  - If the branch has no content, the compile either succeeds (emitting only the parent lineage) or surfaces a clear user-facing message explaining why the branch is empty.
  - Existing compile/export tests remain green.

### ✅ CTXB-P5-T5 — Add end-to-end verification guidance for handing compiled context to an external agent
- **Description:** Document the local operator flow from JSON conversations to final compiled Markdown so the compiled artifact can be used immediately in downstream agent workflows.
- **Priority:** P1
- **Dependencies:** CTXB-P5-T3, CTXB-P5-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** workflow notes, validation checklist, operator guidance
- **Acceptance Criteria:**
  - A user can follow the documented local workflow from JSON conversations to final compiled context output.
  - The final handoff path to an external agent is explicit and reproducible.

## Phase 6: SpecGraph Specification Viewer

Intent: reuse the existing ContextBuilder graph rendering infrastructure to visualize SpecGraph specification nodes (YAML) alongside conversations, providing a unified graph exploration experience for both conversation lineage and specification dependency graphs.

PRD: [CTXB-P6-T1_SpecGraph_Viewer.md](ARCHIVE/CTXB-P6-T1_SpecGraph_Viewer/CTXB-P6-T1_SpecGraph_Viewer.md)

### ✅ CTXB-P6-T1 — YAML spec ingestion and graph construction
- **Description:** Create `viewer/specgraph.py` module that reads `*.yaml` files from a configurable spec directory, parses them with PyYAML, and builds an in-memory graph. Extract nodes (id, title, kind, status, maturity) and edges from `depends_on`, `refines`, and `relates_to` fields. Identify root nodes (no incoming `refines`). Surface diagnostics for missing edge targets and malformed YAML. Be tolerant of unknown fields to handle schema evolution.
- **Priority:** P0
- **Dependencies:** none
- **Parallelizable:** no
- **Outputs / Artifacts:** `viewer/specgraph.py`, PyYAML dependency
- **Acceptance Criteria:**
  - `load_spec_nodes(spec_dir)` returns parsed node dicts for all valid YAML files.
  - `build_spec_graph(nodes)` produces a graph with nodes, edges, roots, and diagnostics.
  - Edges are extracted from `depends_on`, `refines`, and `relates_to` with correct directionality.
  - Missing edge targets produce diagnostics, not crashes.
  - Unknown YAML fields are preserved, not rejected.

### ✅ CTXB-P6-T2 — Spec graph API endpoints
- **Description:** Add `--spec-dir` CLI argument to `viewer/server.py`. Implement `GET /api/spec-graph` returning the full spec graph (nodes, edges, roots, diagnostics, summary) in a shape consistent with `GET /api/graph`. Implement `GET /api/spec-node?id=...` returning a single spec node with full YAML content. Existing conversation endpoints remain unchanged.
- **Priority:** P0
- **Dependencies:** CTXB-P6-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** updated `viewer/server.py`
- **Acceptance Criteria:**
  - `GET /api/spec-graph` returns all spec nodes and edges with summary counts.
  - `GET /api/spec-node?id=SG-SPEC-0001` returns the full parsed YAML content for that node.
  - Unknown `id` returns 404.
  - Conversation API endpoints are unaffected by the addition.
  - Server starts without `--spec-dir` (spec features are simply unavailable).

### ✅ CTXB-P6-T3 — Makefile SPEC_DIR support
- **Description:** Add a `SPEC_DIR` variable to the `serve`, `dev`, and `api` Makefile targets. When provided, pass `--spec-dir` to `viewer/server.py`. When omitted, the server starts without spec graph support.
- **Priority:** P1
- **Dependencies:** CTXB-P6-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated `Makefile`
- **Acceptance Criteria:**
  - `make serve DIALOG_DIR=... SPEC_DIR=...` passes both directories to the server.
  - `make serve DIALOG_DIR=...` (no SPEC_DIR) still works without errors.
  - `make dev DIALOG_DIR=... SPEC_DIR=...` starts both API and UI with spec support.

### ✅ CTXB-P6-T4 — Spec node React component
- **Description:** Create a `SpecNode.tsx` custom React Flow node type for collapsed spec nodes. Display: id badge, title, kind label, status badge (color-coded by lifecycle stage), maturity progress bar (0.0-1.0). Visual style must be distinct from `ConversationNode` — use a different shape, border, or color scheme to avoid confusion.
- **Priority:** P0
- **Dependencies:** CTXB-P6-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** `viewer/app/src/SpecNode.tsx`, node type registration in `App.tsx`
- **Acceptance Criteria:**
  - Spec nodes render with id, title, kind, status badge, and maturity bar.
  - Status badges are color-coded (e.g., idea=gray, stub=yellow, outlined=blue, specified=indigo, linked=green, reviewed=teal, frozen=slate).
  - Spec nodes are visually distinct from conversation nodes at a glance.
  - Clicking a spec node triggers selection (for inspector integration).

### ✅ CTXB-P6-T5 — Spec edge rendering with typed styles
- **Description:** Render the three spec edge types with distinct visual styles on the React Flow canvas. `depends_on`: solid line, arrow, warm/red tint. `refines`: dashed line, arrow, blue tint. `relates_to`: dotted line, no arrowhead, gray tint. Add edge type to edge labels or tooltips.
- **Priority:** P1
- **Dependencies:** CTXB-P6-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** edge style definitions in `viewer/app/src/theme.css` or inline styles, edge type mapping in `useGraphData.ts`
- **Acceptance Criteria:**
  - `depends_on`, `refines`, and `relates_to` edges are visually distinguishable.
  - Edge direction is correct (arrow points from source to target per SpecGraph semantics).
  - Edge labels or tooltips show the edge type.

### ✅ CTXB-P6-T6 — Graph mode switcher
- **Description:** Add a mode toggle or tab control in the sidebar to switch between "Conversations" and "Specifications" graph views. Each mode fetches its respective API endpoint (`/api/graph` or `/api/spec-graph`), clears the canvas, and renders with the appropriate node/edge types. Persist the active mode in sessionStorage. Hide the Specifications tab when the server has no `--spec-dir` configured (detect via a new `GET /api/capabilities` endpoint or an error response from `/api/spec-graph`).
- **Priority:** P0
- **Dependencies:** CTXB-P6-T4, CTXB-P6-T5
- **Parallelizable:** no
- **Outputs / Artifacts:** updated `viewer/app/src/Sidebar.tsx`, `viewer/app/src/App.tsx`, `viewer/app/src/useGraphData.ts`
- **Acceptance Criteria:**
  - The sidebar shows a Conversations / Specifications toggle when spec support is available.
  - Switching modes loads the correct graph data and renders the correct node types.
  - Active mode persists across page reload.
  - The toggle is hidden when spec support is not configured.

### ✅ CTXB-P6-T7 — Spec inspector panel
- **Description:** Extend the inspector overlay to display spec node details when a spec node is selected. Show: metadata table (id, kind, status, maturity, depends_on, refines, relates_to), acceptance criteria list, `specification.objective`, scope (in/out lists), terminology entries, decisions list. Reuse the existing inspector panel layout and interaction patterns (slide-in, dismiss on empty canvas click).
- **Priority:** P1
- **Dependencies:** CTXB-P6-T4, CTXB-P6-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated `viewer/app/src/InspectorOverlay.tsx` or new `SpecInspector.tsx`
- **Acceptance Criteria:**
  - Clicking a spec node opens the inspector with full metadata.
  - Acceptance criteria are rendered as a checklist.
  - Specification objective, scope, terminology, and decisions are displayed.
  - Clicking empty canvas dismisses the inspector.
  - Inspector works for all three existing spec nodes (0001, 0002, 0003).

### ✅ CTXB-P6-T8 — Expanded spec node with sub-items
- **Description:** Create an `ExpandedSpecNode.tsx` group container (analogous to `ExpandedConversationNode`) that shows a spec's internal structure as sub-nodes when expanded. Sub-items include: acceptance criteria (one sub-node per criterion), decisions (one sub-node per decision), and invariants (one sub-node per invariant). Each sub-item shows a brief label and can be selected to view full content in the inspector.
- **Priority:** P2
- **Dependencies:** CTXB-P6-T4, CTXB-P6-T7
- **Parallelizable:** yes
- **Outputs / Artifacts:** `viewer/app/src/ExpandedSpecNode.tsx`, `viewer/app/src/SpecSubItemNode.tsx`
- **Acceptance Criteria:**
  - Expanding a spec node shows its acceptance criteria, decisions, and invariants as sub-nodes.
  - Collapsing returns to the compact spec node.
  - Sub-items are visually distinguishable by type (criterion vs. decision vs. invariant).
  - Selecting a sub-item shows its full content in the inspector.
  - Cross-spec edges update anchors correctly when expanded/collapsed.

### ✅ CTXB-P6-T9 — Python tests for spec ingestion and API
- **Description:** Add test coverage for `viewer/specgraph.py` and the spec API endpoints. Cover: YAML parsing of valid and malformed files, graph construction with edges and roots, missing edge target diagnostics, API response shape for `GET /api/spec-graph` and `GET /api/spec-node`, 404 for unknown node id, graceful behavior when `--spec-dir` is not configured.
- **Priority:** P1
- **Dependencies:** CTXB-P6-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** `tests/test_specgraph.py`
- **Acceptance Criteria:**
  - YAML parsing tests cover valid specs, malformed YAML, and files with unknown fields.
  - Graph construction tests verify edge extraction, root identification, and diagnostics.
  - API tests verify response shape, 404 handling, and no-spec-dir graceful degradation.
  - All tests pass with `make test`.

## Phase 7: Technical Debt and Quality

Intent: address the known architectural and code quality problems identified in [docs/PROBLEMS.md](../docs/PROBLEMS.md). Tasks are grouped by area. None of these tasks add user-visible features; they improve reliability, performance, maintainability, and portability.

### ✅ CTXB-P7-T1 — Workspace cache with mtime-based invalidation
- **Status:** DONE (2026-04-12, PASS)
- **Description:** Every API call currently re-reads all JSON files, re-validates, and rebuilds the entire graph snapshot from scratch. Add a request-scoped or server-level workspace cache keyed on per-file `(name, mtime, size)` tuples. On each request, scan directory stats only (no file reads), compare against the cache key, and rebuild only changed files. The cache must be invalidated atomically when any file changes — correct graph state takes strict precedence over performance.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** no
- **Source:** docs/PROBLEMS.md §1, §17
- **Outputs / Artifacts:** cache layer in `viewer/server.py`, regression tests confirming stale-read protection
- **Acceptance Criteria:**
  - A request to `/api/conversation?conversation_id=X` does not read unchanged files that were already loaded for a prior `/api/graph` call in the same second.
  - Any file change (new file, modified file, deleted file) is reflected within one subsequent request.
  - All existing API contract tests continue to pass.

### ✅ CTXB-P7-T2 — Split server.py into focused modules
- **Status:** DONE (2026-05-14, PASS)
- **Description:** `viewer/server.py` (~1500 lines) bundles HTTP routing, graph indexing, export pipeline, compile invocation, provenance rendering, static file serving, and SSE watching into one file. Extract at least: `graph.py` (graph building, lineage traversal, compile-target construction), `export.py` (export_graph_nodes, generate_hc_root, render_markdown, provenance), `compile.py` (hyperprompt resolution, invocation). Keep `server.py` as thin routing + request/response handling only.
- **Priority:** P2
- **Dependencies:** CTXB-P7-T1
- **Parallelizable:** no
- **Source:** docs/PROBLEMS.md §2
- **Outputs / Artifacts:** `viewer/graph.py`, `viewer/export.py`, `viewer/compile.py`; updated `viewer/server.py`
- **Acceptance Criteria:**
  - `viewer/server.py` is reduced to ≤400 lines of routing and handler code.
  - All existing tests pass without modification.
  - Public function signatures are unchanged from the test perspective.

### ✅ CTXB-P7-T3 — Introduce typed dataclasses for graph objects
- **Status:** DONE (2026-05-14, PASS)
- **Description:** Graph nodes, edges, checkpoints, and compile targets are currently all `dict[str, Any]`. Replace the most-accessed internal types with `@dataclass` or `TypedDict` definitions. Minimum scope: `GraphNode`, `GraphEdge`, `Checkpoint`. `CompileTargetPayload` is already defined as a TypedDict in `schema.py` but is not enforced — start enforcing it.
- **Priority:** P2
- **Dependencies:** CTXB-P7-T2
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §2
- **Outputs / Artifacts:** typed dataclasses in `viewer/graph.py` (or `viewer/schema.py`); mypy clean
- **Acceptance Criteria:**
  - `GraphNode`, `GraphEdge`, and `Checkpoint` are typed dataclasses or TypedDicts.
  - `mypy viewer/` passes with no errors on the new types.
  - All existing tests pass.

### ✅ CTXB-P7-T4 — Extract shared message validation helper in schema.py
- **Status:** DONE (2026-04-12, PASS)
- **Description:** `collect_normalization_errors()` and `collect_canonical_validation_errors()` each contain ~60 lines of nearly identical message-validation logic. Extract it into a private `_validate_messages(messages, errors)` helper used by both callers.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §3
- **Outputs / Artifacts:** updated `viewer/schema.py`
- **Acceptance Criteria:**
  - The shared helper exists and is used by both validation functions.
  - No duplication of the per-message validation loop remains.
  - All existing schema and validation tests pass.

### ✅ CTXB-P7-T5 — Remove hardcoded developer paths
- **Status:** DONE (2026-04-12, PASS)
- **Description:** `DEFAULT_HYPERPROMPT_BINARY` in `server.py` is hardcoded to `/Users/egor/...`. The Makefile defaults `CANONICAL_DIR` and `SPEC_DIR` to paths under `$(HOME)/Development/GitHub/...`. Replace `DEFAULT_HYPERPROMPT_BINARY` with a relative/discoverable default (e.g. `deps/hyperprompt` only). Update Makefile defaults to use safe, project-relative or user-overridable paths with no hardcoded layout assumption.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §4
- **Outputs / Artifacts:** updated `viewer/server.py`, updated `Makefile`
- **Acceptance Criteria:**
  - `DEFAULT_HYPERPROMPT_BINARY` does not contain any absolute user-specific path.
  - `make serve DIALOG_DIR=...` works without relying on a hardcoded `$(HOME)/Development/...` layout.
  - Binary resolution still tries `deps/hyperprompt` as the last fallback.

### ✅ CTXB-P7-T6 — Consolidate path traversal protection in dialog_path_for_name
- **Status:** DONE (2026-04-12, PASS)
- **Description:** Path containment checks currently live in `safe_dialog_path()` (HTTP layer only). Internal callers (`load_workspace_payloads`, `validate_write_request`) call `dialog_path_for_name` directly without containment checks. Move the containment check into `dialog_path_for_name` itself so it is enforced for all callers, not just HTTP handlers. Raise a `ValueError` if the resolved path escapes `dialog_dir`.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §5
- **Outputs / Artifacts:** updated `viewer/server.py`; test for path-escape rejection
- **Acceptance Criteria:**
  - Calling `dialog_path_for_name(dialog_dir, "../../etc/passwd.json")` raises `ValueError`.
  - `safe_dialog_path` delegates to the updated function without duplicating the check.
  - All existing tests pass.

### CTXB-P7-T7 — Fix SSE spec-watch thread management
- **Description:** `handle_spec_watch()` blocks a server thread indefinitely with a `while True: time.sleep(1)` polling loop. Each browser tab holds one thread permanently with no timeout or limit. Add: (1) a maximum connection timeout (e.g. 5 minutes) after which the SSE stream is closed gracefully, (2) a server-level connection counter with a hard limit (e.g. 5 concurrent watchers), and (3) consider replacing polling with `watchdog` or `os.scandir` + `stat` caching to reduce per-poll overhead.
- **Priority:** P2
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §6
- **Outputs / Artifacts:** updated `handle_spec_watch` in `viewer/server.py`
- **Acceptance Criteria:**
  - An SSE connection is closed server-side after the configured timeout.
  - No more than N concurrent spec-watch connections are allowed (configurable constant).
  - The browser frontend reconnects automatically after server-side close (EventSource auto-reconnect).

### ✅ CTXB-P7-T8 — Add rmtree safety marker to export directory
- **Status:** DONE (2026-04-12, PASS)
- **Description:** `export_graph_nodes()` calls `shutil.rmtree(export_dir)` unconditionally before writing. If path construction is wrong, this could delete arbitrary directories. Write a sentinel file (e.g. `.ctxb_export`) into the export directory at creation time. Before `rmtree`, verify the sentinel exists; if it doesn't, abort with an error instead of deleting.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §12
- **Outputs / Artifacts:** sentinel write/check logic in `viewer/server.py` (or `viewer/export.py` after T2)
- **Acceptance Criteria:**
  - A directory without `.ctxb_export` is never deleted by the export pipeline.
  - Export to a fresh path creates the sentinel before writing node files.
  - Re-export to an existing path verifies the sentinel before `rmtree`.

### ✅ CTXB-P7-T9 — Decompose App.tsx god component — DONE (PASS, 2026-05-14)
- **Description:** `App.tsx` (590 lines) owns 15+ concerns including selection state, compile target, viewport, search, chat, edge highlighting, and keyboard shortcuts. Extract at minimum: (1) `useSelectionState` hook (selectedConversationId, selectedMessageId, compileTarget), (2) `useViewportSync` hook (panToNode, fitNodes, panToPoint, onMoveEnd), (3) `useKeyboardShortcuts` hook. The component itself should orchestrate these hooks and delegate to the inspector/search/chat subcomponents it already mounts.
- **Priority:** P2
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §7
- **Outputs / Artifacts:** `viewer/app/src/useSelectionState.ts`, `viewer/app/src/useViewportSync.ts`, `viewer/app/src/useKeyboardShortcuts.ts`; refactored `App.tsx`
- **Acceptance Criteria:**
  - `App.tsx` is reduced to ≤250 lines.
  - Extracted hooks cover the functionality described above.
  - No behaviour regressions (manual smoke test + existing smoke tests pass).

### ✅ CTXB-P7-T10 — Add React Error Boundaries — DONE (PASS, 2026-04-12)
- **Description:** There are no `ErrorBoundary` components in the React app. A runtime error in any component crashes the entire UI to a white screen. Add error boundaries at: (1) the top-level `AppInner` wrapper, (2) the inspector panels (`SpecInspector`, `InspectorOverlay`), (3) the ReactFlow canvas. Each boundary should render a "Something went wrong" fallback with a Retry button.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §8
- **Outputs / Artifacts:** `viewer/app/src/ErrorBoundary.tsx`; applied at three locations in `App.tsx`
- **Acceptance Criteria:**
  - A thrown error inside `SpecInspector` shows the fallback UI without crashing the graph canvas.
  - The Retry button resets the error boundary state.
  - The top-level boundary catches errors from any unprotected component.

### ✅ CTXB-P7-T11 — Enable TypeScript strict mode and add ESLint — DONE (PASS, 2026-05-14)
- **Description:** Add `"strict": true` to `tsconfig.json`. Add ESLint with `@typescript-eslint/recommended` rules. Fix all resulting type errors (primarily `as` casts and implicit `any`). Add `npm run typecheck` (`tsc --noEmit`) and `npm run lint` scripts to `package.json`.
- **Priority:** P2
- **Dependencies:** CTXB-P7-T9
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §9
- **Outputs / Artifacts:** updated `tsconfig.json`, `.eslintrc.json`, `package.json`
- **Acceptance Criteria:**
  - `npm run typecheck` passes with zero errors.
  - `npm run lint` passes with zero errors.
  - No `as` casts for data fields that could be replaced with proper generics.

### ✅ CTXB-P7-T12 — Extract shared data-fetching base hook — DONE (PASS, 2026-05-14)
- **Description:** `useGraphData` and `useSpecGraphData` independently implement fetch + loading/error state + refresh. Extract a shared `useFetchedData<T>(url, transform)` base hook to deduplicate the pattern. Additionally, add SSE auto-refresh to `useGraphData` (analogous to the existing `spec-watch` listener in `useSpecGraphData`) so conversation graph users don't need to manually refresh after external file changes.
- **Priority:** P2
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §10
- **Outputs / Artifacts:** `viewer/app/src/useFetchedData.ts`; updated `useGraphData.ts`, `useSpecGraphData.ts`
- **Acceptance Criteria:**
  - Both hooks use the shared base for fetch + loading/error/refresh.
  - `useGraphData` reacts to conversation file changes without a manual refresh (requires a new `GET /api/watch` or polling, or reusing the existing SSE pattern).
  - No behaviour regressions.

### ✅ CTXB-P7-T13 — Add CI pipeline (GitHub Actions) — DONE (PASS, 2026-05-15)
- **Description:** Add a GitHub Actions workflow that runs on every push and PR. Minimum checks: (1) `make test` (Python unit tests), (2) `make lint` (py_compile), (3) `npm run typecheck` (TypeScript), (4) `npm run build` (Vite production build). Run Python checks with Python 3.11.
- **Priority:** P1
- **Dependencies:** CTXB-P7-T11
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §16
- **Outputs / Artifacts:** `.github/workflows/ci.yml`
- **Acceptance Criteria:**
  - The CI workflow runs on push to any branch and on PR to main.
  - All four checks must pass for the workflow to succeed.
  - Failures produce actionable output (test names, type errors, build errors).

### ✅ CTXB-P7-T14 — Expose compile capability in /api/capabilities and surface in UI — DONE (PASS, 2026-04-12)
- **Description:** `/api/capabilities` currently only reports `spec_graph`. Add a `compile` flag: `true` when the Hyperprompt binary is resolvable at server startup, `false` otherwise. In the UI, grey out or hide the Compile button when `compile` is false, and show an inline tooltip explaining the binary is not configured.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §14
- **Outputs / Artifacts:** updated `handle_capabilities` in `viewer/server.py`; updated compile affordances in `viewer/app/src/InspectorOverlay.tsx`
- **Acceptance Criteria:**
  - `GET /api/capabilities` includes `"compile": true/false`.
  - The Compile button is disabled with a visible explanation when `compile` is false.
  - No user needs to click Compile and receive a cryptic 422 to discover the binary is missing.

### CTXB-P7-T15 — Replace SHA-1 with SHA-256 for conversation ID derivation
- **Description:** `derive_conversation_id()` in `schema.py` uses SHA-1 with a 12-character hex truncation. Replace with SHA-256 and keep the same 12-character truncation length (collision probability is still acceptable for a local tool). This is a non-breaking change because the function is only called for imported roots that lack a `conversation_id`; canonical files already have stable IDs.
- **Priority:** P2
- **Dependencies:** none
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §13
- **Outputs / Artifacts:** updated `viewer/schema.py`
- **Acceptance Criteria:**
  - `derive_conversation_id` uses `hashlib.sha256`, not `hashlib.sha1`.
  - Existing tests that assert on specific derived IDs are updated.
  - No other behaviour changes.

### CTXB-P7-T16 — Hide AgentChat behind a feature flag
- **Description:** `AgentChat.tsx` exposes a chat UI with a hardcoded mock adapter. The button is always visible, implying functional AI assistance that does not exist. Until a real `/api/agent` endpoint is implemented, hide the `AgentChatTrigger` button behind a `capabilities.agent` feature flag (default `false`). The component can remain in the codebase for future development.
- **Priority:** P2
- **Dependencies:** CTXB-P7-T14
- **Parallelizable:** yes
- **Source:** docs/PROBLEMS.md §15
- **Outputs / Artifacts:** updated `App.tsx`; updated `handle_capabilities` in `viewer/server.py`
- **Acceptance Criteria:**
  - The chat trigger button is not rendered when `capabilities.agent` is `false` or absent.
  - `GET /api/capabilities` returns `"agent": false` (placeholder for future).
  - Existing smoke tests are updated to reflect the hidden button.

## Phase 8: SpecPM Lifecycle Integration

Intent: extend the SpecPM viewer slice built in Phase 6 to cover the full upstream-to-downstream lifecycle, including the import handoff layer produced by SpecGraph.

### ✅ CTXB-P8-T0 — Unified SpecPM lifecycle panel (SpecPMLifecyclePanel)
- **Status:** DONE (2026-04-23)
- **Description:** Replace `SpecPMExportPreview` (single-stage overlay) with `SpecPMLifecyclePanel`: a unified panel covering all four lifecycle stages (export → handoff → materialization → import). Backend aggregates the four SpecGraph `runs/` artifacts into a single `GET /api/specpm/lifecycle` read-model. Frontend shows one package card per `package_id` with 4 status columns, an `import_source` summary header, an artifact availability strip, and 3 action buttons (Build Export Preview / Materialize / Build Import Preview). The Materialize button auto-chains `build-import-preview` after completion.
- **Priority:** P1
- **Dependencies:** CTXB-P6-T1
- **Outputs / Artifacts:** `viewer/server.py` (lifecycle aggregator + 8 new routes), `viewer/app/src/SpecPMLifecyclePanel.tsx`, `viewer/app/src/SpecPMLifecyclePanel.css`; `SpecPMExportPreview.tsx` reduced to a compatibility re-export
- **Acceptance Criteria:**
  - `GET /api/specpm/lifecycle` returns normalized package cards joining all 4 artifacts; missing artifacts return `available: false` without crashing.
  - Join uses primary key only (`package_preview.metadata.id` / `package_identity.package_id` / `manifest_summary.package_id`); fallback to `export_id`/`bundle_id` only when primary is absent.
  - Panel shows artifact availability strip, import_source header, and package lifecycle cards with 4 status columns.
  - Materialize button chains build-import-preview → reload automatically.
  - Old `/api/specpm/preview` and `/api/specpm/preview/build` routes remain functional as aliases.

### CTXB-P8-T1 — Add 5th lifecycle stage: import_handoff
- **Description:** Extend the lifecycle panel and backend aggregator with a 5th stage (`import_handoff`) sourced from `runs/specpm_import_handoff_packets.json`, produced by SpecGraph supervisor flag `--build-specpm-import-handoff-packets`. Join key: `manifest_summary.package_id`. Add `GET /api/specpm/import-handoff` and `POST /api/specpm/build-import-handoff-packets`. Extend the Materialize chain to: materialize → build-import-preview → build-import-handoff-packets → reload. Add `target_route.route_kind` as a routing badge in the 5th column. Add new STATUS_TONE entries: `ready_for_lane` (ready), `draft_visible_only` (draft), `blocked_by_import_gap` (blocked), `invalid_import_contract` (blocked).
- **Priority:** P2
- **Dependencies:** CTXB-P8-T0; SpecGraph branch `codex/specpm-import-handoff` merged to main
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated `viewer/server.py`, `viewer/app/src/SpecPMLifecyclePanel.tsx`, `viewer/app/src/SpecPMLifecyclePanel.css`
- **Acceptance Criteria:**
  - `GET /api/specpm/lifecycle` includes `import_handoff` in each package card.
  - `POST /api/specpm/build-import-handoff-packets` invokes supervisor and refreshes the stage.
  - Materialize chain is extended automatically (no extra button click needed).
  - All 5 stage columns render correctly; missing import_handoff artifact shows `available: false` without error.
  - New status vocabulary renders with correct tone colours.

### ✅ CTXB-P8-T2 — SpecPM lifecycle badge on SpecNode
- **Status:** DONE (2026-05-13, PASS)
- **Description:** Show the current SpecPM lifecycle status directly on spec nodes in the graph canvas. A small pill badge (e.g. `draft_materialized`, `ready_for_review`, `blocked`) appears on the node, sourced from the lifecycle read-model. The badge updates when the lifecycle panel is refreshed. Nodes with no lifecycle entry show no badge.
- **Priority:** P3
- **Dependencies:** CTXB-P8-T0, CTXB-P6-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** badge rendering in `viewer/app/src/SpecNode.tsx`; lifecycle data passed via context or props
- **Acceptance Criteria:**
  - Spec nodes with a lifecycle entry show the dominant status (export_status or overall worst-case) as a pill.
  - Badge colours match the STATUS_TONE vocabulary from the lifecycle panel.
  - Nodes with no lifecycle entry are unchanged.
  - Badge does not interfere with existing node interactions (click, expand, inspector).

## Phase 9: Graph UX Improvements

Intent: reduce friction in daily spec-authoring and review workflows by improving how the graph communicates change, supports exploration, and responds to user intent.

### CTXB-P9-T1 — Change highlighting on SSE reload
- **Description:** When the spec-watch SSE stream delivers a `change` event, identify which nodes changed since the previous graph snapshot (by comparing `updated_at` or file mtime). Flash changed nodes with a brief highlight animation and show a top-bar notice ("3 specs updated") with a clickable list that pans to each updated node. The highlight fades after ~3 seconds. A "recently changed" marker remains in the sidebar list until the user clicks the node.
- **Priority:** P1
- **Dependencies:** CTXB-P6-T6 (SSE spec-watch already in `useSpecGraphData`)
- **Parallelizable:** yes
- **Outputs / Artifacts:** change-detection logic in `useSpecGraphData.ts`; flash animation in `SpecNode.css`; top-bar notice component
- **Acceptance Criteria:**
  - Nodes whose file mtime changed since the last load flash visually for ~3 seconds.
  - A top-bar notice counts updated specs and lists them; clicking a name pans to the node.
  - No false positives on unchanged nodes.
  - Works in all view modes (tree, linear, canonical).

### CTXB-P9-T2 — Pin + compare two specs side-by-side
- **Description:** Add a "Pin" button to the SpecInspector header. Pinning a spec locks it in a secondary inspector panel on the left while the primary inspector tracks the current graph selection. Both panels are visible simultaneously, allowing the user to compare acceptance criteria, edges, and maturity between two specs without losing context. Clicking "Unpin" returns to single-panel mode.
- **Priority:** P2
- **Dependencies:** CTXB-P6-T7
- **Parallelizable:** yes
- **Outputs / Artifacts:** pin state in `App.tsx`; secondary inspector panel layout in `SpecInspector.tsx` / `App.tsx`
- **Acceptance Criteria:**
  - A Pin button in the inspector header locks the current spec into a secondary panel.
  - The secondary panel persists while the user selects other nodes.
  - Both panels are scrollable independently.
  - Unpin removes the secondary panel without affecting the primary selection.

### CTXB-P9-T3 — Command palette (⌘K)
- **Description:** Add a command palette triggered by ⌘K (or Ctrl+K). The palette provides fuzzy search over all spec node IDs and titles, and exposes quick commands: switch view mode, toggle lens, open SpecPM panel, collapse all branches, fit view, toggle sidebar. Arrow keys navigate; Enter selects. The palette closes on Escape or outside click.
- **Priority:** P2
- **Dependencies:** CTXB-P6-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** `viewer/app/src/CommandPalette.tsx`; keyboard shortcut registration in `App.tsx`
- **Acceptance Criteria:**
  - ⌘K opens the palette from any state; Escape closes it.
  - Typing filters spec nodes by ID and title with fuzzy matching.
  - All listed commands execute correctly.
  - Selecting a spec node pans to it and opens the inspector.

### CTXB-P9-T4 — Filter bar: hide/show nodes by criteria
- **Description:** Add a filter chip bar below the view mode switcher. Chips include: `kind:<value>`, `status:<value>`, `has_gap`, `has_unmet_ac`, `impl:<state>`. Active chips hide non-matching nodes from the canvas (they are removed from the React Flow node set, not just faded). Filter chips combine with AND logic. A "Clear filters" button resets to the full graph. The active lens overlay continues to colour visible nodes.
- **Priority:** P2
- **Dependencies:** CTXB-P6-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** filter chip bar component; filter logic in `useSpecGraphData.ts` or `App.tsx`
- **Acceptance Criteria:**
  - Activating a chip removes non-matching nodes from the canvas.
  - Multiple chips combine (AND): only nodes matching all active chips are shown.
  - Filtered-out nodes do not appear in the graph; edges to them are suppressed.
  - Clearing filters restores the full graph without reload.
  - Lens overlays continue to function on the filtered set.

### CTXB-P9-T5 — Related-items drawer in SpecInspector
- **Description:** Add a "Related" section near the top of the SpecInspector panel listing: "Refined by (N)", "I refine (1)", "Depends on me (N)", "I depend on (N)", "Relates to (N)". Each entry is a clickable link that pans to the node and selects it. This replaces the need to close the inspector and search the graph manually.
- **Priority:** P2
- **Dependencies:** CTXB-P6-T7
- **Parallelizable:** yes
- **Outputs / Artifacts:** related-items section in `viewer/app/src/SpecInspector.tsx`
- **Acceptance Criteria:**
  - The Related section shows grouped, labelled links for all edge types.
  - Clicking a link pans to the target node and opens it in the inspector.
  - Counts are accurate and update when the graph reloads.
  - The section is collapsible and remembers its state in sessionStorage.

### ✅ CTXB-P9-T6 — Hover preview card on spec nodes
- **Status:** DONE (2026-05-13, PASS)
- **Description:** Show a lightweight tooltip when hovering a spec node for more than 300ms. The tooltip shows: title, objective (first 80 chars), status badge, and maturity bar. It disappears on mouse leave or click. The tooltip does not interfere with drag or edge interactions.
- **Priority:** P3
- **Dependencies:** CTXB-P6-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** hover tooltip component; `onMouseEnter`/`onMouseLeave` handlers in `SpecNode.tsx`
- **Acceptance Criteria:**
  - Hovering a node for 300ms shows the tooltip; moving off hides it immediately.
  - Tooltip is not shown during drag operations.
  - Tooltip positioning stays within viewport bounds (flips if near edges).
  - Clicking through the tooltip selects the node normally.

### ✅ CTXB-P9-T7 — SpecNode visual signal unification
- **Status:** DONE (2026-05-13, PASS)
- **Description:** Unify SpecNode status and maturity visual signals across GraphSpace canvas nodes, hover previews, Sidebar navigator rows, and Spec Inspector. The hover preview should read as a richer version of the node card, reserve space for asynchronously loaded objective text, and avoid layout jumps.
- **Priority:** P3
- **Dependencies:** CTXB-P9-T6, CTXB-P8-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** shared SpecNode status/maturity tone model; updated `SpecNodeCard`; hover preview, navigator, and inspector status tone wiring
- **Acceptance Criteria:**
  - Canvas nodes, hover previews, navigator rows, and Spec Inspector use the same status tone vocabulary for `linked`, `reviewed`, and `frozen`.
  - Maturity bars indicate weak, medium, and strong specs while keeping percentage labels right-aligned.
  - Hover preview uses the SpecNode card visual language and keeps stable height while objective text loads.

## Phase 10: GraphSpace SpecGraph Canvas Migration

Intent: make the new `graphspace/` rewrite graph-first by rendering SpecGraph nodes and edges on a primary canvas, while keeping the current live artifact panels as secondary surfaces. This phase ports the useful behaviour from legacy `viewer/app` in small FSD-aligned slices instead of copying the legacy app wholesale.

### CTXB-P10-T1 — Add GraphSpace SpecGraph graph contract
- **Description:** Extend `graphspace/src/shared/spec-graph-contract` with a validated contract for the `/api/spec-graph` payload used by the legacy viewer. Cover nodes, edges, roots, diagnostics, optional metadata, and broken-reference states. Keep the existing artifact contracts (`spec_activity_feed`, `implementation_work_index`, `proposal_spec_trace_index`) independent.
- **Priority:** P1
- **Dependencies:** current GraphSpace shared contract slice
- **Parallelizable:** no
- **Outputs / Artifacts:** `graphspace/src/shared/spec-graph-contract/schemas/spec-graph.ts`; `graphspace/src/shared/spec-graph-contract/parsers/parse-spec-graph.ts`; golden fixtures; parser tests
- **Acceptance Criteria:**
  - `parseSpecGraph()` accepts the legacy `/api/spec-graph` shape produced by `viewer/server.py`.
  - Empty graph, broken references, missing optional fields, and unknown extra fields are covered by tests.
  - Public imports go through `@/shared/spec-graph-contract`.
  - No UI rendering changes are included in this task.

### CTXB-P10-T2 — Add GraphSpace spec node and edge data model
- **Description:** Introduce FSD entity models for SpecGraph nodes and edges plus a canvas data hook that fetches `/api/spec-graph`, validates it through the shared contract, and exposes the current live-artifact state convention: `{ kind: "idle" }`, `{ kind: "loading" }`, or `EnvelopeResult<SpecGraph>`. Sample fallback remains a UI/model decision derived from non-`ok` states, matching the recent activity, work index, and proposal trace surfaces.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** `graphspace/src/entities/spec-node/*`; `graphspace/src/entities/spec-edge/*`; `graphspace/src/widgets/spec-graph-canvas/model/use-spec-graph.ts`; sample data
- **Acceptance Criteria:**
  - The hook returns `{ kind: "idle" }`, `{ kind: "loading" }`, or `EnvelopeResult<SpecGraph>`; it does not introduce generic `error` or `fallback` variants.
  - Sample fallback is derived by consumers when the validated state is not `ok`, preserving the existing GraphSpace live-artifact pattern.
  - Node and edge domain types are exported through entity public APIs.
  - Sample fallback data can render at least three nodes and two edge kinds without a backend.
  - Tests cover successful parse, offline fallback, and invalid payload handling.

### CTXB-P10-T3 — Render a minimal primary SpecGraph canvas in GraphSpace
- **Description:** Add `@xyflow/react` to `graphspace` and create `widgets/spec-graph-canvas` that renders SpecGraph nodes as a primary viewport surface. The first pass should prove the canvas pipeline end-to-end with deterministic placeholder positions and simple edge rendering; it should not yet port every legacy interaction.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** `graphspace/src/widgets/spec-graph-canvas/ui/SpecGraphCanvas.tsx`; canvas CSS module; basic `SpecNodeCard` UI; updated `ViewerPage` composition
- **Acceptance Criteria:**
  - The GraphSpace first screen includes a visible canvas with rendered node labels.
  - The canvas is the primary surface and is not pushed below the artifact panels.
  - Pan/zoom controls work through React Flow defaults.
  - Browser smoke verifies that at least one spec node label and the canvas root are visible at `http://127.0.0.1:5173/`.

### CTXB-P10-T4 — Add deterministic layout and edge semantics for GraphSpace canvas
- **Description:** Replace placeholder positions with **Refinement Ladder Layout**, a deterministic layout that ranks nodes by resolved `refines` depth: parent specs stay left, refining specs move right, and rows inside each rank remain stable by `node_id`. Render edge kinds with meaningful visual states. Start with this small local layout primitive; port Dagre or legacy `layoutGraph` only when needed for graph size and readability.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** Refinement Ladder layout helper; edge style mapping for `depends_on`, `refines`, `relates_to`, and broken references; layout tests
- **Acceptance Criteria:**
  - Node positions are stable across refreshes for unchanged data.
  - The default layout name and semantics are documented in `graphspace/README.md`.
  - `depends_on`, `refines`, `relates_to`, and broken references are visually distinguishable.
  - Edges to hidden or missing nodes do not crash rendering.
  - The layout remains usable for the current SpecGraph node count.

### CTXB-P10-T5 — Recompose GraphSpace viewer around canvas and secondary panels
- **Description:** Move the current live artifact surfaces into secondary overlay/side-panel roles around the primary SpecGraph canvas. `ViewerChrome` remains fixed; recent activity, implementation work, proposal trace, and artifact diagnostics remain available but no longer define the page's main grid.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated `ViewerPage` layout; panel overlay/sidebar composition; responsive CSS
- **Acceptance Criteria:**
  - Canvas remains visible as the primary surface on desktop and mobile.
  - The fixed status line does not participate in layout flow or push content.
  - Existing artifact panels remain reachable and keep their current live/sample behaviours.
  - No UI text overlaps at common desktop and mobile viewport sizes.

### CTXB-P10-T6 — Add first-pass GraphSpace node selection and inspector
- **Description:** Add selection state for spec nodes and a minimal inspector surface showing id, title, kind, status, maturity, direct dependencies, refinements, related links, and copyable source path. This is the first interaction pass after the canvas exists; deeper legacy inspector content remains follow-up work.
- **Priority:** P2
- **Dependencies:** CTXB-P10-T4, CTXB-P10-T5
- **Parallelizable:** yes
- **Outputs / Artifacts:** `graphspace/src/widgets/spec-inspector/*` or equivalent page-local inspector; selection wiring in `SpecGraphCanvas`; tests
- **Acceptance Criteria:**
  - Clicking a spec node selects it and opens the inspector.
  - Clicking empty canvas clears selection.
  - Related node references are shown as clickable IDs when present.
  - Source file path is visible and can be copied.
  - Inspector state does not break pan/zoom or artifact overlays.

### CTXB-P10-T7 — Expand GraphSpace spec inspector content
- **Description:** Bring the GraphSpace inspector closer to the legacy ContextBuilder inspector by loading and rendering richer spec content for the selected node: objective, acceptance criteria, scope in/out, terminology, decisions, evidence/input/execution details, and diagnostics. Extend the `/api/spec-graph` contract or add a focused detail endpoint only as needed; keep the compact T6 metadata view usable when detailed content is absent.
- **Priority:** P2
- **Dependencies:** CTXB-P10-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** enriched inspector read model; expanded `widgets/spec-inspector` sections; parser/schema tests; visual smoke coverage
- **Acceptance Criteria:**
  - Selecting a node can show objective, acceptance criteria, scope, terminology, and decisions when the backend provides them.
  - Missing detailed content degrades to the compact T6 inspector without empty heavy sections.
  - Long inspector content scrolls inside the inspector surface without moving the canvas.
  - Copy path and relation navigation continue to work.

### CTXB-P10-T8 — Add canvas-first panel dock for GraphSpace
- **Description:** Reduce GraphSpace visual noise by moving secondary live-artifact surfaces behind explicit canvas controls. The Sidebar should be a closable surface for graph context and utility entry points, while Recent changes, Implementation work, and Proposal trace should open as one active utility panel instead of three always-visible columns. The Spec Inspector remains the dedicated selected-spec surface.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T5, CTXB-P10-T7
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated `ViewerPage` state/composition; canvas panel launcher; Sidebar utility controls; desktop/mobile overlay CSS
- **Acceptance Criteria:**
  - Sidebar is hidden by default and can be opened from a canvas-level button.
  - Recent changes, Implementation work, and Proposal trace are reachable but render as one active utility panel at a time.
  - Closing all utility surfaces leaves the canvas as the clear primary viewport.
  - Selecting a spec keeps the inspector independent from secondary utility panels.
  - The minimap and canvas controls remain visible and usable at common desktop sizes.
  - Mobile keeps bounded overlays, with the inspector behaving as a bottom modal-style surface.

### CTXB-P10-T9 — Add Sidebar spec node navigator
- **Description:** Make the GraphSpace Sidebar useful as a graph navigation surface by adding a compact searchable list of SpecGraph nodes. The navigator should select canvas nodes and open the existing Spec Inspector, without duplicating inspector content inside the Sidebar.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T8
- **Parallelizable:** yes
- **Outputs / Artifacts:** `widgets/spec-node-navigator/*`; lifted SpecGraph state in `ViewerPage`; Sidebar composition updates; focused filter tests
- **Acceptance Criteria:**
  - Sidebar shows a searchable list of SpecGraph nodes with stable ordering.
  - Searching matches node id, title, and file name.
  - Selecting a list row selects the matching canvas node and opens the Spec Inspector.
  - The navigator exposes enough per-node signal for scanning: id, title, kind/status, and gap or diagnostic count.
  - Canvas and navigator use the same SpecGraph response state instead of issuing competing graph reads.
  - Empty and no-match states are explicit and compact.

### CTXB-P10-T10 — Add Sidebar navigator signal filters
- **Description:** Extend the Sidebar spec node navigator with compact signal filters so graph review can quickly narrow the node list to nodes with gaps or diagnostics while preserving the existing text search.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T9
- **Parallelizable:** yes
- **Outputs / Artifacts:** navigator filter model update; Sidebar filter controls; filter tests; validation report
- **Acceptance Criteria:**
  - Navigator offers compact filters for all nodes, nodes with gaps, and nodes with diagnostics.
  - Text search composes with the active signal filter.
  - Filter counts are visible without opening another panel.
  - Empty/no-match state remains compact and accurate under filters.
  - Existing row selection and Spec Inspector opening continue to work.

### CTXB-P10-T11 — Focus canvas on selected SpecGraph node
- **Description:** Keep the canvas spatially synchronized with Sidebar and Inspector selection by centering the React Flow viewport on the selected SpecGraph node.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T10
- **Parallelizable:** yes
- **Outputs / Artifacts:** canvas viewport focus behavior; focus point tests; validation report
- **Acceptance Criteria:**
  - Selecting a node outside the canvas pans/zooms the canvas toward that node.
  - Selecting a node on the canvas keeps the existing Inspector selection flow.
  - Clearing selection from the canvas pane or Inspector close still clears selected state.
  - Missing or stale selected node ids are ignored without runtime errors.
  - Focus point calculation has deterministic unit coverage.

### CTXB-P10-T12 — Keep selected navigator row visible
- **Description:** Keep Sidebar navigator selection visible when selection changes from canvas, Inspector links, or other non-list surfaces.
- **Priority:** P1
- **Dependencies:** CTXB-P10-T11
- **Parallelizable:** yes
- **Outputs / Artifacts:** navigator selected-row visibility behavior; validation report
- **Acceptance Criteria:**
  - When a visible filtered row becomes selected externally, the navigator scrolls it into view.
  - The custom overlay scrollbar metrics update after selection-driven scroll.
  - Current search and signal filters remain unchanged while selection is revealed.
  - If the selected node is hidden by the current filter/search, the navigator does not force filter state.
  - Existing row click selection behavior is unchanged.

### ✅ CTXB-P10-T13 — Resolve GraphSpace FSD insignificant-slice warnings — DONE (PASS, 2026-05-15)
- **Description:** `npm run lint:fsd --prefix graphspace` currently passes but reports the known `fsd/insignificant-slice` warnings for single-reference GraphSpace feature/widget slices. Review each warning after the canvas, Sidebar, utility panels, and Inspector stabilize; either keep the slice with an explicit architectural rationale, merge it back into `pages/viewer` when it is page-local, or introduce a legitimate second consumer. Do not silence Steiger globally just to hide useful architecture feedback.
- **Priority:** P3
- **Dependencies:** CTXB-P10-T12
- **Parallelizable:** yes
- **Source:** repeated GraphSpace validation note: `npm run lint:fsd` passes with known `fsd/insignificant-slice` warnings.
- **Outputs / Artifacts:** updated GraphSpace FSD slice layout and/or documented Steiger rationale; validation report
- **Acceptance Criteria:**
  - All current `fsd/insignificant-slice` warnings are reviewed with a decision per slice.
  - Page-local slices are merged into `pages/viewer` when no independent business boundary remains.
  - Retained slices have a concrete reuse/composition rationale instead of being kept only for technical neatness.
  - `npm run lint:fsd --prefix graphspace` still passes, with zero `insignificant-slice` warnings or only explicitly documented intentional exceptions.
  - Import direction and public API rules remain intact.

## Phase 11: SpecSpace Deployment Boundary

Intent: make SpecSpace deployable as a standalone viewer/API surface that can read the current SpecGraph workspace without owning it. The deployment boundary should keep SpecGraph readonly, expose stable versioned SpecSpace contracts, and let the UI depend on SpecSpace API v1 rather than raw upstream file layouts or producer internals.

### ✅ CTXB-P11-T1 — Versioned readonly SpecGraph provider for SpecSpace API — DONE (PASS, 2026-05-15)
- **Description:** Introduce a deploy-oriented SpecSpace API boundary: SpecSpace API reads readonly SpecGraph files and artifacts, exposes versioned `/api/v1/*` endpoints, and the UI consumes only those versioned contracts. SpecGraph remains the producer/owner of `specs/nodes` and `runs/`; SpecSpace is a readonly consumer. Start with file-backed providers over readonly mounted paths, with an interface that can later support an HTTP-backed SpecGraph provider.
- **Priority:** P1
- **Dependencies:** CTXB-P7-T13
- **Parallelizable:** yes
- **Source:** deployment planning note: prefer `SpecSpace API reads readonly SpecGraph files -> exposes versioned /api/v1 -> UI consumes only /api/v1`
- **Outputs / Artifacts:** SpecGraph provider interface; file-backed readonly provider; `/api/v1/spec-graph`, `/api/v1/spec-nodes/{id}`, `/api/v1/runs/recent`, `/api/v1/specpm/lifecycle`, `/api/v1/capabilities`, `/api/v1/health`; contract docs; validation report
- **Acceptance Criteria:**
  - UI data reads can be routed through `/api/v1/*` without depending on raw legacy endpoint names.
  - The file-backed provider takes explicit `specs/nodes` and `runs` paths and never writes to either tree.
  - Provider construction and health reporting distinguish missing, unreadable, and empty SpecGraph sources.
  - API v1 responses are documented as contracts and have regression tests with representative SpecGraph fixtures.
  - Existing legacy endpoints remain available during migration.

### ✅ CTXB-P11-T2 — Dockerized SpecSpace deployment smoke — DONE (PASS, 2026-05-15)
- **Description:** Add a minimal Docker/Compose deployment for SpecSpace using readonly mounted SpecGraph `specs/nodes` and `runs` directories. The smoke environment should validate the real deployment shape without requiring SpecSpace to own or mutate SpecGraph. SpecPM remains optional and is represented by readonly `runs` artifacts when available.
- **Priority:** P1
- **Dependencies:** CTXB-P11-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** Dockerfile(s), compose file, `.dockerignore`, smoke script, operator notes
- **Acceptance Criteria:**
  - Compose starts SpecSpace API and UI with documented ports.
  - SpecGraph mounts are readonly in the container definition.
  - Smoke checks cover `/api/v1/health`, `/api/v1/spec-graph`, and UI availability.
  - Missing optional SpecPM artifacts degrade through capabilities/status rather than failing the deployment.
  - The setup documents how to pin or mount current SpecGraph and SpecSpace versions for integration diagnosis.

### ✅ CTXB-P11-T3 — Docker Compose CI smoke — DONE (PASS, 2026-05-15)
- **Description:** Add a CI job that builds the SpecSpace Docker/Compose deployment and runs a bounded smoke check against fixture-backed readonly SpecGraph mounts. The job should validate that the deployment artifacts stay buildable in a clean GitHub Actions runner, without requiring a real external SpecGraph checkout or mutating producer state.
- **Priority:** P1
- **Dependencies:** CTXB-P11-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** CI workflow job, smoke fixture setup, validation report
- **Acceptance Criteria:**
  - CI builds `specspace-api:local` and `specspace-ui:local` through `compose.specspace.yml`.
  - CI starts API and UI containers on non-conflicting ports and runs `scripts/smoke-specspace-deploy.sh`.
  - Smoke inputs are generated from repository fixtures or temporary readonly directories; no private operator paths are required.
  - The smoke job validates `/api/v1/health`, `/api/v1/spec-graph`, `/api/v1/runs/recent`, UI HTML, and UI-proxied API.
  - Docker CI failures are isolated from ordinary unit-test output enough for operators to identify deployment-boundary regressions quickly.

## Phase 12: SpecSpace Product Boundary

Intent: keep SpecSpace focused as a standalone readonly SpecGraph/SpecPM viewer and API, while legacy ContextBuilder conversation authoring remains in the legacy `viewer/app` surface. This phase prevents Phase 3 authoring tasks from leaking into SpecSpace and gives the new product its own follow-up queue.

### ✅ CTXB-P12-T1 — Define SpecSpace product boundary and next queue — DONE (PASS, 2026-05-16)
- **Description:** Record the SpecSpace product boundary in the workplan and select follow-up tasks that keep SpecSpace separate from legacy conversation authoring. This is a planning/checkpoint task after completing the deployment boundary and legacy message authoring work.
- **Priority:** P1
- **Dependencies:** CTXB-P11-T3, CTXB-P3-T6
- **Parallelizable:** yes
- **Outputs / Artifacts:** Phase 12 workplan section, updated `SPECS/INPROGRESS/next.md`, validation report
- **Acceptance Criteria:**
  - `CTXB-P3-T6` is archived as legacy ContextBuilder authoring work.
  - Phase 12 explicitly states that SpecSpace is a readonly SpecGraph/SpecPM viewer/API.
  - The next queue separates SpecSpace product-boundary work from Phase 3 conversation authoring.
  - Follow-up tasks exist for documentation and automated guardrails.

### ✅ CTXB-P12-T2 — Document SpecSpace product and deployment boundary — DONE (PASS, 2026-05-16)
- **Description:** Add operator/product documentation that explains what SpecSpace owns, what remains legacy ContextBuilder, and which API routes belong to the SpecSpace deployment contract.
- **Priority:** P1
- **Dependencies:** CTXB-P12-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** SpecSpace boundary documentation, deployment doc update, GraphSpace README clarification, validation report
- **Acceptance Criteria:**
  - Documentation states that conversation mode, checkpoint editing, branch/merge authoring, and compile flows are outside SpecSpace core.
  - Documentation states that `graphspace/` consumes `/api/v1/*` as the SpecSpace runtime contract.
  - Legacy `viewer/app` is described as a ContextBuilder surface, not the SpecSpace product UI.
  - Docker/deployment docs point operators to the same boundary.

### ✅ CTXB-P12-T3 — Add GraphSpace API boundary guardrail — DONE (PASS, 2026-05-16)
- **Description:** Add an automated check that prevents runtime `graphspace/` code from depending on legacy ContextBuilder conversation/write endpoints. The guard should allow explicit compatibility tests/fixtures while keeping product code on `/api/v1/*`.
- **Priority:** P1
- **Dependencies:** CTXB-P12-T2
- **Parallelizable:** yes
- **Outputs / Artifacts:** boundary check script, CI integration, GraphSpace endpoint cleanup if required, validation report
- **Acceptance Criteria:**
  - Runtime `graphspace/` source fails validation when it references forbidden legacy endpoints such as `/api/file`, `/api/conversation`, `/api/checkpoint`, `/api/compile`, or non-versioned SpecGraph routes.
  - Existing compatibility fixtures/tests remain possible when they are explicitly isolated from runtime source.
  - CI runs the guardrail alongside GraphSpace validation.
  - GraphSpace runtime data reads remain on `/api/v1/*`.

### ✅ CTXB-P12-T4 — Separate legacy ContextBuilder docs from SpecSpace docs — DONE (PASS, 2026-05-16)
- **Description:** Review top-level operator/developer docs and label or split legacy ContextBuilder conversation guidance from SpecSpace runtime guidance. The goal is to reduce local-run confusion now that `viewer/app` and `graphspace/` serve different products.
- **Priority:** P2
- **Dependencies:** CTXB-P12-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** updated quickstart/architecture docs or a short doc index that points operators to the correct app
- **Acceptance Criteria:**
  - Top-level docs distinguish legacy ContextBuilder conversation mode from SpecSpace graph inspection.
  - Local run commands identify whether they launch `viewer/app` or `graphspace/`.
  - SpecSpace docs point to `/api/v1/*` and Docker smoke guidance.
  - Legacy conversation authoring docs do not present themselves as SpecSpace instructions.

### ✅ CTXB-P12-T5 — Add Timeweb Docker Compose entrypoint and sync guard — DONE (PASS, 2026-05-16)
- **Description:** Add a root `docker-compose.yml` for Timeweb Compose discovery and guard it against drift from `compose.specspace.yml`.
- **Priority:** P1
- **Dependencies:** CTXB-P12-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** root `docker-compose.yml`, sync/check scripts, optional pre-push hook, CI job, validation report
- **Acceptance Criteria:**
  - Timeweb can discover `docker-compose.yml` at repository root.
  - `docker-compose.yml` and `compose.specspace.yml` are kept byte-for-byte identical.
  - A local pre-push hook can run the sync guard when `core.hooksPath` is configured.
  - CI runs a `Timeweb Docker Support` job that checks sync and validates compose config.

### CTXB-P12-T6 — Plan registry-backed Timeweb deploy branch and HTTP artifacts
- **Description:** Design the long-term Timeweb deployment branch where the branch can contain only deployment manifests because API/UI images are prebuilt and pinned. Include the companion plan for reading SpecGraph artifacts from HTTP/static hosting such as `https://specgraph.tech/specs` and `/runs`.
- **Priority:** P2
- **Dependencies:** CTXB-P12-T5
- **Parallelizable:** yes
- **Outputs / Artifacts:** deployment-branch plan, registry image naming/versioning plan, HTTP artifact provider task split
- **Acceptance Criteria:**
  - The plan explains how CI builds and publishes SpecSpace API/UI images.
  - The plan explains how a `timeweb-deploy` branch is generated or maintained.
  - The plan defines the minimal static SpecGraph artifact index contract.
  - Follow-up implementation tasks are small enough to PR independently.

## Dependency Summary

- Phase 1 establishes the schema, integrity rules, graph index, and API contract required by all later work.
- Phase 2 depends on the graph-ready API and turns lineage into a usable visual model.
- Phase 2R replaces the custom SVG renderer with React Flow. It depends on the graph API (P1) and replaces all P2 rendering code. T16 is absorbed into P2R-T6.
- Phase 3 depends on both the graph foundation and the React Flow viewer (P2R) because authoring and compile selection operate on selected checkpoints.
- Phase 4 depends on the compile target model and turns the selected branch into Hyperprompt-compatible filesystem artifacts.
- Phase 5 validates and documents the complete graph-to-context workflow.
- Phase 6 reuses the React Flow viewer (P2R) and Python server (P1) to render SpecGraph YAML specs as a second graph mode. Independent of Phases 3-5 conversation authoring and compile features.
- Phase 7 addresses technical debt identified in docs/PROBLEMS.md. Tasks are largely independent of each other and of Phases 3-6, with the exception that T2/T3 (server split + types) depend on T1 (cache layer).
- Phase 8 extends the SpecPM integration started in Phase 6. T0 (lifecycle panel) is complete. T1 (5th stage) is blocked on an upstream SpecGraph branch merge. T2 (node badge) depends on T0.
- Phase 9 improves graph UX for daily authoring and review workflows. All tasks are independent of each other. T1 (change highlighting) is the highest-priority item. Tasks have no blocking external dependencies.
- Phase 10 migrates the graph-first SpecGraph experience into the new `graphspace/` rewrite. It depends on the GraphSpace FSD shell and current artifact panels, and should proceed in contract -> hook/model -> minimal canvas -> layout/composition -> inspector order.
- Phase 11 makes SpecSpace deployable around a readonly SpecGraph boundary. It should establish versioned API contracts before Dockerizing the deployment shape.
- Phase 12 protects the SpecSpace product boundary after deployment: readonly `/api/v1/*` SpecGraph/SpecPM viewing stays in `graphspace/`, while conversation authoring remains legacy ContextBuilder work.

## Task Status Legend

- **Not Started** — Task defined but not yet begun
- **INPROGRESS** — Task currently being worked on
- **✅ Complete** — Task finished and archived
