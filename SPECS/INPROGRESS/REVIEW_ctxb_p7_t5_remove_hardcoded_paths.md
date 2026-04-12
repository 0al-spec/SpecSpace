# Review — CTXB-P7-T5: Remove Hardcoded Developer Paths

**Reviewer:** Claude (automated code review)  
**Date:** 2026-04-12  
**Verdict:** PASS — no actionable findings

---

## Summary

Three classes of developer-specific hardcoded paths were removed:
- `DEFAULT_HYPERPROMPT_BINARY` in `server.py` now resolves to `REPO_ROOT / "deps" / "hyperprompt"`.
- `CANONICAL_DIR` and `SPEC_DIR` in `Makefile` now default to empty (must be supplied by the user).
- `quickstart` Make target now requires `DIALOG_DIR` instead of embedding a hardcoded path.

---

## Code Review

### `viewer/server.py`

**Strengths:**
- Using `REPO_ROOT / "deps" / "hyperprompt"` ties the default to the project's own `deps/` convention — portable across all checkouts.
- `_default_hyperprompt_fallbacks` is simplified: explicit hardcoded arch names (`fallback_arm64`, `fallback_x86_64`) replaced with a glob, removing the architecture assumption while preserving Swift multi-arch build support.
- The glob-based fallback is strictly better: it discovers any arch directory that actually exists rather than always adding two fixed paths regardless of existence.

**Minor observations (non-blocking):**
- `_default_hyperprompt_fallbacks` still computes `build_dir = default_binary.parent.parent`. With the new default (`REPO_ROOT/deps/hyperprompt`), `build_dir` becomes `REPO_ROOT`. The glob `REPO_ROOT / "*/release/hyperprompt"` will return empty in a normal checkout, making the fallback a no-op for the default case. This is correct behaviour — the `deps/hyperprompt` path is already tried first as the "configured" candidate.

### `Makefile`

**Strengths:**
- `CANONICAL_DIR ?=` and `SPEC_DIR ?=` now require explicit user input — no silent default to a path that won't exist on other machines.
- `quickstart` now errors clearly with an example command if `DIALOG_DIR` is missing.
- All existing Make targets that use `CANONICAL_DIR` will still work when the variable is provided; the only behaviour change is the absence of a wrong default.

**Minor observations (non-blocking):**
- `help` output still mentions `make quickstart` without noting that `DIALOG_DIR` is now required. Could be updated for clarity, but not blocking since `quickstart` itself errors with a clear message.

### `tests/test_compile.py`

**Strengths:**
- Updated `test_missing_default_binary_reports_checked_fallback_candidates` correctly removes the now-invalid expectation that `arm64-apple-macosx/release/hyperprompt` appears in `checked_paths` without the directory existing.
- The remaining assertion (`assertIn(str(default_binary), ...)`) is the meaningful one: the configured path must always be reported.

---

## Quality Gates

| Gate | Result |
|------|--------|
| `python -m pytest tests/` | ✅ 261 passed |
| `make lint` | ✅ Clean |
| Hardcoded path audit | ✅ No `/Users/egor` or `$(HOME)/Development/...` in `server.py` or `Makefile` |

---

## Acceptance Criteria

| AC | Verdict |
|----|---------|
| AC1: `DEFAULT_HYPERPROMPT_BINARY` has no user-specific path | ✅ PASS |
| AC2: `CANONICAL_DIR` / `SPEC_DIR` have no `$(HOME)/Development/...` defaults | ✅ PASS |
| AC3: `quickstart` has no hardcoded user path | ✅ PASS |
| AC4: `deps/hyperprompt` still tried as fallback | ✅ PASS |
| AC5: All tests pass | ✅ PASS |
| AC6: `make lint` passes | ✅ PASS |

---

## Actionable Findings

None.
