## REVIEW REPORT — Preserve Dragged Positions

**Scope:** main..HEAD (5 commits)
**Files:** 1 code file changed (`viewer/app/src/App.tsx`)

### Summary Verdict
- [x] Approve

### Critical Issues
None.

### Secondary Issues
- [Low] The merge logic preserves *all* existing top-level positions, not just user-dragged ones. If dagre recomputes better positions for nodes that were never dragged, those improvements won't be applied. This is acceptable for now — the user expectation is that positions remain stable once the graph is loaded. A future enhancement could track which nodes were explicitly dragged vs. auto-positioned.

### Architectural Notes
- The fix correctly targets only top-level (parentless) nodes. Child nodes (messages, headers) always use parent-relative coordinates and are correctly passed through unchanged.
- The `prev.length === 0` guard ensures the first render still uses dagre positions.
- The approach is minimal and non-invasive — only the `useEffect` callback changed, no new state or hooks introduced.

### Tests
- 47/47 existing tests pass. No new unit tests needed — this is a UI interaction behavior best verified via manual/preview testing.
- Verified via preview snapshot that positions remain stable through expand/collapse cycles.

### Next Steps
- No actionable follow-up items. The low-severity observation about tracking explicit drag state is a potential future enhancement but not required now.
