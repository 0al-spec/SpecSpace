# CTXB-P7-T12 Validation Report

## Scope
- Extracted shared `useFetchedData<T>` for fetch, loading, error, and refresh state.
- Reused the shared hook from `useGraphData` and `useSpecGraphData`.
- Added `/api/watch` backed by `WorkspaceWatcher` so conversation graph data refreshes when workspace JSON files change.
- Updated smoke tests for the decomposed `App.tsx` / `GraphCanvas.tsx` layout.

## Acceptance
- Both graph hooks use the shared fetch state machine.
- SpecGraph SSE refresh behavior remains on `/api/spec-watch`.
- Conversation graph now listens to `/api/watch`.
- Workspace watcher tracks `.json` file mtime and size changes.

## Validation
- `npm run typecheck --prefix viewer/app`: passed
- `npm run lint --prefix viewer/app`: passed
- `npm run build --prefix viewer/app`: passed, with the existing Vite chunk-size warning
- `python -m mypy viewer/`: passed
- `make lint`: passed
- `python -m pytest tests/ -q`: 529 passed, 41 subtests passed
