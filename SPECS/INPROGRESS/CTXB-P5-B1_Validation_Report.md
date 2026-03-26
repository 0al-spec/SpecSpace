# CTXB-P5-B1 Validation Report

**Task:** Compile fails with "Hyperprompt not found" for branch compilation on arm64 build layout
**Date:** 2026-03-26
**Verdict:** PASS

## Quality Gates

| Gate | Result |
|------|--------|
| Tests (`make test`) | PASS |
| Lint (`make lint`) | PASS |

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Compile succeeds without manual path edits when Hyperprompt exists at `.build/arm64-apple-macosx/release/hyperprompt` | ✅ Added default-path fallback discovery that resolves architecture-specific build outputs, including arm64 layout |
| UI/API no longer fails with generic missing path when arm64 layout exists | ✅ `invoke_hyperprompt` now resolves fallback binary candidates before failing |
| `POST /api/compile` returns actionable diagnostics when binary candidates are missing | ✅ Missing-binary response now includes `checked_paths` and the requested binary path |
| Explicit override path behavior remains intact | ✅ Added regression test ensuring explicit non-default path does not silently fallback |

## Test Evidence

- Added regression tests in `tests/test_compile.py`:
  - `test_default_binary_falls_back_to_arm64_release_layout`
  - `test_missing_default_binary_reports_checked_fallback_candidates`
  - `test_explicit_binary_override_does_not_use_default_fallbacks`
- Full suite: `Ran 191 tests` — `OK`.

## Changes Made

- `viewer/server.py`
  - Added `resolve_hyperprompt_binary` fallback strategy for default Hyperprompt path.
  - Added deterministic fallback candidates for arm64/x86_64 and `deps/hyperprompt`.
  - Extended missing-binary error payload with `checked_paths` and `requested_binary`.
  - Added successful-resolution metadata (`binary_path`, `binary_resolution`) to compile output.
- `tests/test_compile.py`
  - Added new unit tests for fallback resolution and diagnostics.
- `README.md`
  - Documented binary discovery order and updated compile error status/triage to `422`.
