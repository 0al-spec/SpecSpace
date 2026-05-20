# CTXB-P13-T32 Validation Report

Task: Add optional Hyperprompt compile capability diagnostics
Date: 2026-05-20
Result: PASS

## Scope

- Added `hyperprompt_compile` as a distinct SpecSpace v1 capability from
  readonly `spec_markdown_export`.
- Added `/api/v1/capabilities` diagnostics for Markdown export and optional
  Hyperprompt compile.
- Added `--hyperprompt-work-dir` / `SPECSPACE_HYPERPROMPT_WORK_DIR` as the
  explicit scratch workspace gate for future compile support.
- Kept static/HTTP artifact deployments compile-disabled by default with an
  actionable `provider_unsupported` diagnostic.
- Surfaced capability diagnostics in the SpecSpace `Live artifacts` utility
  panel without adding a compile action.
- Documented the v1 capability contract and deployment knob.

## Checks

| Check | Result |
| --- | --- |
| `spec_markdown_export` remains true when readonly export is available | PASS |
| `hyperprompt_compile` remains false unless provider, binary, executable bit, and scratch workspace are all valid | PASS |
| HTTP/static provider reports compile unavailable without probing local runtime state | PASS |
| Missing compiler, non-executable compiler, and missing scratch workspace have actionable statuses | PASS |
| UI shows capability diagnostics without suggesting compile is available when capability is false | PASS |
| Desktop and mobile smoke covered the diagnostics panel | PASS |

## Validation Commands

```bash
python -m pytest tests/test_capabilities_api.py tests/test_server_runtime.py tests/test_specspace_api_v1.py -q
# 53 passed

npm test --prefix graphspace -- capability-diagnostics
# 1 file / 3 tests passed

npm run build --prefix graphspace
# passed; existing Vite chunk-size warning remains

npm run lint:fsd --prefix graphspace
# passed; no FSD problems found

python -m mypy viewer/
# passed

make lint
# passed

npm test --prefix graphspace
# 49 files / 264 tests passed

python -m pytest tests/ -q
# 588 passed, 41 subtests passed
```

## Browser Smoke

Local service:

```bash
python viewer/server.py \
  --host 127.0.0.1 \
  --port 8001 \
  --dialog-dir /tmp/specspace-dialogs \
  --artifact-base-url https://specgraph.tech \
  --specpm-registry-url https://specpm.dev

npm run dev --prefix graphspace -- --host 127.0.0.1 --port 5175
```

- Desktop `1440x900`: opened Sidebar → Live artifacts, verified
  `Capabilities`, `Markdown export`, and `Hyperprompt compile` rows. Markdown
  export showed `available` / `readonly`; Hyperprompt compile showed
  `PROVIDER_UNSUPPORTED` / `disabled`.
- Mobile `390x844`: repeated the same flow and verified panel header/content
  did not overlap.
- Console note: the only console error was `404 /favicon.ico` from the local
  dev server.
