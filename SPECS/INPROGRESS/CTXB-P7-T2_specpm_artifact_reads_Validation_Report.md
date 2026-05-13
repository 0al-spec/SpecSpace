# Validation Report - CTXB-P7-T2: SpecPM Artifact Read Helpers Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract SpecPM artifact GET/read envelopes

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/specpm.py` - SpecPM preview and artifact read-response helpers | Done |
| `viewer/server.py` - SpecPM GET handlers delegate artifact envelopes to `viewer.specpm` | Done |
| `tests/test_specpm_artifact_reads.py` - focused coverage for preview/artifact read envelopes | Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | SpecPM preview GET still returns the existing 404 build hint when the artifact is missing | Verified by focused tests |
| AC2 | SpecPM preview GET still returns `{preview_path, mtime, mtime_iso, preview}` when available | Verified by focused tests |
| AC3 | Generic SpecPM artifact GET still returns 404 with path, 422 for unreadable JSON, and the standard envelope on success | Verified by focused tests |
| AC4 | Server route-level configuration errors remain in `ViewerHandler` | Preserved in handler wrappers |
| AC5 | Backend lint and full test suite pass after extraction | `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Syntax check | `python -m py_compile viewer/server.py viewer/specpm.py viewer/supervisor_build.py` | Passed |
| Focused SpecPM tests | `python -m pytest tests/test_specpm_artifact_reads.py tests/test_specpm_lifecycle.py tests/test_supervisor_build.py` | 11 passed |
| Broader SpecPM/exploration tests | `python -m pytest tests/test_specpm_artifact_reads.py tests/test_specpm_lifecycle.py tests/test_supervisor_build.py tests/test_exploration_surfaces.py tests/test_exploration_preview.py` | 37 passed |
| Python lint | `make lint` | Passed |
| Full backend tests | `python -m pytest tests/` | 498 passed |

---

## Implementation Summary

- Added `read_specpm_preview_response()` and `read_specpm_artifact_response()` to `viewer/specpm.py`.
- Moved SpecPM preview/artifact JSON loading, missing-artifact payloads, and mtime envelopes out of `viewer/server.py`.
- Reused the SpecPM path helpers from `viewer/specpm.py` inside `viewer/supervisor_build.py`, avoiding duplicate runs-path construction.
- Kept HTTP routing and configured/unconfigured service errors in `ViewerHandler`.
- Reduced `viewer/server.py` from 1400 lines to 1340 lines in this slice.

## Residual Work

- Continue P7-T2 with the remaining low-risk route wrappers before considering larger routing-table decomposition.
