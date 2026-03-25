## REVIEW REPORT — branch_merge_compile_target_tests

**Scope:** main..HEAD (feature/CTXB-P5-T2-branch-merge-compile-tests)
**Files:** 1 new (tests/test_selection.py) + 4 SPECS updates

### Summary Verdict
- [x] Approve with comments
- [ ] Approve
- [ ] Request changes
- [ ] Block

### Critical Issues

None.

### Secondary Issues

- [Low] `CompileTargetKindTests`, `CompileTargetLineageFieldsTests`, and `CompileTargetCheckpointScopeTests` use `setUpClass` to share a single temporary directory across tests in the class. If any test mutates the workspace (e.g. writes a new file), subsequent tests see the mutated state. Current tests are read-only so this is fine, but a future test that writes files should use its own `tempfile.TemporaryDirectory` instead. The pattern is good for performance, just needs a comment.

- [Nit] `CompileTargetDeterminismTests.test_different_conversations_produce_different_export_dirs` only tests root vs branch. Adding merge to the comparison would give slightly stronger coverage but is not needed to satisfy the AC.

### Architectural Notes

- `test_selection.py` targets `server.collect_conversation_api` and `server.collect_checkpoint_api` directly, bypassing HTTP. This keeps tests fast and isolates the compile-target computation from transport concerns.
- The `BranchMergeWriteValidationTests` correctly populate the workspace with parent conversations before calling `validate_write_request` — this mirrors the actual runtime contract where workspace context determines validity.
- Tests validate that `lineage_conversation_ids` is ordered oldest-first (root before child), not just that it contains the right elements. This is a meaningful regression guard for the DFS-based traversal in `build_compile_target`.

### Tests

- Total: 154 tests (up from 131), 0 failures.
- `make lint` passes cleanly.
- 23 new tests in `test_selection.py` covering: target_kind, root_conversation_ids, merge_parent_conversation_ids, lineage ordering, checkpoint fields, determinism, and write validation.

### Next Steps

- No blocking follow-ups required.
- CTXB-P5-T3 (P0) is the natural next task.
