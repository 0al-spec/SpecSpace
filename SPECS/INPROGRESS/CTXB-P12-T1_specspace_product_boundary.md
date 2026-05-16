# CTXB-P12-T1 — Define SpecSpace product boundary and next queue

## Objective

Create a clean planning boundary after the deployment work: SpecSpace remains a
readonly SpecGraph/SpecPM viewer and API, while legacy ContextBuilder
conversation authoring remains in `viewer/app` and Phase 3.

## Acceptance Checks

- `CTXB-P3-T6` is marked complete as legacy ContextBuilder authoring work.
- Phase 12 exists in `SPECS/Workplan.md` with SpecSpace-only follow-ups.
- `SPECS/INPROGRESS/next.md` selects Phase 12 instead of more Phase 3
  conversation tasks.
- Follow-up tasks cover product documentation and a `graphspace/` API boundary
  guardrail.

## Implementation Plan

1. Update the workplan with the completed legacy authoring task.
2. Add Phase 12 with a short SpecSpace product-boundary queue.
3. Update the active queue to select `CTXB-P12-T1`.
4. Record validation in `CTXB-P12-T1_Validation_Report.md`.
