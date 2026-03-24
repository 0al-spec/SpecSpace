## REVIEW REPORT — expand_empty_merge_edges

**Scope:** main..HEAD (CTXB-P3-B1)
**Files:** 1 source file changed (`viewer/app/src/useGraphData.ts`), 5 total files touched

### Summary Verdict
- [x] Approve
- [ ] Approve with comments
- [ ] Request changes
- [ ] Block

---

### Critical Issues

None.

---

### Secondary Issues

None.

---

### Architectural Notes

- The `effectivelyExpanded` set is a clean abstraction that localises the "expanded + has content" invariant in one place. All three downstream consumers (node rendering guard, `msgToNodeId` lookup, edge routing) now share the same definition of "expanded" without duplication.
- The fix is strictly additive — no existing behaviour is removed, only the edge-routing and icon state are corrected for the empty-checkpoint case.
- The `isExpanded` fix in the `else` branch is a secondary correctness improvement: even when no visual expansion occurs (no checkpoints), the button now reflects the true toggle state, preventing user confusion.

---

### Tests

- 54/54 existing tests pass. No new Python tests are needed — this bug is a pure front-end React state/rendering issue with no server-side surface.
- Manual test path: create an empty merge via `MergeDialog`, click expand on the merge node, verify edges remain visible; click collapse, verify edges remain visible.

---

### Next Steps

- No FOLLOW-UP tasks required — fix is complete and clean.
