# CTXB-P7-T9 Keyboard Shortcuts Validation Report

## Scope

Extract global viewer keyboard shortcuts from `viewer/app/src/App.tsx`:

- `Cmd/Ctrl+K` toggles the search palette
- `Escape` clears active Recent Changes multi-select
- `Alt+ArrowLeft` and `Alt+ArrowRight` navigate Spec history
- `R` and `T` toggle Recent Changes and Timeline in Spec mode
- ReactFlow `F` fit-view shortcut lives in a small dedicated component

## Acceptance

| Check | Result |
| --- | --- |
| Global shortcut effects no longer live directly in `App.tsx` | Passed |
| Shortcuts preserve their existing mode and editable-target guards | Passed |
| Existing viewer app build succeeds | Passed |

## Validation

```bash
npm run build --prefix viewer/app
```

Result: passed, with the existing Vite chunk-size warning.
