# CTXB-P7-T9 Viewport Sync Validation Report

## Scope

Extract ReactFlow viewport orchestration from `viewer/app/src/App.tsx` into
`useViewportSync()`:

- persisted initial viewport and fit-view default
- zoom-derived flags used by SpecGraph auto-collapse and minimap styling
- `panToPoint`, `panToNode`, and `fitNodes`
- minimap click centering and `onMoveEnd` persistence

## Acceptance

| Check | Result |
| --- | --- |
| Viewport helpers no longer live directly in `App.tsx` | Passed |
| SpecGraph auto-collapse still receives the zoom-derived flag | Passed |
| Existing viewer app build succeeds | Passed |

## Validation

```bash
npm run build --prefix viewer/app
```

Result: passed, with the existing Vite chunk-size warning.
