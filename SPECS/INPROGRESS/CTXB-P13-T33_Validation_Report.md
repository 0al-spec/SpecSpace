# CTXB-P13-T33 Validation Report

Task: Add local Hyperprompt compile endpoint for Spec Markdown exports

## Summary

- Added `POST /api/v1/spec-markdown/compile` as a local file provider-only
  compile action.
- Compiles only SpecSpace-generated Spec Markdown export bundles under the
  configured Hyperprompt scratch workspace.
- Keeps HTTP/static artifact deployments compile-disabled with the same
  actionable capability diagnostics exposed by `/api/v1/capabilities`.
- Returns compiled Markdown, compiler manifest, bundle paths, export manifest,
  stdout/stderr, and exit code in a structured response.

## Acceptance Checks

| Check | Result |
| --- | --- |
| Endpoint rejects missing/invalid request options | PASS |
| Endpoint returns capability diagnostic when Hyperprompt compile is disabled | PASS |
| HTTP/static provider remains unsupported even with local binary settings | PASS |
| Local file provider writes bundle only under scratch workspace | PASS |
| Successful compiler invocation returns compiled Markdown and manifest | PASS |
| Compiler non-zero exit returns structured `422` with stderr/stdout | PASS |
| SpecGraph inputs remain readonly | PASS |

## Commands

```bash
python -m pytest tests/test_specspace_api_v1.py tests/test_capabilities_api.py tests/test_routes.py -q
# 55 passed

python -m mypy viewer/
# Success: no issues found in 33 source files

python -m py_compile viewer/specspace_hyperprompt.py viewer/specspace_provider.py viewer/specspace_v1_api.py viewer/routes.py viewer/server.py
# passed

git diff --check
# passed

make lint
# passed
```

```bash
python -m pytest tests/ -q
# 595 passed, 41 subtests passed
```
