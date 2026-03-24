# CTXB-P2R-B5 — Message node title is draggable and shows sockets; overlapped by message node; collapse button floats

## Objective Summary

Expanded conversations currently render a separate `subflowHeader` React Flow node above the first message. That makes the title behave like a draggable graph node, shows handles/sockets on the title row, and leaves the collapse control visually attached to the sub-node instead of the conversation container. The first message also starts too high and visually collides with the header band.

The fix is to make the expanded conversation title a passive decorator inside the expanded conversation container itself. The title must no longer be a separate node in the graph model, and the collapse button must stay pinned to the container header area. Message nodes should begin below that header band without overlap. Existing collapsed conversation behavior, message subflow routing, and cross-conversation edges must remain intact.

## Scope and Constraints

- Keep the change inside the React Flow viewer in `viewer/app/src/`.
- Preserve the current graph API contracts and backend behavior.
- Do not add a new test framework or a new runtime dependency.
- Maintain existing collapsed conversation rendering and drag behavior.
- Preserve existing cross-conversation routing for collapsed, expanded, and mixed states.
- The expanded conversation container may still be draggable as a whole; only the title must stop acting like an interactive node.

## Acceptance Criteria

1. The expanded conversation title is rendered as non-interactive decoration, not as a separate draggable node.
2. The title does not show handles/sockets and does not participate in edge anchoring.
3. The first message sub-node starts below the header band and no longer overlaps the title area.
4. The collapse button is fixed to the conversation container/header, not floating with the first message.
5. Collapsed conversations, message nodes, and cross-conversation edges continue to behave as they do today.
6. `make test`, `make lint`, and the frontend build all pass.

## Test-First Plan

| Step | Test / Check | Purpose | Expected Red Before Fix |
|---|---|---|---|
| 1 | Add a regression test in `tests/test_smoke.py` or a new focused test helper | Pin the expanded-conversation structure so the title is no longer emitted as a separate `subflowHeader` node | The assertion still sees the separate header node or the old node wiring |
| 2 | Add a spacing assertion for expanded message placement, ideally through a small pure helper extracted from `useGraphData.ts` | Ensure the first message starts below the header band | The first message `y` offset is still too close to the header band |
| 3 | Keep the existing Python checks plus `npm run build` as the final validation gate | Confirm the refactor compiles and the viewer bundle still builds | Build succeeds only after the refactor is complete |

If the node-construction logic is easiest to test after extraction, extract the smallest pure helper needed for the test and keep the helper focused on expanded-node assembly only. Do not introduce a broad abstraction just for testability.

## Implementation Plan

### Phase 1: Lock the regression

- Inputs: current `useGraphData.ts`, `App.tsx`, `SubflowHeader.tsx`, and the existing smoke tests.
- Work: add the smallest failing regression test(s) that describe the desired expanded-state structure and spacing.
- Output: a red test that proves the current separate header-node approach is the bug.
- Verification: the test fails before any production code changes.

### Phase 2: Move the title into the expanded container

- Inputs: the failing regression test(s).
- Work: refactor expanded conversation rendering so the conversation container itself renders the title decoration and collapse control; remove the separate `subflowHeader` node from the graph model; keep cross-conversation routing valid by anchoring expanded-state edges to the expanded container when needed.
- Output: a single expanded conversation container with child message nodes, a non-interactive title decoration, and a fixed collapse button in the header area.
- Verification: the title is no longer a separate node, no sockets are shown on the title, and the button stays attached to the container.

### Phase 3: Normalize spacing and validate

- Inputs: the refactored node/component structure.
- Work: adjust header height, padding, and node styling so the first message starts below the header band; clean up any obsolete `SubflowHeader` handle styles; run the required checks and capture the result in a validation report.
- Output: visually stable expanded conversations with no title/message overlap.
- Verification: `make test`, `make lint`, `npm run build`, and a browser smoke check against an expanded conversation all pass.

## Deliverables

- Updated viewer components and graph construction under `viewer/app/src/`.
- Regression coverage for the expanded conversation title/spacing behavior.
- `SPECS/INPROGRESS/CTXB-P2R-B5_Validation_Report.md`.

## Notes

- Update only the workflow artifacts needed for completion: the validation report now, then archive bookkeeping after the task passes.
- No product documentation outside `SPECS/` is expected to change for this task.
- Preserve the current graph API and backend tests; this is a frontend rendering refactor, not a data-contract change.
