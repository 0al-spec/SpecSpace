# CTXB-P5-T3 — Add automated tests for Markdown export, .hc generation, and Hyperprompt compile integration

**Status:** In Progress
**Priority:** P0
**Phase:** Phase 5 — Hardening, Tests, and Documentation

---

## Context

`test_compile.py` covers `invoke_hyperprompt` (all exit codes and the missing-binary path) and the `/api/compile` HTTP endpoint. However, the upstream export pipeline — `export_graph_nodes`, `generate_hc_root`, and `_render_node_markdown` — has no dedicated tests. Any change to these functions can silently break the compile workflow without a test failure.

---

## Deliverables

1. **`tests/test_export.py`** — New test module covering the Markdown export and `.hc` generation pipeline:

   **export_graph_nodes (unit + integration):**
   - Successful export creates expected directory structure (`export_dir/nodes/{conv_id}/`)
   - Exported files named `{index:04d}_{message_id}.md`
   - `node_count` in response matches total files written
   - `conversations` list reflects written conversations with correct file names
   - `hc_file` path points to the generated `root.hc`
   - Re-export wipes the previous export and produces fresh output
   - Checkpoint-scope export truncates messages to the target checkpoint index
   - Missing conversation ID returns 400
   - Unknown conversation ID returns 404

   **_render_node_markdown (unit):**
   - Output includes the provenance HTML comment with `conversation_id`, `message_id`, `role`
   - `turn_id` and `source` appear in the comment when present
   - Content follows the comment

   **generate_hc_root (unit):**
   - Contains `# ContextBuilder export` header
   - Lists conversation title followed by node file paths
   - Node file paths use the `nodes/{conv_id}/{filename}` format

   **compile_graph_nodes (integration):**
   - End-to-end: exports nodes, writes root.hc, invokes stub compiler, returns compiled_md
   - Returns 400 for empty conversation_id

2. **`SPECS/INPROGRESS/CTXB-P5-T3_Validation_Report.md`**

---

## Acceptance Criteria

- [ ] Broken node references, invalid compiler setup, and incorrect artifact generation are each covered.
- [ ] Successful compile flow is covered end-to-end with a stub binary.
- [ ] All tests pass `make test`, `make lint` clean.

---

## Dependencies

- CTXB-P4-T4 (complete) — export and compile pipeline is stable.
