# Validation Report - CTXB-P7-T2: Supervisor Build Helpers Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract supervisor.py build invocation helpers

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/supervisor_build.py` - shared supervisor path lookup, safe invocation, tail extraction, viewer surfaces build, SpecPM build, and exploration preview build helpers | Done |
| `viewer/server.py` - route-level guards now delegate build invocation payloads to `viewer.supervisor_build` | Done |
| `tests/test_supervisor_build.py` - focused regression coverage for supervisor invocation and build payloads | Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `ViewerHandler` keeps route-level 503/400 request validation for build endpoints | Verified by existing endpoint tests |
| AC2 | Supervisor invocation still uses list commands without `shell=True` | Verified by focused supervisor tests and existing exploration endpoint tests |
| AC3 | Missing supervisor, timeout, non-zero exit, stdout/stderr tail, and built artifact payloads remain structured | Verified by focused supervisor tests |
| AC4 | Exploration preview build still validates the built artifact boundary before returning success | Verified by focused and endpoint tests |
| AC5 | Backend lint and full test suite pass after extraction | `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Syntax check | `python -m py_compile viewer/server.py viewer/supervisor_build.py` | Passed |
| Focused supervisor/endpoint tests | `python -m pytest tests/test_supervisor_build.py tests/test_exploration_preview.py` | 23 passed |
| Broader SpecGraph build/read tests | `python -m pytest tests/test_supervisor_build.py tests/test_exploration_preview.py tests/test_exploration_surfaces.py tests/test_specpm_lifecycle.py tests/test_metrics_surfaces.py` | 87 passed |
| Python lint | `make lint` | Passed |
| Full backend tests | `python -m pytest tests/` | 493 passed |

---

## Implementation Summary

- Added `viewer/supervisor_build.py` as the focused home for `supervisor.py` command execution and build-response payload assembly.
- Moved viewer surfaces build, SpecPM preview/build artifact invocation, and exploration preview build artifact validation out of `viewer/server.py`.
- Reused `specgraph_surfaces.supervisor_has_flags()` for exploration build capability detection.
- Kept HTTP routing, request body parsing, and endpoint-level configuration errors in `ViewerHandler`.
- Reduced `viewer/server.py` from 1627 lines to 1400 lines in this slice.

## Residual Work

- Continue P7-T2 with smaller server-facing slices: SpecPM artifact GET/path helpers or generic JSON artifact envelopes, depending on which area has the lowest review risk next.
