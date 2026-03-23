## REVIEW REPORT — Layout Reflow (CTXB-P2-T14)

**Scope:** main..HEAD (branch `feature/CTXB-P2-T13-T15-message-subgraph`)
**Files:** 1 (viewer/index.html)

### Summary Verdict
- [x] Approve

### Critical Issues
None.

### Secondary Issues
- [Low] The test dataset has one node per column, so vertical reflow wasn't visually exercised with overlapping siblings. Logic is correct by inspection — the `yOffset` accumulator properly accounts for per-node height.

### Architectural Notes
- Constants and `expandedNodeHeight` moved from `renderGraph` inner scope to top-level script scope. This is a clean separation — layout computation no longer duplicates knowledge about expanded node dimensions.
- `nodeEffectiveHeight(node)` centralizes the expanded-vs-collapsed height decision for layout, edge anchoring, and pan centering.

### Tests
- 11 smoke tests pass.

### Verdict: APPROVE
