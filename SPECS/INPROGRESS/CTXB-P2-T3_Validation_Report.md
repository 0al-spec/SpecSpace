# CTXB-P2-T3 Validation Report

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | 40 passed, 0 failed |
| Lint | `make lint` | Clean |
| Coverage | `pytest --cov --cov-fail-under=90` | 91.61% (≥90% required) |

## Acceptance Criteria Verification

### UI Behavior

1. **"Go to parent checkpoint" button** — Added to conversation inspector for each resolved parent edge. Clicking navigates to the parent conversation, selects the specific checkpoint, and centers the canvas.
2. **Sibling section in checkpoint inspector** — Child edges are now labeled as sibling branches with a count header. The current conversation (if it is a child of this checkpoint) gets a "Current" pill and no navigation button; others get a "Go to sibling" button.
3. **Canvas auto-center on navigation** — `selectConversation()` now calls `centerOnSelection()` after setting the selection and re-rendering the graph.
4. **Root conversations** — No parent navigation controls shown (unchanged behavior).

### API Contract

1. No server-side changes required. The existing `child_edges` on checkpoint API responses already contain the sibling data.
2. New test `test_collect_checkpoint_api_returns_sibling_edges_for_lineage_navigation` verifies the ancestor-to-sibling navigation flow at the API level.

### PRD Coverage

- **FR-6**: "The user must be able to navigate from a conversation to its ancestor checkpoint, then to sibling or related branches derived from the same lineage." — Satisfied by Go to parent checkpoint + sibling listing.
- **Flow D preconditions**: Compile target selection requires an active conversation/checkpoint — navigation now makes reaching any checkpoint a single-action operation.

## Files Changed

| File | Change |
|------|--------|
| `viewer/index.html` | Added `createGoToParentCheckpointButton()`, sibling awareness in checkpoint inspector, auto-center on `selectConversation()` |
| `tests/test_api_contracts.py` | Added lineage navigation round-trip test |
