# CTXB-P13-T28 Validation Report

## Scope
- Added typed SpecGraph canvas layout presets.
- Preserved the existing `Refinement Ladder` behavior as the default named preset.
- Added a `Status` preset that groups nodes into status columns.
- Persisted the selected layout preset in `localStorage` while keeping manual node position overrides separate and applied on top.
- Advanced the Phase 13 tracker from `CTXB-P13-T27` to `CTXB-P13-T28`.

## Validation
- `npm test --prefix graphspace -- layout-presets load-spec-graph` — PASS, 2 files / 19 tests.
- `npm test --prefix graphspace` — PASS, 45 files / 239 tests.
- `npm run lint:fsd --prefix graphspace` — PASS, no problems found.
- `npm run build --prefix graphspace` — PASS, Vite chunk-size warning only.
- Browser smoke on `http://127.0.0.1:5173/` — PASS: `Ladder` and `Status` controls render; switching sets `data-layout-preset` to `status-columns`, then back to `refinement-ladder`. The only console error was the existing local `/api/v1/specpm/registry` 503.
- Mobile regression smoke on `http://127.0.0.1:5173/` at `390x844` — PASS: Proposal Viewer opens from Sidebar, entries scroll region is reachable after source chips, and programmatic scroll reaches lower proposal rows. The only console error was the existing local `/api/v1/specpm/registry` 503.
- `git diff --check` — PASS.
