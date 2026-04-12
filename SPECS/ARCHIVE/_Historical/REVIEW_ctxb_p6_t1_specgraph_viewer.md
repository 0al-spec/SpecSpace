## REVIEW REPORT — CTXB-P6-T1 SpecGraph Specification Viewer

**Scope:** main..feature/CTXB-P6-T1-specgraph-viewer  
**Files changed:** 13 (8 source, 5 spec/docs)  
**Lines:** +613 / -47

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

No blockers. Three low-severity observations and a few nits. Safe to merge.

---

### Critical Issues

None.

---

### Secondary Issues

**[Low] Expand button shows "▾" before detail loads, with no group appearing**

When `onToggleExpand` is called, `expandedSpecIds` is updated synchronously (button shows `▾`) but the group only renders after the `/api/spec-node` fetch completes. There is no loading indicator, so the button appears to be in "collapsed" state when it's actually "loading". Acceptable for P2, but worth addressing before promoting to P1.

Fix suggestion: add a `loadingSpecIds: Set<string>` state, mark the node as loading during the async fetch, and show a spinner or `↻` on the button.

**[Low] `extractSubItems` not exported or unit-tested**

The function handles complex YAML shapes (string vs. object decisions, evidence matching) but is untested. If SpecGraph YAML schemas evolve, regressions could be silent.

Fix suggestion: export the function and add `tests/test_specgraph_ui_helpers.py` or a TypeScript test in `viewer/app/src/__tests__/`.

**[Low] `searchDimmed` not applied to sub-item nodes**

When the search palette filters specs, `SpecSubItemNode` doesn't receive `searchDimmed` styling. Sub-items inside a dimmed spec's group will remain fully visible, which is visually inconsistent.

Fix suggestion: In `displayNodes` (App.tsx), when a sub-item's `parentId` is in the search-dim set, propagate `searchDimmed` to the sub-item data and add the CSS class in `SpecSubItemNode`.

---

### Architectural Notes

- **Edge routing without re-mapping is elegant.** Preserving the same handle IDs (`tgt-{kind}`, `src-{kind}`) on `ExpandedSpecNode` means zero edge-update logic needed when expanding/collapsing. This is a better design than the conversation group which required special-casing in edge building.

- **`specDetailsRef` + `specDetails` dual state pattern is correct.** `useRef` prevents stale closures in the async callback, while `useState` triggers React re-renders. This is the standard React pattern for async caching. No concerns.

- **Module-level `extractSubItems` outside the hook improves testability** — the function is pure and has no hook dependencies. Good separation.

- **`EXP_GROUP_W = 268`** is 48px wider than `SPEC_NODE_WIDTH = 220`. The wider group ensures handle overlap with the border doesn't clip content. Reasonable, but undocumented. A comment explaining the choice would help future readers.

---

### Tests

- 243 existing tests pass — no regressions.
- `tests/test_specgraph.py` (40 tests) covers the Python backend changes from the full Phase 6 implementation.
- T8 (`ExpandedSpecNode`) has no automated tests (TypeScript components). This is acceptable for a P2 UI feature with no new API surface, but the `extractSubItems` helper would benefit from unit coverage.

---

### Next Steps

- No actionable findings require immediate FOLLOW-UP tasks.
- FOLLOW-UP is skipped per FLOW: no blockers or high-severity issues.
- Optional future improvements logged as architectural notes above.
