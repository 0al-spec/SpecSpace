# CTXB-P3-T1 — Implement Branch Creation from Any Checkpoint

**Priority:** P0
**Dependencies:** CTXB-P1-T5 (done), CTXB-P2-T2 (done)
**Branch:** `feature/CTXB-P3-T1-branch-creation`

## Overview

Add a "Create Branch" action to the checkpoint inspector that lets a user create a new conversation file from any selected checkpoint message. The new file must include valid lineage metadata referencing the parent conversation and parent message, and appear as a child node in the graph after creation.

This implements PRD FR-4 and Flow B (§7.2).

## Deliverables

1. **UI: "Create Branch" button in checkpoint inspector** — visible when a checkpoint is selected, opens a dialog to collect file name and title.
2. **UI: Branch creation dialog** — collects `fileName` and `title`, validates inputs, calls POST `/api/file`.
3. **Graph refresh after creation** — the graph re-fetches after successful creation so the new node and edge appear immediately.
4. **Tests: branch creation via API** — test that POST `/api/file` with a valid branch payload creates the file, and the new conversation appears in the graph with correct parent edge.

## Acceptance Criteria

- [ ] A "Create Branch" button appears in the checkpoint inspector when a checkpoint (message) is selected.
- [ ] Clicking the button opens a dialog asking for file name and title.
- [ ] On submit, a new conversation file is written via POST `/api/file` with:
  - A user-supplied `conversation_id` (derived from file name)
  - The user-supplied `title`
  - An empty `messages` array
  - `lineage.parents` containing exactly one entry with the parent `conversation_id`, `message_id`, and `link_type: "branch"`
- [ ] After creation, the graph refreshes and shows the new node as a child of the parent checkpoint.
- [ ] Validation errors from the server are displayed to the user (duplicate file, invalid name, etc.).
- [ ] NFR-4: branch creation completes in under 300ms after save request.

## Non-Goals

- Populating messages in the new branch (empty conversation is correct for v1).
- Merge conversation creation (separate task CTXB-P3-T2).
- Re-indexing or file-watching (separate task CTXB-P3-T5).

## Task Plan

### T1: Add "Create Branch" button to checkpoint inspector
- In `InspectorOverlay.tsx`, add a "Create Branch" button below the checkpoint content section.
- Button visible only when `checkpointDetail` is populated.
- Clicking sets a local state flag `showBranchDialog = true`.

### T2: Implement branch creation dialog component
- Create `BranchDialog.tsx` — a modal/dialog component.
- Fields: file name (text input, `.json` suffix enforced), title (text input).
- "Create" and "Cancel" buttons.
- On submit: construct the conversation payload and POST to `/api/file`.
- Show errors from server response.
- On success: call `onCreated()` callback to refresh graph and dismiss dialog.

### T3: Wire dialog into InspectorOverlay and App
- Pass `refresh` callback from `useGraphData` through to `InspectorOverlay`.
- After successful branch creation, call `refresh()` to re-fetch graph.
- Auto-select the new conversation in the inspector.

### T4: Add API contract test for branch creation flow
- In `test_api_contracts.py`, add a test that:
  1. Sets up a workspace with root conversation.
  2. POSTs a new branch conversation referencing a root checkpoint.
  3. Verifies the response is OK with correct validation.
  4. Fetches the graph and confirms the new node and edge exist.

### T5: Run quality gates
- `make test` — all tests pass
- `make lint` — no lint errors
