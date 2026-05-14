# CTXB-P7-T9 Capabilities And Selection State Validation Report

## Scope

Extract two orchestration concerns from `viewer/app/src/App.tsx`:

- optional backend capability probing into `useCapabilities()`
- selected conversation/message/spec navigation state into `useSelectionState()`

The public UI behaviour remains unchanged; `App.tsx` still wires the resulting
state into Sidebar, inspectors, search, lens, and canvas handlers.

## Acceptance

| Check | Result |
| --- | --- |
| Capability probing no longer lives directly in `App.tsx` | Passed |
| Selection, compile target, and Spec navigation state are covered by an extracted hook | Passed |
| Existing viewer app build succeeds | Passed |

## Validation

```bash
npm run build --prefix viewer/app
```

Result: passed, with the existing Vite chunk-size warning.
