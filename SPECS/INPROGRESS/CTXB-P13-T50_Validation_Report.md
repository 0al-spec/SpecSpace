# CTXB-P13-T50 Validation Report

**Task:** Add guarded Force layout runtime

## Scope

This PR adds the first guarded Force runtime for the SpecGraph canvas.

- Force remains outside `SPEC_GRAPH_CANVAS_LAYOUT_PRESETS`.
- Force is opt-in through an explicit canvas button.
- Force is blocked when the current graph exceeds the guard node/edge budget.
- The runtime reuses the existing React Flow canvas, edge rendering, minimap,
  selection, overlays, subtree collapse, and layout override path.
- Force positions are deterministic and non-animated; the default canvas path
  still uses existing deterministic presets.

## Validation

- `npm test --prefix graphspace -- force-layout` — passed
- `npm test --prefix graphspace` — passed, 59 files / 319 tests
- `npm run lint:fsd --prefix graphspace` — passed
- `npm run build --prefix graphspace` — passed, with the existing Vite
  chunk-size warning
- `git diff --check` — passed

## Browser Smoke

- desktop viewport `1440x1000`, `http://127.0.0.1:5174/`: public SpecGraph
  data loaded, Force enabled, `67/80 nodes` and `178/220 edges`, minimap and
  controls remained visible.
- mobile/narrow viewport `390x844`, `http://127.0.0.1:5174/`: public SpecGraph
  data loaded, Force enabled, controls remained reachable.

Local smoke used a temporary static+API proxy on `127.0.0.1:5174` because the
existing Vite dev proxy on `5173` resolves `localhost:8001` to the wrong local
listener in this workstation. Direct backend API on `127.0.0.1:8001` returned
the live SpecGraph data. Browser console had only the known local
`/api/v1/specpm/registry` 503 from an unconfigured local SpecPM registry; canvas
and SpecGraph API calls were clean.
