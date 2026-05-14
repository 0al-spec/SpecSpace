# CTXB-P7-T9 App Shell And Panels Validation Report

## Scope

Extract the remaining application shell from `viewer/app/src/App.tsx`:

- `AppSidebar` owns Sidebar prop adaptation and selected file derivation.
- `AppPanels` owns inspectors, lens, export/compile/exploration overlays, agent chat,
  hover cards, search palette, and telemetry.
- `AppShell` owns top-level layout rendering.
- `useViewerAppController()` composes the extracted hooks and state providers.

## Acceptance

| Check | Result |
| --- | --- |
| `App.tsx` reduced to 250 lines or fewer | Passed: 27 lines |
| App delegates UI surfaces to shell/panel subcomponents | Passed |
| Existing viewer app build succeeds | Passed |

## Validation

```bash
npm run build --prefix viewer/app
wc -l viewer/app/src/App.tsx
npm run dev --prefix viewer/app -- --host 127.0.0.1 --port 5174
```

Browser smoke: opened `http://127.0.0.1:5174/`, page title is
`ContextBuilder`, the main Sidebar rendered, and captured console errors were
`0`.

Result: build passed with the existing Vite chunk-size warning; `App.tsx` is 27 lines.
