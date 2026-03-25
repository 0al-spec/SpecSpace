# CTXB-P3-T4 — Let the User Select the Active Branch as a Compile Target

**Phase:** P3 — Compile Target Selection and Branch Authoring
**Priority:** P0
**Dependencies:** CTXB-P3-T3 (compile target data model, API, export dir)
**Parallelizable:** no

---

## Goal

Allow the user to explicitly mark a conversation or checkpoint as the **compile target** — the branch/lineage they want to export and compile into an external LLM context. This separates the act of *viewing/inspecting* a node from *selecting it for compilation*, and satisfies PRD FR-11 and the preconditions for Flow D and Flow E.

---

## Context

CTXB-P3-T3 established:
- `CompileTarget` TypeScript interface with full lineage metadata
- `build_compile_target()` in `viewer/server.py` computing lineage, export dir, merge parents
- Both `/api/conversation` and `/api/checkpoint` already return a `compile_target` object
- InspectorOverlay already displays `is_lineage_complete` and `export_dir` read-only

What is missing: a way for the user to *choose* which node is the active compile target (persisted state) versus simply *viewing* a node's compile target metadata.

---

## Deliverables

1. **`compileTargetConversationId` / `compileTargetMessageId` session state** — new `useSessionString` entries in the frontend, separate from `selectedConversationId`/`selectedMessageId`, persisted in sessionStorage under `ctxb_compile_target_conversation_id` and `ctxb_compile_target_message_id`.

2. **"Set as Compile Target" button** in `InspectorOverlay` — appears in the conversation section and in the checkpoint (message) section. Clicking it sets the compile target state. If the node is already the compile target, the button reads "Compile Target Set ✓" and is visually distinct.

3. **Compile target visual indicator on graph nodes** — conversation nodes and message nodes that are the active compile target show a visual highlight (e.g., a distinct border color or a small `◎` badge) so the user can see the compile target from the canvas without opening the inspector.

4. **Compile target summary strip** in InspectorOverlay — when a node is selected *and* it is the active compile target, show the full compile target metadata (lineage complete badge, export dir, lineage conversation count) as a collapsible section. When the selected node is *not* the active compile target, show a smaller "Current target: {id}" hint so the user can navigate to it.

---

## Acceptance Criteria

- [ ] The user can click "Set as Compile Target" on any conversation node in the inspector.
- [ ] The user can click "Set as Compile Target" on any checkpoint (message node) in the inspector.
- [ ] The selected compile target persists across page refresh (sessionStorage).
- [ ] The graph canvas shows a distinct visual marker on the node that is the active compile target.
- [ ] The compile target is unambiguous: only one conversation+message pair can be the active compile target at any time.
- [ ] The compile target state is serializable: `{ conversation_id, message_id | null }` — exactly the shape required by CTXB-P4-T1.
- [ ] Existing graph interaction (click to view, expand/collapse) is unaffected.
- [ ] All existing tests pass.
- [ ] PRD FR-11 is satisfied: "The user must be able to choose a compile target from the graph, at minimum the active branch or lineage path anchored at the current selection."

---

## Out of Scope

- Triggering the actual compilation (Flow D steps 2–8) — that is CTXB-P4-T1 through CTXB-P4-T4.
- Modifying the backend `build_compile_target()` logic.
- Persisting the compile target to disk (session state is sufficient for v1).
- Multi-target compilation.

---

## Implementation Plan

### Step 1 — Add compile target session state to App.tsx
- Add `useSessionString("ctxb_compile_target_conversation_id", null)` as `compileTargetConversationId`
- Add `useSessionString("ctxb_compile_target_message_id", null)` as `compileTargetMessageId`
- Pass `compileTargetConversationId`, `compileTargetMessageId`, and a `setCompileTarget(convId, msgId)` callback down to `InspectorOverlay`.

### Step 2 — Pass compile target state to graph node rendering
- Pass `compileTargetConversationId` and `compileTargetMessageId` into `getNodes()` / node data so node components can render a visual indicator.
- In `ConversationNode` / `GroupNode` / `MessageNode`: if the node's ID matches the compile target, add a CSS class `compile-target-node` that renders a highlighted ring.

### Step 3 — Add "Set as Compile Target" button to InspectorOverlay
- Conversation-level section: add button below the lineage badge.
- Checkpoint section: add button in the checkpoint detail area alongside "Create Branch" / "Create Merge".
- Button label: "Set as Compile Target" (default) / "Compile Target ✓" (when already set).
- On click: call `setCompileTarget(selectedConversationId, null)` or `setCompileTarget(selectedConversationId, selectedMessageId)`.

### Step 4 — Add compile target summary in InspectorOverlay
- When the inspected node IS the compile target: show the `compile_target` metadata section (already fetched from the API).
- When the inspected node IS NOT the compile target: show a small hint "Active compile target: {compileTargetConversationId?.slice(0,8)}…" with a link/click to navigate.

### Step 5 — CSS for compile target visual indicator
- Add `.compile-target-node` styles in `viewer/static/css/` or inline component styles.
- Use a distinct border color (e.g., amber/orange to differentiate from the selection highlight).

---

## Files Expected to Change

- `viewer/app/src/App.tsx` — add compile target state, pass to children
- `viewer/app/src/InspectorOverlay.tsx` — add "Set as Compile Target" button and summary
- `viewer/app/src/components/ConversationNode.tsx` (or equivalent) — add compile target visual indicator
- `viewer/app/src/components/MessageNode.tsx` (or equivalent) — add compile target visual indicator
- `viewer/static/` or component CSS — compile target highlight styles
- `viewer/app/src/useSessionState.ts` — no changes needed (hook already supports this pattern)

---

## Test Approach

- Manual browser verification: set compile target at conversation level, refresh, confirm it persists.
- Manual browser verification: set compile target at checkpoint level, confirm graph shows indicator on message node.
- Existing test suite (`make test`) must pass unchanged.
