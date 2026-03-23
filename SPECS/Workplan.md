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

### CTXB-P1-T6 — Correct compile-target root metadata for incomplete lineage
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

### ✅ CTXB-P2R-T11 — Route cross-conversation edges to message-level nodes in expanded subflows
- **Description:** When a conversation is expanded into message sub-nodes, route cross-conversation edges (branch/merge) to the specific message node identified by `parent_message_id` from the API edge data. Currently edges always connect at the conversation/group level even when expanded. React Flow supports edges between child nodes in sub-flows via `parentId`. When both source and target conversations are expanded, edges should connect the exact message nodes. When only one side is expanded, the edge should connect the message node on the expanded side to the conversation node on the collapsed side.
- **Priority:** P1
- **Dependencies:** CTXB-P2R-T3, CTXB-P2R-T4
- **Parallelizable:** yes
- **Acceptance Criteria:**
  - When a parent conversation is expanded, branch/merge edges originate from the specific message node matching `parent_message_id`.
  - When collapsed, edges revert to conversation-level anchors.
  - The visual clearly shows which message is the branch/merge point.

## Phase 3: Authoring and Compile Target Selection

Intent: implement the workflows that mutate graph structure safely and let the user mark a concrete line of reasoning as the target for context compilation.

### CTXB-P3-T1 — Implement branch creation from any checkpoint
- **Description:** Add the UI and API workflow that creates a new conversation file from a selected checkpoint while preserving the exact parent conversation and parent message identifiers.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** branch creation controls in `viewer/index.html`, safe write path in `viewer/server.py`, branch creation tests
- **Acceptance Criteria:**
  - A user can create a new conversation from any checkpoint message.
  - The created file includes valid lineage metadata and appears as a child node after reload.
  - Branch creation satisfies PRD FR-4 and Flow B.

### CTXB-P3-T2 — Implement merge conversation creation with multi-parent lineage
- **Description:** Add the workflow that creates a new conversation file referencing two or more parent checkpoints without attempting to synthesize or auto-merge message bodies.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** merge selection UI, multi-parent save logic, merge workflow tests
- **Acceptance Criteria:**
  - A user can create a merge conversation from multiple checkpoints.
  - The created file records every parent reference deterministically.
  - The resulting node renders with multiple inbound edges and no implicit transcript synthesis.

### CTXB-P3-T3 — Define the compile target model and export workspace layout
- **Description:** Specify what a selected branch means for compilation, how merge parents are represented, and where generated export artifacts are written on disk.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5, CTXB-P2-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** compile-target contract, export directory contract, API and UI data model updates
- **Acceptance Criteria:**
  - The product can represent a chosen branch or lineage path as a deterministic compile target.
  - Export artifacts have a stable local directory structure.
  - Merge provenance is preserved explicitly in the selection model.

### CTXB-P3-T4 — Let the user select the active branch as a compile target
- **Description:** Add UI actions and state handling so the user can mark the active conversation or checkpoint lineage as the branch to compile into external context.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T3
- **Parallelizable:** no
- **Outputs / Artifacts:** compile target selection UI, selection persistence, API request payloads
- **Acceptance Criteria:**
  - The user can choose a concrete thought direction for compilation from the graph UI.
  - The selected target is unambiguous and serializable.
  - The workflow satisfies PRD FR-11 and Flow D / Flow E preconditions.

### CTXB-P3-T5 — Re-index and reconcile external file changes
- **Description:** Allow the user to refresh or re-index the workspace so that file additions, edits, or deletions performed by external agents or tools become visible without restarting the application.
- **Priority:** P1
- **Dependencies:** CTXB-P1-T4, CTXB-P2-T1
- **Parallelizable:** yes
- **Outputs / Artifacts:** refresh/re-index controls in `viewer/index.html`, server-side re-read logic, external-change tests
- **Acceptance Criteria:**
  - Newly added files appear after a refresh or re-index.
  - Deleted or modified files update the graph and current selection safely.
  - The implementation satisfies PRD FR-10 and NFR-8.

## Phase 4: Hyperprompt Export and Compilation Pipeline

Intent: turn the selected branch into actual filesystem artifacts that Hyperprompt can compile, then produce the final continuation-ready Markdown context.

### CTXB-P4-T1 — Export selected graph nodes into deterministic Markdown files
- **Description:** Materialize the selected branch as a set of Markdown node files, each carrying source provenance and original content in a stable representation.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T3, CTXB-P3-T4
- **Parallelizable:** no
- **Outputs / Artifacts:** generated `.md` export nodes, export metadata, deterministic file naming rules
- **Acceptance Criteria:**
  - Repeated export of unchanged inputs yields identical Markdown node files.
  - Each export node preserves source `conversation_id`, `message_id`, role, and content.
  - The output satisfies PRD FR-12 and §6.4.

### CTXB-P4-T2 — Generate a valid Hyperprompt root file for the selected branch
- **Description:** Build a root `.hc` file that references the exported Markdown nodes in deterministic order and nesting, matching Hyperprompt syntax requirements.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T1
- **Parallelizable:** no
- **Outputs / Artifacts:** generated `.hc` file, root-file generation logic, syntax validation path
- **Acceptance Criteria:**
  - The `.hc` file references only generated `.md` or `.hc` files inside the export root.
  - The file is valid Hyperprompt syntax with no path traversal or circular structure.
  - The generated structure satisfies PRD FR-13 and §6.5.

