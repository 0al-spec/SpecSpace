# CTXB-P7-T9 Canvas Interactions Validation Report

## Scope

Extract graph canvas interaction state from `viewer/app/src/App.tsx` into
`useGraphInteractionState()`:

- ReactFlow node position preservation and selection sync
- stale selection cleanup and layout-switch refocus
- node click and search selection handlers
- spec hover preview state
- edge highlight and edge hover card state
- pane-click selection clearing

## Acceptance

| Check | Result |
| --- | --- |
| Canvas interaction state no longer lives directly in `App.tsx` | Passed |
| Extracted hook exposes the same ReactFlow handler surface to `GraphCanvas` | Passed |
| Existing viewer app build succeeds | Passed |

## Validation

```bash
npm run build --prefix viewer/app
```

Result: passed, with the existing Vite chunk-size warning.
