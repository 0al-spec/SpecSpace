# CTXB-P2-T3 — Implement Ancestor And Sibling Lineage Navigation

## Objective Summary

Add explicit navigation actions that let the user jump from a derived conversation to its parent checkpoint and from that checkpoint to related sibling branches. The goal is to make upstream traversal and lateral exploration first-class operations in the graph UI, eliminating the need for manual file lookup when exploring lineage.

This task builds on the inspection panels delivered in CTXB-P2-T2 and the graph canvas from CTXB-P2-T1. It does not implement merge authoring, compile target selection, or refresh-state persistence.

## Scope And Deliverables

### Deliverables

1. **"Go to parent checkpoint" action** in the conversation inspector: when a conversation has a resolved parent edge, a single action navigates to the parent conversation and auto-selects the parent checkpoint (the specific message from which this conversation branched).
2. **Sibling navigation in the checkpoint inspector**: when viewing a checkpoint that has child edges, all sibling branches from the same checkpoint are listed together, with the current conversation highlighted and others navigable in one click.
3. **Server-side sibling data**: extend `GET /api/checkpoint` to include `sibling_edges` — the child edges of the same parent checkpoint for a given conversation, enabling the client to render sibling context without extra round-trips.
4. **Canvas auto-center on navigation**: when a navigation action changes the selected conversation, the canvas centers on the newly selected node.
5. **Regression tests** for the new API field and navigation behaviors.

### Out Of Scope

1. Merge conversation authoring (CTXB-P3-T2).
2. Compile target selection (CTXB-P3-T4).
3. Refresh-state persistence (CTXB-P2-T4).
4. Integrity issue surfacing beyond what already exists (CTXB-P2-T5).

## Success Criteria

1. A user can navigate from a branch conversation to its ancestor checkpoint in one action.
2. A user can continue from the ancestor context to sibling branches without manual file lookup.
3. The canvas centers on the target node after each navigation jump.
4. The implementation satisfies PRD FR-6 and Flow D preconditions.

## Acceptance Tests

### UI Behavior Acceptance

1. The conversation inspector shows a "Go to parent checkpoint" button for each resolved parent edge. Clicking it selects the parent conversation and its specific checkpoint.
2. The checkpoint inspector shows a sibling section listing all conversations branching from this checkpoint. The current conversation (if it is a child of this checkpoint) is marked as "current" and not navigable; others have navigation buttons.
3. Navigation actions trigger canvas centering on the target node.
4. Navigation from a root conversation (no parent edges) does not show parent navigation controls.

### API Contract Acceptance

1. `GET /api/checkpoint` response includes a `sibling_edges` array containing the child edges of the same parent checkpoint for the requesting conversation's context.
2. Existing `parent_edges` and `child_edges` fields remain unchanged.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.
3. `pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90` passes.

## Test-First Plan

### Step 1: API sibling edges

- Add a test in `tests/test_api_contracts.py` that verifies `collect_checkpoint_api` returns `sibling_edges` for a checkpoint that has multiple child branches.
- Implement the server-side logic in `viewer/server.py`: when returning checkpoint data, look up the parent edge of the requesting conversation that points to this checkpoint, then find all child edges of that parent checkpoint to populate `sibling_edges`.

### Step 2: UI — parent checkpoint navigation

- In `renderConversationInspector()`, add a "Go to parent checkpoint" button next to each resolved parent edge. The action calls `selectConversation(parentConversationId)` followed by `selectCheckpoint(parentMessageId)`, then `centerOnSelection()`.

### Step 3: UI — sibling listing in checkpoint inspector

- In `renderCheckpointInspector()`, add a "Sibling branches" section that uses the `sibling_edges` data from the checkpoint API. Show each sibling with a navigation button. Mark the current conversation as "current".

### Step 4: Auto-center on navigation

- Ensure `selectConversation()` calls `centerOnSelection()` after the graph re-renders, so every navigation jump auto-centers the viewport.

### Step 5: Validation and cleanup

- Run `make test`, `make lint`, coverage gate.
- Create validation report.
