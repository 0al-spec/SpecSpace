# CTXB-P7-T2 Static/Reveal API Validation Report

## Scope

Extract the static asset fallback and local file reveal HTTP handlers from
`viewer/server.py` into `viewer/static_api.py`.

## Acceptance

| Check | Result |
| --- | --- |
| `viewer/server.py` keeps route-compatible `handle_static` and `handle_reveal` methods | Passed |
| Static SPA fallback behavior remains unchanged | Passed |
| `/api/reveal` invalid-body behavior remains unchanged | Passed |
| Static path containment uses path-aware checks instead of string prefix matching | Passed |
| `/api/reveal` returns a clear non-macOS unsupported response without raw exception text | Passed |
| `viewer/server.py` is reduced from 590 to 540 lines in this slice | Passed |

## Validation

```bash
python -m py_compile viewer/server.py viewer/static_api.py
python -m pytest tests/test_static_api.py
python -m pytest tests/test_api_contracts.py::FileApiHttpTests::test_http_handler_rejects_invalid_json_body_and_unknown_routes tests/test_routes.py
```

Result: passed.
