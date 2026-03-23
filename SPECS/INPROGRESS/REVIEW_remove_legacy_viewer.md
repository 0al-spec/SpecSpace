## REVIEW REPORT — Remove Legacy Viewer (CTXB-P2R-T9)

**Scope:** main..HEAD
**Files:** 7

### Summary Verdict
- [x] Approve

### Critical Issues
None.

### Secondary Issues
- [Low] The SPA fallback in `handle_static` returns `index.html` for non-file paths without extensions. This is correct for SPA routing but means any non-API, extensionless path returns 200 with the app shell. Acceptable for a local dev tool.

### Architectural Notes
- The 2747-line legacy `viewer/index.html` has been fully replaced by a React + Vite app (~15 source files).
- The server now serves from `viewer/app/dist/` which requires `npm run build` before running in production mode. During development, Vite's dev server with proxy is used instead.
- Smoke tests now validate React source file presence and component structure rather than legacy HTML patterns.
- The `test_api_contracts.py` fix properly checks the Vite-generated `<!DOCTYPE html>` casing.

### Tests
- 45 tests pass (including 21 subtests).
- TypeScript compiles clean.
- Build succeeds (498 modules, 483KB JS).

### Next Steps
- Phase 2R is now complete. All 9 tasks (T1–T9) are archived with PASS.
- Next phases: P1-T6 (compile-target metadata) or P3 (authoring and compile target selection).
- FOLLOW-UP: skipped — no actionable issues.
