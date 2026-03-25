## REVIEW REPORT — generate_hc_root_file

**Scope:** main..HEAD (feature/CTXB-P4-T2-generate-hyperprompt-hc-file)
**Files:** 2 changed (viewer/server.py, tests/test_api_contracts.py)

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

None. The implementation is minimal, correct, and has no observable issues.

---

### Architectural Notes

1. **`generate_hc_root()` is a pure function** — takes data in, returns a string. Easy to unit-test independently if needed. The write to disk happens in `export_graph_nodes()`, keeping I/O concerns at the boundary.

2. **`titles_by_conv.get(conv_id) or conv_id` fallback** — handles empty string titles (which the schema allows) gracefully by falling back to the conversation ID. This ensures the `.hc` always has a valid string in every section header.

3. **Ordering derived from `lineage_conversation_ids`** — the `conversations_written` list is populated in `lineage_conversation_ids` order, so `generate_hc_root` inherits the correct depth-first, oldest-first ordering automatically. No extra sorting needed.

4. **`root.hc` is written inside `export_dir`** — consistent with the `--root {export_dir}` flag that Hyperprompt uses for path resolution. All paths in `root.hc` are relative to `export_dir`.

---

### Tests

- 80 tests total, 6 new.
- Covers: file existence, all node refs present, section ordering (root before branch), title as header, 4-space indent, trailing newline.
- Full acceptance criteria coverage.

---

### Next Steps

- CTXB-P4-T3 can now call `POST /api/export` → receive `hc_file` → pass `hc_file` to `hyperprompt --root {export_dir} --output {export_dir}/compiled.md`.
- No follow-up tasks needed.
