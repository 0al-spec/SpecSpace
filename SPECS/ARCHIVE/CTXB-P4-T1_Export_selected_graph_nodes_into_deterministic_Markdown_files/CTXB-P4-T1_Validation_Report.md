# Validation Report — CTXB-P4-T1

**Task:** Export selected graph nodes into deterministic Markdown files
**Date:** 2026-03-25
**Verdict:** PASS

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | PASS — 74 tests (13 new), 0 failures |
| Lint | `make lint` | PASS — no errors |

---

## Acceptance Criteria

- [x] `POST /api/export` with `{ conversation_id }` writes all lineage messages to `{export_dir}/nodes/`.
- [x] `POST /api/export` with `{ conversation_id, message_id }` truncates target conversation at the specified checkpoint.
- [x] Repeated export of unchanged inputs yields byte-identical files.
- [x] Each export node preserves `conversation_id`, `message_id`, role, and content.
- [x] Node filenames are deterministic: `{index:04d}_{message_id}.md` under `nodes/{conversation_id}/`.
- [x] Response includes `export_dir`, `node_count`, and per-conversation file listing.
- [x] All existing tests pass (61 → 74).
- [x] New `ExportApiTests` pass (13 new tests).
- [x] PRD FR-12 and §6.4 satisfied.

---

## Files Changed

| File | Change |
|------|--------|
| `viewer/server.py` | Added `import shutil`, `_render_node_markdown()`, `export_graph_nodes()`, `handle_export()`, and `/api/export` route in `do_POST()` |
| `tests/test_api_contracts.py` | Added `ExportApiTests` class with 13 tests |

---

## Implementation Notes

- `export_graph_nodes()` calls `build_compile_target()` to get `lineage_conversation_ids` and `export_dir`, then writes `{export_dir}/nodes/{conv_id}/{index:04d}_{message_id}.md` for each message.
- Checkpoint scope: target conversation is truncated at `target_checkpoint_index` (inclusive), all parent conversations export fully.
- Re-export uses `shutil.rmtree` to clean the export directory first, guaranteeing no stale files.
- Markdown node format: `<!-- conversation_id: ... message_id: ... role: ... -->` provenance comment followed by verbatim content.
- Optional fields `turn_id` and `source` are included in the provenance comment when present in the source message.
- The `nodes/` directory is organised per conversation: `nodes/{conversation_id}/{index:04d}_{message_id}.md`. This structure is ready for CTXB-P4-T2 to reference in the `.hc` root file.
