# CTXB-P2R-T9 Validation Report

**Task:** Remove legacy viewer and update tests
**Date:** 2026-03-23
**Verdict:** PASS

## Quality Gates

| Gate | Result |
|------|--------|
| Tests (pytest) | ✅ 45/45 pass (21 subtests) |
| TypeScript (tsc -b) | ✅ Clean |
| Build (vite build) | ✅ 498 modules, 483KB JS |

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | The legacy `index.html` is removed | ✅ |
| 2 | `npm run build` produces a working production bundle | ✅ |
| 3 | The Python server serves the built viewer | ✅ |
| 4 | All smoke tests pass against the new viewer | ✅ |

## Implementation Summary

- Deleted `viewer/index.html` (2747-line legacy single-file viewer)
- Updated `viewer/server.py` `handle_static` to serve from `viewer/app/dist/`:
  - Root `/` serves dist `index.html`
  - Static assets served from dist directory
  - File-extension paths that don't exist return 404
  - Non-file paths fall back to SPA `index.html`
- Rewrote `tests/test_smoke.py` (11 tests) to validate React source files and components
- Fixed `tests/test_api_contracts.py` to match new static serving behavior

## Files Changed

- `viewer/index.html` (deleted)
- `viewer/server.py` (modified)
- `tests/test_smoke.py` (rewritten)
- `tests/test_api_contracts.py` (modified)
