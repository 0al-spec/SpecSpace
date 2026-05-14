# Validation Report - CTXB-P7-T2: Route Table Extraction

**Date:** 2026-05-14  
**Verdict:** PASS  
**Slice:** Extract declarative HTTP route table

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/routes.py` - declarative route table for GET, POST, and DELETE endpoints | Done |
| `viewer/server.py` - compact route dispatch through route specs while preserving static fallback and 404 behavior | Done |
| `tests/test_routes.py` - focused route table regression coverage | Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | GET API routes still dispatch to the same handler methods with parsed URL where needed | Verified by route tests and endpoint tests |
| AC2 | POST SpecPM build routes preserve their exact supervisor flags and artifact filenames | Verified by route tests |
| AC3 | DELETE `/api/file` still passes parsed URL to the delete handler | Verified by route tests |
| AC4 | Unknown GET paths still fall back to static file handling; unknown POST/DELETE still return 404 | Preserved in `ViewerHandler` |
| AC5 | Backend lint and full test suite pass after extraction | `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Syntax check | `python -m py_compile viewer/server.py viewer/routes.py` | Passed |
| Focused route/endpoint tests | `python -m pytest tests/test_routes.py tests/test_smoke.py tests/test_specgraph.py tests/test_specpm_artifact_reads.py tests/test_exploration_preview.py` | 87 passed |
| Python lint | `make lint` | Passed |
| Full backend tests | `python -m pytest tests/` | 508 passed |

---

## Implementation Summary

- Added `RouteSpec` and method-specific route maps in `viewer/routes.py`.
- Replaced the long `do_GET`, `do_POST`, and `do_DELETE` `if parsed.path == ...` chains with `ViewerHandler._dispatch_route()`.
- Kept all handler methods, request parsing, response payloads, static fallback, and 404 behavior in `ViewerHandler`.
- Reduced `viewer/server.py` by moving the route declarations into `viewer/routes.py`.

## Residual Work

- Continue P7-T2 with request body parsing cleanup and remaining handler-level decomposition.
