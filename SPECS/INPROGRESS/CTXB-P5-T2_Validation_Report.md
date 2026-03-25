# CTXB-P5-T2 Validation Report

**Task:** Add automated tests for branch, merge, and compile target selection workflows
**Date:** 2026-03-26
**Verdict:** PASS

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | PASS — 154 tests, 0 failures (up from 131) |
| Lint | `make lint` | PASS — 0 errors |

---

## Deliverables

### tests/test_selection.py
New test module with 23 tests covering compile-target selection fields and branch/merge write validation:

**CompileTargetKindTests (3 tests)**
- Root target kind is `canonical-root`
- Branch target kind is `canonical-branch`
- Merge target kind is `canonical-merge`

**CompileTargetLineageFieldsTests (9 tests)**
- Root has itself as `root_conversation_ids`
- Branch `root_conversation_ids` points to root
- Merge `root_conversation_ids` points to shared root
- Root has no `merge_parent_conversation_ids`
- Branch has no `merge_parent_conversation_ids`
- Merge has two `merge_parent_conversation_ids` (root and branch)
- Root `lineage_conversation_ids` contains only root
- Branch `lineage_conversation_ids` is ordered oldest-first (root before branch)
- Merge `lineage_conversation_ids` ends with merge node

**CompileTargetCheckpointScopeTests (5 tests)**
- Checkpoint scope has `target_checkpoint_index` (int)
- Checkpoint scope has `target_checkpoint_role` (non-empty string)
- `msg-root-2` (2nd message) has index 1 and role `assistant`
- `msg-root-1` (1st message) has index 0 and role `user`
- Conversation scope does NOT have checkpoint fields

**CompileTargetDeterminismTests (3 tests)**
- `export_dir` is identical on repeated conversation-scope calls
- `export_dir` is identical on repeated checkpoint-scope calls
- Different conversations produce different `export_dir` values

**BranchMergeWriteValidationTests (3 tests)**
- Canonical branch payload (with parent in workspace) is accepted by `validate_write_request`
- Canonical merge payload (with both parents in workspace) is accepted
- Branch payload with `merge` link type is rejected with `invalid_branch_lineage`

---

## Acceptance Criteria

- [x] Branch and merge authoring workflows protected (existing + 3 new write-validation tests)
- [x] Compile target selection for root, branch, merge, and checkpoint scopes regression-tested
- [x] `target_kind`, `root_conversation_ids`, `merge_parent_conversation_ids` fields verified
- [x] `lineage_conversation_ids` ordering (oldest-first) asserted
- [x] Checkpoint `target_checkpoint_index` and `target_checkpoint_role` verified
- [x] 154 tests pass `make test`, `make lint` clean
