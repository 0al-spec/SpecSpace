# CTXB-P2R-T9 — Remove legacy viewer and update tests

## Objective Summary

Delete the legacy single-file `viewer/index.html` (2747 lines). Update the Python server to serve the Vite build output from `viewer/app/dist/`. Update smoke tests to validate the React-based viewer build output instead of legacy HTML patterns.

## Technical Approach

1. **Remove legacy viewer:** `git rm viewer/index.html`
2. **Update server static handling:**
   - Change `handle_static` default from `viewer/index.html` to serve from `viewer/app/dist/`
   - Root path `/` serves `viewer/app/dist/index.html`
   - Other paths check `viewer/app/dist/` first, then fall back to repo root
   - Update the startup print message
3. **Update smoke tests:**
   - Replace `test_viewer_assets_exist` to check for `viewer/app/dist/index.html` or `viewer/app/src/App.tsx`
   - Replace all legacy HTML content tests with React source file checks
   - Keep `test_server_module_loads` unchanged
4. **Verify build:** Ensure `npm run build` produces output in `viewer/app/dist/`

## Acceptance Criteria

1. The legacy `index.html` is removed.
2. `npm run build` produces a working production bundle.
3. The Python server serves the built viewer.
4. All smoke tests pass against the new viewer.

## Files to Modify

- `viewer/index.html` (delete)
- `viewer/server.py` (update static file serving)
- `tests/test_smoke.py` (rewrite for React viewer)
