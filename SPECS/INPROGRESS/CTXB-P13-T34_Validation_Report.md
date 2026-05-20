# CTXB-P13-T34 Validation Report

Task: Add Spec Inspector Hyperprompt compile action for Spec Markdown exports

## Summary

- Added a typed GraphSpace contract/parser for
  `specspace_hyperprompt_compile` responses.
- Added a Spec Inspector compile fetcher that posts selected root/scope to
  `/api/v1/spec-markdown/compile`.
- Added a capability-aware `Compile` action beside Markdown export controls.
- Disabled compile unless `/api/v1/capabilities` reports
  `hyperprompt_compile: true`.
- Successful compile responses show exit code, artifact paths, compiled
  Markdown preview, copy, and download controls.

## Acceptance Checks

| Check | Result |
| --- | --- |
| Compile response parser validates success payload shape | PASS |
| Compile response parser rejects root/scope mismatches | PASS |
| Compile fetcher posts root/scope to `/api/v1/spec-markdown/compile` | PASS |
| Backend diagnostic failures remain structured HTTP errors | PASS |
| Spec Inspector compile action is capability-disabled locally when scratch is not configured | PASS |
| Desktop browser smoke shows Markdown export controls and disabled compile diagnostic | PASS |
| Mobile browser smoke keeps Inspector header separate from scroll content and wraps controls without overlap | PASS |

## Commands

```bash
npm test --prefix graphspace -- spec-markdown
# 4 files / 20 tests passed

npm test --prefix graphspace
# 51 files / 273 tests passed

npm run build --prefix graphspace
# passed; Vite chunk-size warning remains

npm run lint:fsd --prefix graphspace
# passed

git diff --check
# passed
```

## Browser Smoke

- Desktop `1440x1000`, `http://127.0.0.1:5173/`: opened Sidebar,
  selected `SG-SPEC-0001`, verified Spec Inspector shows `Compile` disabled
  with the scratch workspace diagnostic.
- Mobile `390x844`: verified Inspector header and `Close` button stay above
  the scroll body, and Markdown export controls wrap without overlapping.

Known local console noise during smoke:

- `GET /api/v1/specpm/registry` returned local `503` because local registry
  source is not configured in this dev server.
- `GET /favicon.ico` returned `404`.
