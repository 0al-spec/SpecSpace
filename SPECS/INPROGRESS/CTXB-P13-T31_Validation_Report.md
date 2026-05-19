# CTXB-P13-T31 Validation Report

Task: Add Spec Markdown export action to Spec Inspector
Date: 2026-05-19
Result: PASS

## Scope

- Added a typed `/api/v1/spec-markdown` frontend contract parser.
- Added a Spec Inspector fetch helper for readonly Markdown export.
- Added a Spec Inspector `Markdown export` section with export, copy, download,
  preview, and manifest diagnostics.
- Added explicit Markdown export scope selection: selected spec only or
  refinement subtree.
- Advanced the plan to `CTXB-P13-T32`.

## Checks

| Check | Result |
| --- | --- |
| Inspector uses `/api/v1/spec-markdown` and not legacy compile routes | PASS |
| Export action can load and preview Markdown | PASS |
| Export scope can switch between selected spec only and refinement subtree | PASS |
| Copy and download actions are available only after successful export | PASS |
| Manifest diagnostics show node count, depth, cycles, and missing refs as read-only stats | PASS |
| Desktop and mobile smoke covered export panel visibility/interaction | PASS |

## Validation Commands

```bash
npm test --prefix graphspace -- spec-markdown-export load-spec-markdown-export
# 2 files / 10 tests passed

npm test --prefix graphspace
# 47 files / 249 tests passed

npm run build --prefix graphspace
# passed; existing Vite chunk-size warning remains

npm run lint:fsd --prefix graphspace
# passed; no FSD problems found

make lint
# passed

python -m pytest tests/test_specspace_api_v1.py -q
# 37 passed

python -m pytest tests/ -q
# 582 passed, 41 subtests passed
```

## Browser Smoke

Local service:

```bash
make specspace-restart
```

- Desktop `1440x900`: selected `SG-SPEC-0001`, ran `Markdown export`,
  verified `Selected spec` exported `1` node with no `SG-SPEC-0002`, switched
  to `Refinement subtree`, verified `65` nodes and child content, Copy and
  Download became enabled, manifest diagnostics rendered as a read-only stats
  grid, and no export-flow console errors were emitted.
- Mobile `390x844`: selected `SG-SPEC-0001`, ran `Markdown export`,
  verified `Selected spec` exported `1` node with no `SG-SPEC-0002`, switched
  to `Refinement subtree`, verified `65` nodes and child content, Copy and
  Download became enabled, diagnostics stacked into a `2x2` stats grid, and the
  Markdown preview scrolled independently.
- Non-blocking local environment note: page load still reports the known
  `/api/v1/specpm/registry` 503 when the local SpecPM registry provider is not
  configured; no new non-OK responses were emitted by the export action.
