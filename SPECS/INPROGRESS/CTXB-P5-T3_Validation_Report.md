# CTXB-P5-T3 Validation Report

**Task:** Add automated tests for Markdown export, .hc generation, and Hyperprompt compile integration
**Date:** 2026-03-26
**Verdict:** PASS

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | PASS — 184 tests, 0 failures (up from 154) |
| Lint | `make lint` | PASS — 0 errors |

---

## Deliverables

### tests/test_export.py
New test module with 30 tests covering the export and compile pipeline:

**RenderNodeMarkdownTests (5 tests)**
- Output contains provenance HTML comment with conversation_id, message_id, role
- Content appears after the comment
- `turn_id` and `source` appear in comment when present
- `turn_id` and `source` absent when fields not in checkpoint
- Output ends with newline

**GenerateHcRootTests (5 tests)**
- Output starts with `# ContextBuilder export` header
- Contains conversation title as quoted string
- Contains node file paths in `nodes/{conv_id}/{filename}` format
- Multiple conversations appear in order (A before B)
- Falls back to conv_id when title is missing

**ExportGraphNodesTests (11 tests)**
- Successful export returns 200
- `export_dir` exists after export
- `nodes/{conv_id}/` subdirectory created
- Exported files follow `{index:04d}_{message_id}.md` naming
- `node_count` (per-conversation files) matches message count
- `root.hc` is created at `export_dir/root.hc`
- `root.hc` references exported node files with correct path format
- Branch export includes root conversation in lineage
- Re-export wipes previous output (no stale files)
- Empty conversation_id → 400
- Unknown conversation_id → 404
- Exported Markdown contains provenance comment

**ExportCheckpointScopeTests (3 tests)**
- Checkpoint scope truncates to exactly 1 file when targeting first message
- Checkpoint scope includes all messages when targeting last message
- Unknown message_id → 404

**CompileGraphNodesTests (5 tests)**
- Successful compile returns 200 with `export_dir`, `hc_file`, `compile` keys
- `compile` result includes `compiled_md` and `manifest_json`
- Empty conversation_id → 400
- Missing binary → 422
- Compiler failure propagates exit_code

---

## Acceptance Criteria

- [x] Broken references (unknown conv/message ID) are covered
- [x] Invalid compiler setup (missing binary) is covered
- [x] Incorrect artifact generation (file naming, provenance comment, .hc format) is covered
- [x] Successful compile flow covered end-to-end with a stub binary
- [x] 184 tests pass `make test`, `make lint` clean
