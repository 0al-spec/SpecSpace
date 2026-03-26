## REVIEW REPORT — CTXB-P1-T6 compile-target root metadata fix

**Scope:** main..HEAD
**Files:** 3 (viewer/server.py, tests/test_selection.py, README.md)

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues

None.

### Secondary Issues

- [Low] The acceptance criteria mentioned "README contract clarification" as an output
  artifact. The README table entry was updated, but the prose narrative above the table
  (if any) and the `schema.py` type comment for `root_conversation_ids` still say
  "sorted" without noting the empty-on-incomplete-lineage behaviour. This is cosmetic
  — the fix is correct and the key consumer-facing documentation (README table) is
  updated.

### Architectural Notes

- The fix is minimal and correct: the only path where `path[0]` could be a non-root
  is when `build_lineage_paths` terminates at a node that has unresolved `parent_edge_ids`.
  The predicate `not nodes_by_conversation[conv_id]["parent_edge_ids"]` is the canonical
  definition of a true root in this graph model (mirrors the existing `roots` derivation
  at line 318).
- The existing `is_lineage_complete` and `unresolved_parent_edge_ids` fields give
  consumers all the context they need to distinguish partial from complete ancestry;
  the fix makes `root_conversation_ids` consistent with those semantics.

### Tests

- 6 new regression tests added in `CompileTargetBrokenLineageTests`:
  - 3 covering missing-parent-conversation (empty root ids, incomplete flag, unresolved edge ids)
  - 2 covering missing-parent-message (empty root ids, incomplete flag)
  - 1 covering happy path (complete lineage still yields correct root ids)
- All 206 tests pass. No existing tests were broken.
- Coverage of the affected 4-line change is direct; no coverage gap identified.

### Next Steps

- No blocking follow-up items.
- Optional (Low): update the `schema.py` TypedDict comment for `root_conversation_ids`
  to note the empty-when-incomplete semantics for internal documentation consistency.
