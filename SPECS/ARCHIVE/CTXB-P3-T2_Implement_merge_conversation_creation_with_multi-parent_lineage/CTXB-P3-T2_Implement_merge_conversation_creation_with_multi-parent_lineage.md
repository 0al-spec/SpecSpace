# CTXB-P3-T2 — Implement merge conversation creation with multi-parent lineage

**Status:** In Progress
**Priority:** P0
**Dependencies:** CTXB-P1-T5, CTXB-P2-T2
**Branch:** `feature/CTXB-P3-T2-merge-conversation-creation`

---

## Overview

Add the workflow that creates a new conversation file referencing two or more parent checkpoints without attempting to synthesize or auto-merge message bodies.

The API layer (`POST /api/file`) already accepts multi-parent lineage payloads (with `link_type: "merge"`) and classifies them as `"canonical-merge"`. This task adds:
1. A `MergeDialog` UI component for selecting multiple parent checkpoints
2. A "Create Merge" button in `InspectorOverlay` visible when a checkpoint is selected
3. Integration tests for the merge creation workflow

---

## Deliverables

1. **`viewer/app/src/MergeDialog.tsx`** — Modal dialog for merge creation
   - Shows the initially-selected checkpoint as the first parent
   - Fetches available conversations and lets user pick additional checkpoints from a second parent dropdown
   - Filename and title inputs
   - Constructs multi-parent lineage payload and POSTs to `/api/file`

2. **`viewer/app/src/InspectorOverlay.tsx`** — Add "Create Merge" button
   - Rendered next to the existing "Create Branch" button when a checkpoint is active
   - Opens `MergeDialog` with the current checkpoint pre-filled as the first parent

3. **`tests/test_api_contracts.py`** — Merge creation test class
   - Valid merge creation from two checkpoints produces a `canonical-merge` node with two inbound edges
   - Merge with a single parent is rejected (must have ≥ 2)
   - Merge with duplicate parents is rejected
   - Merge with missing parent conversations/messages is rejected (400)
   - Duplicate file name is rejected (409)

---

## Acceptance Criteria

- [ ] A user can create a merge conversation from multiple checkpoints via the UI.
- [ ] The created file records every parent reference deterministically with `link_type: "merge"`.
- [ ] The resulting node renders with multiple inbound edges and no implicit transcript synthesis (empty `messages`).
- [ ] All existing tests continue to pass.
- [ ] New tests cover the happy path and all rejection cases.

---

## Design Decisions

### UX: Two-parent dialog
The initial implementation targets the most common merge case: exactly two parents. The dialog:
- Pre-fills "Parent 1" from the checkpoint that was active when the dialog opened.
- Shows a "Parent 2" dropdown to pick from all loaded conversations, then a secondary dropdown to pick the specific message (checkpoint) from that conversation.
- The UI does not prevent selecting a checkpoint in the same conversation as Parent 1, but the schema's duplicate-parent validation will catch that case server-side.

### API reuse
No new API endpoint is needed. The existing `POST /api/file` with multi-parent lineage is the write path.

### Conversation ID generation
Same pattern as BranchDialog: `conv-${sanitizedName}` derived from the filename input.

---

## Implementation Notes

- `MergeDialog` fetches `/api/graph` to populate the second parent conversation list, then fetches `/api/conversation?conversation_id=XXX` to populate the message list for that conversation.
- All parents use `link_type: "merge"` in the payload.
- On success, call `onGraphRefresh()` so the graph re-renders with the new merge node.
- Error messages from the server are displayed inline in the dialog.
