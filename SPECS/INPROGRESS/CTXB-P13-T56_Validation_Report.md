# CTXB-P13-T56 Validation Report

## Scope

Add desktop keyboard and focus affordances for SpecGraph canvas layout preset
navigation.

## Local Validation

- `npm test --prefix graphspace -- src/widgets/spec-graph-canvas/__tests__/layout-presets.spec.ts --reporter=verbose` — passed, 1 file / 9 tests.
- `npm run build --prefix graphspace` — passed, Vite chunk-size warning unchanged.
- `npm run lint:fsd --prefix graphspace` — passed.
- `npm test --prefix graphspace` — passed, 60 files / 327 tests.
- `git diff --check` — passed.

## Browser Smoke

- Desktop smoke on `http://127.0.0.1:5173/`:
  - `Alt+]` cycles `Tree -> Linear -> Spine -> Canonical -> Status`;
  - Force is reached only when the Force guard reports it is available;
  - `Alt+[` from active Force returns to the previous concrete layout preset;
  - layout button titles expose the shortcut metadata without adding visible
    instructional text.
- Mobile/narrow smoke at `390x844`:
  - layout preset controls remain inside the canvas chrome;
  - keyboard affordance metadata is present on layout buttons;
  - no overlap was observed with panel chrome or canvas controls.

## Notes

- Guarded Force is not part of the persisted layout preset list. Keyboard
  cycling treats it as a transient target and skips it when unavailable.
- Existing selected-spec history shortcuts keep using `[` / `]`; layout cycling
  requires `Alt` and does not fire inside text-entry targets.
