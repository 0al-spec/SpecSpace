## REVIEW REPORT — Re-index External File Changes (CTXB-P3-T5)

**Scope:** main..HEAD (feature/CTXB-P3-T5-reindex-external-changes)
**Files:** 4 changed (Sidebar.tsx, App.tsx, test_reindex.py, removed unused import)

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues
None.

### Secondary Issues

**[Low] Two independent fetches on refresh may briefly show inconsistent state**
- `fetchFiles()` and `onRefresh()` (graph fetch) fire independently with no coordination.
- In practice the sidebar file list and graph canvas are independent UI regions, so a brief ordering difference is not user-visible.
- Not actionable now; would require a combined API endpoint or coordinated promise resolution to fix properly.

**[Nit] Unused `HTTPStatus` import in test_reindex.py** — Fixed during review (removed).

### Architectural Notes

- The server is already stateless per-request (`collect_workspace_listing` reads disk every call), so no server changes were required. The gap was purely a missing wire in the UI prop tree.
- The existing stale-selection guard in `App.tsx` (clears `selectedConversationId` when the conversation disappears from the new graph data) handles the "deleted file + open inspector" case correctly without any extra code.
- `onRefresh` is optional (`() => void | undefined`) so `Sidebar` remains usable standalone without a graph context.

### Tests

- 7 new integration tests in `tests/test_reindex.py` exercising `collect_workspace_listing` and `collect_graph_api` with simulated file additions, deletions, and modifications.
- No UI-level tests (Playwright/jsdom not configured for this project).
- All 200 tests pass post-change.

### Next Steps

- No actionable follow-up items from this review.
- FOLLOW-UP step is skipped.
