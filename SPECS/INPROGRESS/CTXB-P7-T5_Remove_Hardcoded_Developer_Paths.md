# PRD — CTXB-P7-T5: Remove Hardcoded Developer Paths

**Status:** INPROGRESS  
**Phase:** 7 — Technical Debt and Quality  
**Priority:** P1  
**Branch:** feature/CTXB-P7-T5-remove-hardcoded-paths  
**Date:** 2026-04-12

---

## Problem

Three places embed absolute user-specific paths that prevent the project from being
cloned and used by anyone other than the original developer:

| Location | Hardcoded value |
|----------|----------------|
| `viewer/server.py` — `DEFAULT_HYPERPROMPT_BINARY` | `/Users/egor/Development/GitHub/0AL/Hyperprompt/.build/release/hyperprompt` |
| `Makefile` — `CANONICAL_DIR` | `$(HOME)/Development/GitHub/ChatGPTDialogs/canonical_json` |
| `Makefile` — `SPEC_DIR` | `$(HOME)/Development/GitHub/0AL/SpecGraph/specs/nodes` |
| `Makefile` — `quickstart` target | `/Users/egor/Development/GitHub/ChatGPTDialogs/import_json` |

---

## Solution

### `viewer/server.py`

Replace `DEFAULT_HYPERPROMPT_BINARY` with a repo-relative path:
```python
DEFAULT_HYPERPROMPT_BINARY = str(REPO_ROOT / "deps" / "hyperprompt")
```

Simplify `_default_hyperprompt_fallbacks` to remove hardcoded arch names
(`fallback_arm64`, `fallback_x86_64`) — replace with a glob over the binary's
parent-of-parent directory (covers any Swift multi-arch build layout without
naming specific architectures). Keep `fallback_deps` as the final safety net.

Update `test_missing_default_binary_reports_checked_fallback_candidates` — the
test previously expected `arm64-apple-macosx` in `checked_paths` regardless of
whether the directory exists. With the glob-only approach, only existing paths
are enumerated. Simplify the assertion: verify that the configured path itself is
reported (not arch-specific subdirectories that don't exist in the tmpdir).

### `Makefile`

| Change | Before | After |
|--------|--------|-------|
| `CANONICAL_DIR` default | `$(HOME)/Development/GitHub/ChatGPTDialogs/canonical_json` | `$(empty)` — must be supplied |
| `SPEC_DIR` default | `$(HOME)/Development/GitHub/0AL/SpecGraph/specs/nodes` | `$(empty)` — optional |
| `quickstart` DIALOG_DIR | `/Users/egor/Development/GitHub/ChatGPTDialogs/import_json` | Require `DIALOG_DIR` to be passed, error if missing |

---

## Deliverables

| # | Artifact | Change |
|---|----------|--------|
| 1 | `viewer/server.py` | `DEFAULT_HYPERPROMPT_BINARY` → repo-relative; `_default_hyperprompt_fallbacks` uses glob |
| 2 | `Makefile` | Remove developer-specific defaults for `CANONICAL_DIR`, `SPEC_DIR`; fix `quickstart` |
| 3 | `tests/test_compile.py` | Update `test_missing_default_binary_reports_checked_fallback_candidates` |

---

## Acceptance Criteria

- AC1: `DEFAULT_HYPERPROMPT_BINARY` contains no absolute user-specific path.
- AC2: `Makefile` `CANONICAL_DIR` and `SPEC_DIR` have no `$(HOME)/Development/...` defaults.
- AC3: `quickstart` target has no hardcoded `/Users/egor/...` path.
- AC4: Binary resolution still tries `deps/hyperprompt` (via `REPO_ROOT / "deps" / "hyperprompt"`).
- AC5: All existing tests pass (or test updated to reflect new fallback behaviour).
- AC6: `make lint` passes.
