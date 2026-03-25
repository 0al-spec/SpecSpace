# CTXB-P5-T2 — Add automated tests for branch, merge, and compile target selection workflows

**Status:** In Progress
**Priority:** P0
**Phase:** Phase 5 — Hardening, Tests, and Documentation

---

## Context

`test_api_contracts.py` already covers the core create/reject paths for branch and merge authoring (e.g. `BranchCreationApiTests`, `MergeCreationApiTests`). This task fills the remaining compile-target selection gaps: determinism, merge-scope target metadata, `target_kind`, `root_conversation_ids`, `merge_parent_conversation_ids`, `lineage_conversation_ids` ordering, and checkpoint-scope index/role fields.

---

## Deliverables

1. **`tests/test_selection.py`** — New test module covering compile-target selection and branch/merge write-validation paths.
   - `compile_target` `target_kind` field for root, branch, merge conversations
   - `compile_target` `root_conversation_ids` content for branch and merge
   - `compile_target` `merge_parent_conversation_ids` for merge
   - `compile_target` `lineage_conversation_ids` ordering (oldest-first)
   - `compile_target` for merge conversation scope (full payload)
   - `compile_target` `target_checkpoint_index` and `target_checkpoint_role` for checkpoint scope
   - Determinism: two calls on the same conversation produce the same `export_dir`
   - `validate_write_request` accepts a canonical-branch payload
   - `validate_write_request` accepts a canonical-merge payload

2. **`SPECS/INPROGRESS/CTXB-P5-T2_Validation_Report.md`** — Validation report.

---

## Acceptance Criteria

- [ ] Branch and merge authoring workflows protected by automated tests (existing + new).
- [ ] Compile target selection for root, branch, merge, and checkpoint scopes is deterministic and regression-tested.
- [ ] `target_kind`, `root_conversation_ids`, `merge_parent_conversation_ids` fields verified.
- [ ] `lineage_conversation_ids` ordering (oldest-first) asserted.
- [ ] Checkpoint compile target `target_checkpoint_index` and `target_checkpoint_role` verified.
- [ ] All tests pass `make test` and `make lint`.

---

## Dependencies

- CTXB-P3-T4 (complete) — compile target model and branch/merge selection APIs are stable.
