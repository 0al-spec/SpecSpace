# CTXB-P4-T2 — Generate a Valid Hyperprompt Root File for the Selected Branch

**Phase:** P4 — Hyperprompt Export and Compilation Pipeline
**Priority:** P0
**Dependencies:** CTXB-P4-T1 (`POST /api/export` writes node `.md` files)
**Parallelizable:** no

---

## Goal

Extend `export_graph_nodes()` to also write a `root.hc` file at `{export_dir}/root.hc` that references all exported Markdown nodes in the correct order for Hyperprompt compilation.

---

## Context

After CTXB-P4-T1, `{export_dir}/nodes/{conv_id}/{index:04d}_{msg_id}.md` files exist.
The `compile_target.lineage_conversation_ids` list is already ordered oldest→newest (depth-first), which is the correct emission order for Hyperprompt.
The Hyperprompt binary at `/Users/egor/Development/GitHub/0AL/Hyperprompt/.build/release/hyperprompt` accepts `root.hc` with `--root {export_dir}` so all paths in the `.hc` are relative to `export_dir`.

---

## Deliverables

### 1. `generate_hc_root()` in `viewer/server.py`

```python
def generate_hc_root(
    conversations: list[dict[str, Any]],
    titles_by_conv: dict[str, str],
) -> str:
```

Generates `.hc` content string. For each conversation in order:
```
# ContextBuilder export
"{Conversation Title}"
    "nodes/{conv_id}/{file}"
    "nodes/{conv_id}/{file}"
"{Next Conversation Title}"
    "nodes/{next_conv_id}/{file}"
```

Rules:
- Conversation section header: `"{title}"` (use `conv_id` as fallback if title is empty).
- Node file lines: 4-space indent, `"nodes/{conv_id}/{filename}"`.
- File ends with a single trailing newline.

### 2. Extension of `export_graph_nodes()`

After writing all `.md` files:
- Build `titles_by_conv` from `nodes_by_conversation`.
- Call `generate_hc_root(conversations_written, titles_by_conv)`.
- Write to `{export_dir}/root.hc`.
- Add `"hc_file": str(export_dir / "root.hc")` to the response.

### 3. Tests — new cases in `ExportApiTests`

- `test_hc_file_written_to_export_dir` — `root.hc` exists after export.
- `test_hc_file_references_all_node_files` — every `.md` file appears in `root.hc`.
- `test_hc_file_sections_ordered_by_lineage` — root conversation section appears before branch section.
- `test_hc_file_uses_conversation_title_as_section_header` — section header matches conversation title.
- `test_hc_file_uses_4_space_indent` — node file lines start with exactly 4 spaces.
- `test_hc_file_in_response` — response includes `hc_file` path.

---

## Acceptance Criteria

- [ ] `root.hc` written at `{export_dir}/root.hc` after every successful export.
- [ ] Each conversation appears as a `"{title}"` section, ordered oldest→newest lineage.
- [ ] Each message file appears as `    "nodes/{conv_id}/{file}"` (4-space indent).
- [ ] No path traversal — all references are relative paths inside `nodes/`.
- [ ] File is valid UTF-8 and ends with a newline.
- [ ] Response from `POST /api/export` includes `hc_file` absolute path.
- [ ] All existing tests pass.
- [ ] New `.hc` tests pass.
- [ ] PRD FR-13 and §6.5 satisfied.

---

## Files Expected to Change

| File | Change |
|------|--------|
| `viewer/server.py` | Add `generate_hc_root()`, extend `export_graph_nodes()` to write `root.hc` and include `hc_file` in response |
| `tests/test_api_contracts.py` | Add 6 new test cases to `ExportApiTests` |
