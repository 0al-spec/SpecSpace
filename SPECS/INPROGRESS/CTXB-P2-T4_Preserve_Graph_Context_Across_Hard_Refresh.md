# CTXB-P2-T4 — Preserve Graph Context Across Hard Refresh

## Objective Summary

Make `Cmd+R` (hard refresh) restore the user's graph context — the selected conversation, selected checkpoint, and canvas viewport position — when the referenced objects still exist after reload. If any previously selected object was removed externally, the UI falls back to the nearest valid state and shows what could not be restored.

This task uses `sessionStorage` to persist context across refreshes within the same tab session, and URL hash parameters as a secondary mechanism for sharing deep links. No server-side changes are required.

## Scope And Deliverables

### Deliverables

1. **Session persistence**: on every meaningful state change, write `conversationId`, `checkpointId`, `panX`, and `panY` to `sessionStorage`.
2. **Restore on initialize**: during `initialize()`, read persisted state and restore selection + viewport when the referenced nodes still exist in the freshly loaded graph.
3. **Graceful fallback**: if the persisted conversation no longer exists, fall back to the first root or first node with a status notice. If only the checkpoint is missing, restore the conversation but default the checkpoint.
4. **URL hash support**: write `#conversation={id}&checkpoint={id}` to the URL on state changes so deep linking and bookmarking work. On load, URL hash takes precedence over sessionStorage.
5. **Regression tests** for the persistence hooks and fallback behavior.

### Out Of Scope

1. Server-side session storage.
2. Cross-tab synchronization.
3. Canvas zoom level persistence (only pan position is persisted).
4. Integrity issue surfacing (CTXB-P2-T5).

## Success Criteria

1. Refreshing the page restores the previous conversation, checkpoint, and canvas position when data still exists.
2. If the prior conversation was removed externally, the UI falls back to a valid state with a clear notice.
3. If only the checkpoint was removed, the conversation is restored with the default checkpoint.
4. The behavior satisfies PRD FR-9, NFR-6, and Flow E.

## Acceptance Tests

### UI Behavior Acceptance

1. After selecting a conversation and checkpoint, `Cmd+R` restores both selections and the canvas viewport.
2. If the persisted conversation no longer exists after refresh, the UI selects the first available root and shows a fallback notice.
3. URL hash parameters (`#conversation=...&checkpoint=...`) override sessionStorage on load.
4. Navigating between conversations updates both sessionStorage and URL hash.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.
3. `pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90` passes.

## Test-First Plan

### Step 1: Add smoke tests

- Add smoke test verifying `sessionStorage` usage and hash-based restoration logic exists in `viewer/index.html`.

### Step 2: Implement sessionStorage persistence

- Write a `persistGraphContext()` function that saves `conversationId`, `checkpointId`, `panX`, `panY` to sessionStorage.
- Call it from `selectConversation()`, `selectCheckpoint()`, and pan end events.

### Step 3: Implement URL hash updates

- Write a `updateLocationHash()` function that sets the URL hash to encode current conversation and checkpoint.
- Call it alongside `persistGraphContext()`.

### Step 4: Implement restore logic in initialize()

- Read URL hash first, then sessionStorage as fallback.
- Validate that the persisted conversation exists in the loaded graph.
- Restore selection and viewport, or fall back with notice.

### Step 5: Validation and cleanup

- Run `make test`, `make lint`, coverage gate.
- Create validation report.
