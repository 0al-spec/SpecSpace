# CTXB-P2-T2 — Add Conversation Detail And Checkpoint Inspection Panels

## Objective Summary

Deepen the graph-first workspace so selecting a conversation node reveals structured inspection data instead of only the raw transcript. The viewer should show conversation metadata, lineage context, checkpoint anchors, related edges, and checkpoint-level workflow affordances in one inspection surface that stays synchronized with the graph canvas.

This task is intentionally limited to inspection and surfacing actions. It should not implement ancestor jump shortcuts, merge creation, compile execution, or refresh-state persistence beyond the current selection model.

## Scope And Deliverables

### Deliverables

1. A conversation inspection panel in `viewer/index.html` driven by `GET /api/conversation`.
2. A checkpoint inspection panel in `viewer/index.html` driven by `GET /api/checkpoint`.
3. Transcript and checkpoint selection state that keeps the active message, active checkpoint, and active graph node aligned.
4. Lineage and integrity summaries that expose parent edges, child edges, and broken-link diagnostics for the selected conversation or checkpoint.
5. Surfaced workflow affordances for checkpoint actions, including the currently available branch action and explicit placeholders for later merge and compile flows.
6. Regression coverage for the inspection shell and updated README guidance for graph-first inspection.

### Out Of Scope

1. One-click ancestor and sibling navigation beyond opening related conversations already visible in the graph.
2. Full merge conversation authoring.
3. Compile target persistence or Hyperprompt export behavior.
4. Hard-refresh restoration of checkpoint selection and canvas viewport.

## Success Criteria

1. Selecting a graph node reveals a structured conversation detail panel with metadata, lineage edges, integrity state, and checkpoint inventory.
2. The user can inspect a specific checkpoint from the transcript and see its message identity, role, outbound child edges, and compile-target metadata.
3. The inspector surfaces what actions are available from the selected checkpoint now and what actions are intentionally deferred to later tasks.
4. The transcript, checkpoint inspector, and graph selection remain synchronized for the same conversation.

## Acceptance Tests

### UI Behavior Acceptance

1. The viewer exposes dedicated conversation and checkpoint inspection regions alongside the transcript.
2. Selecting a graph node loads conversation detail metadata, parent/child lineage context, and integrity summaries without leaving the graph-first workspace.
3. Selecting a transcript checkpoint highlights it and updates the checkpoint inspection panel.
4. The checkpoint inspector exposes a branch action and explicit merge / compile affordances with clear state.

### Data Contract Acceptance

1. Conversation inspection is driven by `GET /api/conversation?conversation_id=...`.
2. Checkpoint inspection is driven by `GET /api/checkpoint?conversation_id=...&message_id=...`.
3. Broken lineage and non-blocking diagnostics remain visible inside the inspection panels rather than being hidden by the transcript view.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.
3. `pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90` passes.

## Test-First Plan

1. Add failing smoke tests that lock the presence of conversation-detail and checkpoint-detail panel hooks plus the new API requests.
2. Add or extend HTTP-level tests only if the shipped UI needs contract changes beyond the existing conversation and checkpoint endpoints.
3. Implement the smallest client-side state changes required to make the new inspection tests pass before refining styling and interaction behavior.

## Implementation Plan

### Phase 1: Add The Inspection Shell

Inputs:
- `viewer/index.html`
- `tests/test_smoke.py`
- `README.md`

Outputs:
- conversation detail panel markup
- checkpoint detail panel markup
- smoke coverage for inspection hooks and API wiring

Steps:
1. Add dedicated inspection sections with stable IDs for conversation meta, lineage, integrity, and checkpoint details.
2. Add transcript checkpoint selection affordances so the currently inspected checkpoint is visible in the message list.
3. Update README guidance to describe graph-first inspection and checkpoint selection behavior.

Verification:
- HTML-oriented smoke tests fail first, then pass once the inspection shell exists.

### Phase 2: Wire Conversation And Checkpoint Data

Inputs:
- `GET /api/conversation`
- `GET /api/checkpoint`
- existing graph selection state

Outputs:
- client-side conversation detail fetch path
- checkpoint fetch path tied to transcript or checkpoint-list selection
- synchronized inspector rendering

Steps:
1. Fetch conversation detail when the selected graph node changes and cache or store the response in browser state.
2. Default the active checkpoint to a deterministic message anchor when appropriate and allow transcript clicks to change it.
3. Render parent edges, child edges, integrity summaries, and compile-target metadata from the API payloads.

Verification:
- Selecting different graph nodes or transcript checkpoints updates the inspector consistently.

### Phase 3: Surface Workflow Affordances

Inputs:
- active conversation detail
- active checkpoint detail
- existing branch editor workflow

Outputs:
- branch action wired from the checkpoint inspector
- merge / compile affordances surfaced as unavailable or forthcoming actions
- related-conversation quick-open actions where they do not conflict with later navigation work

Steps:
1. Reuse the existing branch editor entrypoint from the selected checkpoint.
2. Show merge and compile affordances explicitly with copy that marks them as later-phase work.
3. Expose parent and child conversation references in the detail panel so the user can inspect nearby lineage without scanning the raw JSON.

Verification:
- Inspector actions reflect current product capability honestly and do not imply merge or compile is already implemented.

## Decision Points

1. The inspector should consume the existing graph-aware API endpoints rather than reconstructing lineage from the currently loaded file alone.
2. Checkpoint selection should key off canonical `message_id` values so later navigation and compile-target tasks can build on the same state.
3. Future-facing actions may be surfaced before they are implemented, but only if the UI clearly labels them as unavailable and does not create ambiguous behavior.

## Notes

Keep the current transcript rendering as the primary content surface while making the inspector the structured control plane for metadata and actions. This task should leave later navigation and compile work easier, not partially implemented.

---
**Archived:** 2026-03-22
**Verdict:** PASS
