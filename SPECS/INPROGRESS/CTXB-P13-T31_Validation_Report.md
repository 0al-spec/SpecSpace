# CTXB-P13-T31 Validation Report

Task: Add Spec Markdown export action to Spec Inspector
Date: 2026-05-19
Result: PASS

## Scope

- Added a typed `/api/v1/spec-markdown` frontend contract parser.
- Added a Spec Inspector fetch helper for readonly Markdown export.
- Added a Spec Inspector `Markdown export` section with export, copy, download,
  preview, and manifest diagnostics.
- Advanced the plan to `CTXB-P13-T32`.

## Checks

| Check | Result |
| --- | --- |
| Inspector uses `/api/v1/spec-markdown` and not legacy compile routes | PASS |
| Export action can load and preview Markdown | PASS |
| Copy and download actions are available only after successful export | PASS |
| Manifest diagnostics show node count, depth, cycles, and missing refs | PASS |
| Desktop and mobile smoke covered export panel visibility/interaction | PASS |

## Validation Commands

```bash
npm test --prefix graphspace -- spec-markdown-export load-spec-markdown-export
# 2 files / 8 tests passed

npm test --prefix graphspace
# 47 files / 247 tests passed

npm run build --prefix graphspace
# passed; existing Vite chunk-size warning remains

npm run lint:fsd --prefix graphspace
# passed; no FSD problems found
```

## Browser Smoke

Local service:

```bash
make specspace-restart
```

- Desktop `1440x900`: selected `SG-SPEC-0001`, ran `Markdown export`,
  preview rendered `65 nodes / depth 10`, Copy and Download became enabled,
  and no export-flow console errors were emitted.
- Mobile `390x844`: selected `SG-SPEC-0001`, ran `Markdown export`,
  preview rendered, Copy and Download became enabled, and the Markdown preview
  scrolled independently.
- Non-blocking local environment note: page load still reports the known
  `/api/v1/specpm/registry` 503 when the local SpecPM registry provider is not
  configured; no new non-OK responses were emitted by the export action.
