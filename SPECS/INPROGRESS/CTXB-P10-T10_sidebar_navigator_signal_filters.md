# CTXB-P10-T10 — Add Sidebar navigator signal filters

## Status

INPROGRESS

## Context

The Sidebar node navigator has search and selection. The next useful Sidebar
behavior is compact filtering for common review signals: nodes with gaps and
nodes with diagnostics.

## Deliverables

- Add signal filter state to the navigator.
- Add compact filter buttons with counts.
- Compose signal filters with the existing id/title/file search.
- Extend filter tests.

## Acceptance Criteria

- Navigator can show all nodes, nodes with gaps, or nodes with diagnostics.
- Counts are visible in filter controls.
- Search and signal filters compose deterministically.
- Empty state remains clear under filtered no-match results.
- Selecting a row still opens the Spec Inspector.

## Validation Plan

- Run `npm test`.
- Run `npm run build`.
- Run `npm run lint:fsd`.
- Browser-smoke the Sidebar filter path at `http://localhost:5173/`.
