# Validation Report — CTXB-P7-T2: SpecPM Read-Model Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract SpecPM / exploration read models

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/specpm.py` — SpecPM lifecycle, proposal markdown, exploration surface, and run artifact helper functions | ✅ Done |
| `viewer/server.py` — imports moved helper names as a compatibility facade for existing call sites | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `viewer.server` remains import-compatible for existing tests | ✅ Verified by focused and full backend tests |
| AC2 | Moved SpecPM lifecycle behavior remains unchanged | ✅ `tests/test_specpm_lifecycle.py` passed |
| AC3 | Moved exploration surface behavior remains unchanged | ✅ `tests/test_exploration_surfaces.py` and `tests/test_exploration_preview.py` passed |
| AC4 | Backend lint and full test suite pass after extraction | ✅ `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Focused tests | `python -m pytest tests/test_specpm_lifecycle.py tests/test_exploration_surfaces.py tests/test_exploration_preview.py` | ✅ 27 passed |
| Python lint | `make lint` | ✅ Passed |
| Full backend tests | `python -m pytest tests/` | ✅ 478 passed |

---

## Implementation Summary

- Added `viewer/specpm.py` as the focused home for SpecPM lifecycle, proposal markdown, exploration surface, and SpecGraph runs artifact read-model helpers.
- Removed the moved helper implementations from `viewer/server.py`.
- Re-imported the moved private helper names in `viewer/server.py` so existing test and handler call sites keep the same module-level names while the implementation moves out.
- Reduced `viewer/server.py` from 3544 lines to 3062 lines in this slice.

## Residual Work

- Extract export helpers into `viewer/export.py`.
- Extract Hyperprompt compile helpers into `viewer/compile.py`, preserving `DEFAULT_HYPERPROMPT_BINARY` mutation compatibility.
- Extract conversation graph read-model helpers into `viewer/graph.py`.
- Move workspace-cache internals only after adding wrappers that preserve `_build_workspace_listing` monkeypatch behavior.
