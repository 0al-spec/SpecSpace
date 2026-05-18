# CTXB-P13-T20 Validation Report

Node moving and layout persistence.

## Changes

- Added a SpecGraph canvas layout override model scoped to browser-local UI state.
- Enabled controlled node dragging in the React Flow canvas.
- Persisted dragged node positions in `localStorage` under a graph-scoped key.
- Added a reset action that removes local overrides and restores Refinement Ladder Layout.
- Documented that layout overrides are SpecSpace UI state and must not mutate readonly SpecGraph artifacts.

## Validation

```bash
npm test --prefix graphspace -- layout-overrides
npm run build --prefix graphspace
npm run lint:fsd --prefix graphspace
```

Results:

- `layout-overrides`: 1 file / 5 tests passed.
- `build`: passed; retained the existing Vite chunk-size warning.
- `lint:fsd`: passed with no problems.
