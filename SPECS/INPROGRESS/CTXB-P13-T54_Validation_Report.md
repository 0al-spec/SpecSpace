# CTXB-P13-T54 Validation Report

## Scope

Clarify the guarded Force runtime control copy so auto-settle reads as a completed relaxation pass, not as a broken or self-disabled `Live` mode.

## Local Validation

- `npm test --prefix graphspace -- force-layout` — passed, 2 files / 8 tests.
- `npm test --prefix graphspace` — passed, 59 files / 321 tests.
- `npm run lint:fsd --prefix graphspace` — passed.
- `npm run build --prefix graphspace` — passed, Vite chunk-size warning unchanged.

## Browser Smoke

- Desktop Playwright smoke on `http://127.0.0.1:5174/`:
  - Force enabled;
  - initial action reads `Run`;
  - active state reads `Pause` / `settling` and status `Force settling`;
  - paused state reads `Resume` / `paused` and status `Force paused`;
  - settled state reads `Run again` / `settled` and status `Force settled`;
  - while React Flow edge DOM is briefly absent during active relaxation, the lightweight Force overlay renders 66 visible edge paths with no `NaN` path data;
  - after settle, React Flow renders 132 visible edge paths with no `NaN` path data.
- Mobile/narrow Playwright smoke at 390x844:
  - active state reads `Pause` / `settling` with 66 visible overlay edge paths;
  - settled state reads `Run again` / `settled` with 132 visible React Flow edge paths;
  - no `NaN` path data.

## Notes

- Physics and auto-settle thresholds remain unchanged.
- The UI now frames the runtime as `Run` / `Pause` / `Resume` / `Run again`, with state labels `settling`, `paused`, and `settled`.
- The local smoke target still reports the known local `/api/v1/specpm/registry` 503; Force canvas behavior is otherwise validated on the built bundle.
