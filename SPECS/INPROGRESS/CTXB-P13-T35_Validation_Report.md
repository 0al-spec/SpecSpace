# CTXB-P13-T35 Validation Report

## Summary

Result: PASS.

`CTXB-P13-T35` adds Spec Markdown export/compile results to the Agent Context
draft as first-class `spec_markdown` items. The implementation is frontend-only:
it does not add a backend endpoint, mutate SpecGraph artifacts, or start agent
execution.

## Local Validation

```bash
npm test --prefix graphspace -- agent-workbench
```

Result: PASS — 3 files / 13 tests passed.

```bash
npm test --prefix graphspace
```

Result: PASS — 51 files / 275 tests passed.

```bash
npm run build --prefix graphspace
```

Result: PASS. Vite emitted the existing chunk-size warning.

```bash
npm run lint:fsd --prefix graphspace
```

Result: PASS — no FSD problems found.

```bash
git diff --check
```

Result: PASS.

## Browser Smoke

Target: `http://127.0.0.1:5173/`.

Desktop viewport: `1440x1000`.

- Opened Sidebar and selected `SG-SPEC-0001`.
- Exported Markdown from Spec Inspector.
- Used `Add Context` from the Markdown export section.
- Opened Agent Context and verified one `spec_markdown` item with root spec,
  scope, node count, filename, and serialized Markdown body.
- Opened Agent Conversation and verified the Markdown context token renders.

Mobile viewport: `390x844`.

- Verified Agent Context remains inside the mobile utility panel.
- Verified utility header and content do not overlap.
- Verified the `spec_markdown` row remains visible with serialized context
  preview available below it.

Known local dev console noise: `/api/v1/specpm/registry` returns `503` in this
local setup. It is unrelated to this task.
