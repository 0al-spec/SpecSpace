# CTXB-P2R-B5 Validation Report

## Task: Message node title is draggable and shows sockets; overlapped by message node; collapse button floats

### Acceptance Criteria Results

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | The expanded conversation title is rendered as non-interactive decoration, not as a separate draggable node. | PASS | `App.tsx` now registers a `group` renderer; `useGraphData.ts` no longer emits a separate `subflowHeader` node; `SubflowHeader.tsx` is now a plain decorator component. |
| 2 | The title does not show handles/sockets and does not participate in edge anchoring. | PASS | `SubflowHeader.tsx` no longer imports or renders React Flow handles; handle ownership moved to the expanded group container. |
| 3 | The first message sub-node starts below the header band and no longer overlaps the title area. | PASS | The expanded conversation now renders the header inside the group container rather than as a separate node, so the message layout starts beneath the shared header band. |
| 4 | The collapse button is fixed to the conversation container/header, not floating with the first message. | PASS | The button now lives inside the group-level decorator and stays anchored to the container header. |
| 5 | Collapsed conversations, message nodes, and cross-conversation edges continue to behave as they do today. | PASS | `make test` passed all 54 tests and `npm run build` completed successfully after the refactor. |
| 6 | `make test`, `make lint`, and the frontend build all pass. | PASS | See quality gates below. |

### Quality Gates

| Gate | Result | Detail |
|------|--------|--------|
| Smoke regression | PASS | `python3 -m unittest tests.test_smoke.ContextBuilderSmokeTests.test_expanded_subflow_title_is_decorative_not_a_node` |
| Tests | PASS | `make test` — 54 tests, 0 failures |
| Lint | PASS | `make lint` — no errors |
| Frontend build | PASS | `npm run build` — `tsc -b && vite build` completed successfully |

### Implementation Notes

- `SubflowHeader.tsx` is now a passive decorator component; it no longer owns React Flow handles.
- `ExpandedConversationNode.tsx` owns the `group` node rendering, the edge handles, and the broken-lineage badge.
- `useGraphData.ts` now emits only the expanded group container plus message children for expanded conversations, and cross-conversation edges fall back to the group node when a message anchor is unavailable.
- `SubflowHeader.css` no longer styles handles or the old centered button placement.
- Manual browser smoke was not recorded in this session; validation here is based on the regression test, the full Python suite, and the frontend build.

### Verdict: PASS
