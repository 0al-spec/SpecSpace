# CTXB-P10-T8 — Add canvas-first panel dock for GraphSpace

## Status

INPROGRESS

## Context

GraphSpace now has a primary SpecGraph canvas, deterministic layout, node selection,
and a richer Spec Inspector. The remaining layout problem is that secondary
live-artifact panels still create visual noise by occupying large permanent rails.

The intended desktop model is closer to the old ContextBuilder structure:

- Sidebar for graph context, lists, filters, and utility entry points.
- Spec Inspector for selected specification content.
- Secondary utility panels opened explicitly over the canvas when needed.

## Deliverables

- Add a canvas-level launcher for Sidebar and utility panels.
- Make Sidebar hidden by default and closable.
- Render Recent changes, Implementation work, and Proposal trace as one active
  utility surface at a time.
- Preserve all existing live/sample fallback behaviour for secondary artifacts.
- Keep Spec Inspector independent from utility panel state.

## Acceptance Criteria

- Sidebar is hidden by default and opens from a canvas-level button.
- Recent changes, Implementation work, and Proposal trace remain reachable.
- Only one secondary utility panel is visible at a time.
- Closing secondary surfaces leaves the canvas visually dominant.
- Spec Inspector selection and relation navigation continue to work.
- Desktop and mobile viewports avoid incoherent text or panel overlap.

## Validation Plan

- Run GraphSpace unit tests.
- Run GraphSpace production build.
- Run GraphSpace FSD lint.
- Smoke-check the viewer in the browser at `http://127.0.0.1:5173/`.
