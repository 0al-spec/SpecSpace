# CTXB-P3-T3 Validation Report

**Task:** Define the Compile Target Model and Export Workspace Layout
**Date:** 2026-03-25
**Verdict:** PASS

---

## Quality Gates

| Gate | Result | Notes |
|------|--------|-------|
| Tests | PASS | 61/61 pass |
| Lint | PASS | No errors |

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `build_compile_target` returns `export_dir` (absolute path) matching the layout contract | PASS |
| `CompileTargetPayload` TypedDict in `schema.py` documents every key | PASS |
| `CompileTarget` TypeScript interface in `types.ts` mirrors the full server payload | PASS |
| `InspectorOverlay.tsx` shows resolved `export_dir` alongside the lineage badge | PASS |
| All existing tests pass; new tests cover `export_dir` in both scopes | PASS |

---

## Changes

- `viewer/schema.py` — Added `CompileTargetPayload` TypedDict documenting every compile-target field.
- `viewer/server.py` — Added `dialog_dir: Path` parameter to `build_compile_target`; computes `export_dir` as `{dialog_dir}/export/{conversation_id}` (conversation scope) or `{dialog_dir}/export/{conversation_id}--{message_id}` (checkpoint scope).
- `viewer/app/src/types.ts` — Added `CompileTarget` TypeScript interface matching the full server payload including `export_dir`.
- `viewer/app/src/InspectorOverlay.tsx` — Replaced inline `compile_target` shape with `CompileTarget` import; added export path display row.
- `tests/test_api_contracts.py` — Added two new tests: `test_compile_target_includes_export_dir_conversation_scope` and `test_compile_target_includes_export_dir_checkpoint_scope`.

---

## Export Directory Contract (established)

```
{dialog_dir}/export/
  {conversation_id}/                         ← conversation scope
  {conversation_id}--{message_id}/           ← checkpoint scope
```

No directories are created by this task — the contract is established for Phase 4 to materialize.
