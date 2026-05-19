# CTXB-P13-T30 Validation Report

Task: Add SpecSpace v1 Spec Markdown export endpoint
Date: 2026-05-19
Result: PASS

## Scope

- Added `GET /api/v1/spec-markdown` for readonly SpecGraph Markdown export.
- Routed export through the SpecSpace provider boundary so both file and
  HTTP/static artifact providers can serve the endpoint.
- Added `spec_markdown_export` capability reporting.
- Documented the v1 endpoint contract and selected `CTXB-P13-T31` as the next
  UI task.

## Checks

| Check | Result |
| --- | --- |
| File provider export returns Markdown, manifest, source, and filename | PASS |
| HTTP/static provider export returns Markdown from manifest-listed spec nodes | PASS |
| Invalid query options return structured `400` | PASS |
| Unknown root spec ids return `404` | PASS |
| Malformed provider data that prevents export returns structured `422` | PASS |
| Id-less provider node mappings return structured `422` instead of root-missing `404` | PASS |
| Capability payload includes `spec_markdown_export` | PASS |

## Validation Commands

```bash
python -m pytest tests/test_capabilities_api.py tests/test_specspace_api_v1.py -q
python -m py_compile viewer/capabilities_api.py viewer/specspace_provider.py viewer/specspace_v1_api.py viewer/routes.py viewer/server.py
make lint
python -m mypy viewer/
python -m pytest tests/ -q
git diff --check
```

## Results

- Focused backend tests: `37 passed`.
- `py_compile`: passed.
- `make lint`: passed.
- `python -m mypy viewer/`: passed.
- Full backend tests: `580 passed, 41 subtests passed`.
- `git diff --check`: passed.
