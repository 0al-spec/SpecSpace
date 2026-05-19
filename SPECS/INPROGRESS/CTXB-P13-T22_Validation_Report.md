# CTXB-P13-T22 Validation Report

## Scope

Add contextual Proposal Viewer and Metrics Viewer filtering from SpecGraph canvas overlay badges.

## Acceptance

- Node proposal overlays open Proposal Viewer filtered by exact `affected_spec_ids`.
- Node metric overlays open Metrics Viewer filtered by exact node references.
- Edge metric overlays open Metrics Viewer filtered by exact edge references.
- Context filters are visible in the target panel and can be cleared.
- Sidebar panel opening clears contextual overlay filters.

## Validation

- `npm test --prefix graphspace -- proposal-filters metrics-filters` — 2 files / 9 tests passed.
- `npm test --prefix graphspace` — 42 files / 224 tests passed.
- `npm run build --prefix graphspace` — passed; Vite retained the existing chunk-size warning.
- `npm run lint:fsd --prefix graphspace` — passed with no problems found.
- Browser smoke on `http://localhost:5173/` — SpecSpace loaded. Local console still reports the pre-existing static/local `/api/v1/specpm/registry` 503 plus missing `favicon.ico`; canvas and live artifact status rendered.
