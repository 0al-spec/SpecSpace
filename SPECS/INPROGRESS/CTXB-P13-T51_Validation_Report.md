# CTXB-P13-T51 Validation Report

**Task:** Add compact Force glyph presentation

## Scope

This PR refines the active guarded Force runtime presentation:

- active Force nodes render as compact circular `SPEC-ID` glyphs;
- active Force edges render as direct straight links;
- normal canvas presets keep full SpecNode cards and existing route controls;
- Force spacing is tuned for smaller glyph nodes.

## Validation

- `npm test --prefix graphspace -- force-layout` — passed, 2 files / 7 tests
- `npm test --prefix graphspace` — passed, 59 files / 320 tests
- `npm run lint:fsd --prefix graphspace` — passed
- `npm run build --prefix graphspace` — passed, with the existing Vite
  chunk-size warning
- `git diff --check` — passed

## Browser Smoke

- desktop viewport `1440x1000`, `http://127.0.0.1:5174/`: public SpecGraph
  data loaded, Force enabled, glyph nodes visible, straight edges interactive.
- mobile/narrow viewport `390x844`, `http://127.0.0.1:5174/`: public SpecGraph
  data loaded, Force enabled, glyph nodes visible.

Local smoke used the same temporary static+API proxy as T50 to avoid the local
`localhost:8001` listener conflict in Vite dev proxy. Browser console had only
the known local `/api/v1/specpm/registry` 503 from an unconfigured local SpecPM
registry; SpecGraph and canvas calls were clean.
