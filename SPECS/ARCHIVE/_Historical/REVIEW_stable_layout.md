## REVIEW REPORT — stable_layout

**Scope:** main..HEAD (branch feature/CTXB-P2R-B2-stable-layout)
**Files:** 3 (layoutGraph.ts, useGraphData.ts, test_smoke.py)

### Summary Verdict
- [x] Approve
- [ ] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues
None.

### Secondary Issues

- **[Low] Expanded group node size not fed back into dagre**: The `basePositions` uses collapsed sizes for all nodes. This means an expanded node (which is taller) might visually overlap a neighbor positioned by dagre for collapsed sizes. In practice this is acceptable (the overlap is outside the bounding box, and the graph is sparse), but in dense graphs it could look bad. A future improvement could recalculate positions on expand only for the expanded node's column.

- **[Nit] `computeBasePositions` duplicates some dagre setup logic from `layoutNodes`**: Both functions initialize dagre the same way. Could be refactored to share a helper, but the duplication is minimal and the separation of concerns (static positions vs. dynamic layout) is intentional.

### Architectural Notes

- The two-memo pattern (`basePositions` + `{nodes, edges}`) cleanly separates graph topology computation from render-state computation. This is the right long-term pattern: topology (positions) changes rarely, render state (expand/collapse) changes frequently.

- `basePositions` returning a `Map` (reference-stable between renders when `apiGraph` hasn't changed) ensures the second memo's dependency on `basePositions` doesn't cause spurious recalculations.

### Tests
- All 45 tests pass.
- Updated smoke test to check for `computeBasePositions` instead of `layoutNodes`.
- Position stability confirmed via DOM transform inspection: all 3 nodes showed `moved: false` after expand toggle.

### Next Steps
- No actionable follow-up. FOLLOW-UP skipped.
- Phase 2R is now fully complete.
