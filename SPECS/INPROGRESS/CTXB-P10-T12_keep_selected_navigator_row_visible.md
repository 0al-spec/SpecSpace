# CTXB-P10-T12 — Keep selected navigator row visible

## Status

INPROGRESS

## Context

After canvas focus, selection can originate from outside the Sidebar list. The
navigator should keep the selected row visible when that row is part of the
current filtered result set.

## Deliverables

- Track the selected navigator row element.
- Scroll the selected row into view when selection changes externally.
- Refresh custom scrollbar metrics after selection-driven scroll.

## Acceptance Criteria

- External selection scrolls the selected row into view when it is visible in
  the current filter result set.
- Search and signal filters are preserved.
- Hidden-by-filter selections do not mutate filter state.
- Row click selection remains unchanged.

## Validation Plan

- Run `npm test`.
- Run `npm run build`.
- Run `npm run lint:fsd`.
- Browser-smoke selection sync at `http://localhost:5173/`.
