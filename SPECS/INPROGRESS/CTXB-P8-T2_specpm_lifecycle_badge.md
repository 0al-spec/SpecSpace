# CTXB-P8-T2 - SpecPM lifecycle badge on SpecNode

## Summary

Show SpecPM package lifecycle status directly on GraphSpace SpecGraph canvas
nodes when the lifecycle read-model identifies source SpecGraph nodes for a
package.

## Deliverables

- Extend `/api/specpm/lifecycle` packages with `root_spec_id` and
  `source_spec_ids` anchors.
- Add a GraphSpace parser for the lifecycle read-model.
- Add a lifecycle badge model that projects packages onto source spec nodes and
  chooses the strongest visible tone.
- Render a compact lifecycle badge inside `SpecNodeCard`.
- Fetch lifecycle badges on the runs-watch refresh cadence and pass them into
  the canvas.

## Acceptance Criteria

- Nodes referenced by a lifecycle package show the dominant lifecycle status.
- Current package status `draft_preview_only` appears on `SG-SPEC-0001`.
- Nodes with no lifecycle source entry remain visually unchanged.
- Badge tones match the SpecPM status vocabulary: draft, ready, blocked.
- Badge rendering does not interfere with click, hover preview, or inspector
  selection.
- Lifecycle refresh follows the existing runs-watch tick.

## Stack Plan

1. Backend lifecycle read-model anchors.
2. GraphSpace parser and badge model.
3. `SpecNodeCard` lifecycle badge UI.
4. Canvas/page wiring and validation report.