### CTXB-P4-T3 — Integrate Hyperprompt compiler invocation
- **Description:** Invoke a configured local Hyperprompt compiler executable to compile the generated `.hc` file into a final Markdown context artifact and optional manifest.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T2
- **Parallelizable:** no
- **Outputs / Artifacts:** subprocess integration, compiled `.md` output, optional manifest, compile diagnostics
- **Acceptance Criteria:**
  - Successful compile produces a final Markdown artifact from the generated `.hc`.
  - Missing compiler binaries or non-zero exits surface actionable errors.
  - The integration satisfies PRD FR-14, FR-15, and NFR-11.

### CTXB-P4-T4 — Expose compile results and artifact locations
- **Description:** Show compile status, output paths, and failure details in the UI and API so the user can immediately use the generated context artifact with an external agent.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T3
- **Parallelizable:** yes
- **Outputs / Artifacts:** result panel or artifact summary UI, compile status payloads
- **Acceptance Criteria:**
  - The user can find the generated `.hc` and final compiled `.md` without manual filesystem inspection.
  - Failed compiles show actionable diagnostics instead of silent failure.
  - The task satisfies PRD FR-15 and Flow D.

### CTXB-P4-T5 — Preserve provenance from compiled artifact back to graph selection
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

### CTXB-P5-T1 — Add automated tests for schema validation and graph integrity failures
- **Description:** Extend the test suite to cover invalid imports, duplicate IDs, missing parents, malformed lineage, and graph diagnostics.
- **Priority:** P0
- **Dependencies:** CTXB-P1-T5
- **Parallelizable:** yes
- **Outputs / Artifacts:** expanded test fixtures and server tests
- **Acceptance Criteria:**
  - Duplicate IDs, missing parents, and malformed lineage are covered by automated tests.
  - The suite fails when graph integrity behavior regresses.

### CTXB-P5-T2 — Add automated tests for branch, merge, and compile target selection workflows
- **Description:** Cover the authoring and selection flows that create or choose the reasoning branch to export.
- **Priority:** P0
- **Dependencies:** CTXB-P3-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** authoring and selection test coverage
- **Acceptance Criteria:**
  - Branch and merge workflows are protected by automated tests.
  - Compile target selection is deterministic and regression-tested.

### CTXB-P5-T3 — Add automated tests for Markdown export, `.hc` generation, and Hyperprompt compile integration
- **Description:** Cover export node generation, root `.hc` creation, compiler invocation, missing compiler failures, and successful compiled artifact output.
- **Priority:** P0
- **Dependencies:** CTXB-P4-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** export and compile integration tests, Hyperprompt-backed fixtures or mocks
- **Acceptance Criteria:**
  - The pipeline catches broken references, invalid compiler setup, and incorrect artifact generation.
  - Successful compile flows are covered end-to-end.

### CTXB-P5-T4 — Update product and contributor documentation for the graph-to-context workflow
- **Description:** Rewrite repository documentation so it matches the graph product scope, the canonical file contract, the Hyperprompt dependency, and the compile workflow.
- **Priority:** P1
- **Dependencies:** CTXB-P4-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** `README.md` and supporting docs
- **Acceptance Criteria:**
  - The docs explain what ContextBuilder owns and what external agents own.
  - The docs describe root, branch, merge, export node, `.hc`, and compiled artifact concepts.
  - A contributor can understand the local graph-to-context pipeline.

### CTXB-P5-T5 — Add end-to-end verification guidance for handing compiled context to an external agent
- **Description:** Document the local operator flow from JSON conversations to final compiled Markdown so the compiled artifact can be used immediately in downstream agent workflows.
- **Priority:** P1
- **Dependencies:** CTXB-P5-T3, CTXB-P5-T4
- **Parallelizable:** yes
- **Outputs / Artifacts:** workflow notes, validation checklist, operator guidance
- **Acceptance Criteria:**
  - A user can follow the documented local workflow from JSON conversations to final compiled context output.
  - The final handoff path to an external agent is explicit and reproducible.

## Dependency Summary

- Phase 1 establishes the schema, integrity rules, graph index, and API contract required by all later work.
- Phase 2 depends on the graph-ready API and turns lineage into a usable visual model.
- Phase 2R replaces the custom SVG renderer with React Flow. It depends on the graph API (P1) and replaces all P2 rendering code. T16 is absorbed into P2R-T6.
- Phase 3 depends on both the graph foundation and the React Flow viewer (P2R) because authoring and compile selection operate on selected checkpoints.
- Phase 4 depends on the compile target model and turns the selected branch into Hyperprompt-compatible filesystem artifacts.
- Phase 5 validates and documents the complete graph-to-context workflow.

## Task Status Legend

- **Not Started** — Task defined but not yet begun
- **INPROGRESS** — Task currently being worked on
- **✅ Complete** — Task finished and archived
