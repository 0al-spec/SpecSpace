# CTXB-P13-T21 Validation Report

Proposal and metric overlays on graph nodes and edges.

## Changes

- Added a SpecGraph canvas overlay model for proposal and metrics signals.
- Rendered bounded clickable `P` and `M` badges on nodes with proposal/metric references.
- Rendered clickable metrics badges on edges when metrics explicitly reference graph edge ids.
- Wired overlay clicks to open the Proposal Viewer or Metrics Viewer while selecting the relevant node/edge.
- Advanced the Phase 13 plan from T20 to T21.

## Validation

```bash
npm test --prefix graphspace -- overlays
npm run build --prefix graphspace
npm run lint:fsd --prefix graphspace
```

Results:

- `overlays`: 1 file / 3 tests passed.
- `build`: passed; retained the existing Vite chunk-size warning.
- `lint:fsd`: passed with no problems.
