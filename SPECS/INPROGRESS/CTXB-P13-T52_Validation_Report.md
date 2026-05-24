# CTXB-P13-T52 Validation Report

## Scope

Add guarded live Force simulation on top of compact Force glyph mode.

## Local Validation

- `npm test --prefix graphspace -- force-layout` — passed, 2 files / 8 tests.
- `npm test --prefix graphspace` — passed, 59 files / 321 tests.
- `npm run lint:fsd --prefix graphspace` — passed.
- `npm run build --prefix graphspace` — passed, Vite chunk-size warning unchanged.
- `git diff --check` — passed.

## Browser Smoke

- In-app browser on `http://127.0.0.1:5174/`:
  - live SpecGraph source loaded;
  - Force enabled;
  - compact glyph nodes visible for 67 specs;
  - straight Force edges visible for 178 visible edges;
  - Live resumes to `running`;
  - Pause changes `data-force-live-layout` to `paused`.
- Playwright screenshot smoke:
  - desktop `1440x1000` canvas loaded and captured at `/tmp/specspace-force-desktop.png`;
  - narrow `390x844` canvas loaded and captured at `/tmp/specspace-force-mobile.png`.

## Notes

- Live Force is opt-in and only appears after Force mode is active.
- Default Force no longer has a hard node-count cap; explicit diagnostic budgets remain supported by the guard model.
- Dragging a Force glyph reheats live simulation and does not persist Force-only positions into normal layout overrides.
