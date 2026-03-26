# CTXB-P2R-T12 — Increase maximum zoom-out on the graph canvas

**Status:** In Progress
**Priority:** P2
**Dependencies:** CTXB-P2R-T1
**Branch:** feature/CTXB-P2R-T12-increase-min-zoom
**Date:** 2026-03-26

---

## Problem Statement

The React Flow graph canvas has a default `minZoom` of `0.5`, which prevents users from zooming out far enough to see large graphs with many nodes at once. Users are forced to pan across the canvas rather than being able to fit the full graph in the viewport.

---

## Deliverables

1. **`viewer/app/src/App.tsx`** — Add `minZoom={0.125}` prop to the `<ReactFlow>` component, reducing the minimum zoom level from the default `0.5` to `0.125` (4× further zoom-out).

---

## Acceptance Criteria

- AC1: The user can zoom out until the graph is approximately 4× smaller than the previous minimum zoom level (i.e. `minZoom` = `0.125`).
- AC2: All existing tests continue to pass (`make test`).
- AC3: No lint errors (`make lint`).

---

## Implementation Notes

- React Flow's `minZoom` prop accepts a number; the default is `0.5`.
- Setting `minZoom={0.125}` allows zooming out to 12.5% of the original size, which is 4× further than the current `0.5` limit.
- No other component, test, or configuration file needs to change — this is a single-prop addition.

---

## Out of Scope

- Changing `maxZoom` or any other zoom-related behavior.
- Persisting the zoom level beyond what the existing viewport session-storage already handles.

---
**Archived:** 2026-03-26
**Verdict:** PASS
