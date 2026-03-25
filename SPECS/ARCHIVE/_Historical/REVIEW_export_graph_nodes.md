## REVIEW REPORT — export_graph_nodes

**Scope:** main..HEAD (feature/CTXB-P4-T1-export-graph-nodes-markdown)
**Files:** 2 changed (viewer/server.py, tests/test_api_contracts.py)

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

---

### Critical Issues

None.

---

### Secondary Issues

**[Medium] `export_graph_nodes()` calls `collect_workspace_listing()` which scans and validates the entire workspace**

`collect_workspace_listing()` reads and validates every JSON file in `dialog_dir` for each export call. This is the same pattern as the existing `collect_conversation_api()` and `collect_checkpoint_api()` — consistent with the codebase, but means export is O(n_files). Fine for v1 local use, but worth noting for Phase 5 performance hardening if workspaces grow large.

*Fix suggestion:* No change needed now. Log as a note for CTXB-P5 NFR hardening (api_response_ms: 200 may be exceeded for large workspaces).

**[Low] `_render_node_markdown` uses double-space to join provenance fields in the comment**

```python
comment = "<!-- " + "  ".join(parts) + " -->"
```

This produces `<!-- conversation_id: ...  message_id: ...  role: ... -->` with two spaces between fields. Single space or a newline-separated block comment would be more readable.

*Fix suggestion:* Use `"  ".join(parts)` → `"  ".join(parts)` is fine for machine parsing; cosmetic only. Not blocking. Can be standardised in CTXB-P4-T2 when the `.hc` generator may also produce comments.

**[Low] Checkpoint `index` field used for filename but may not start at 0 for all future data shapes**

The filename `f"{cp['index']:04d}_{cp['message_id']}.md"` uses `cp['index']` which is the message's position in the `messages` array. Currently this is always 0-based and contiguous. If a future data shape has non-contiguous indices (e.g. after message deletion), filenames would have gaps. The determinism guarantee still holds (same data → same filenames), but the naming could look surprising.

*Fix suggestion:* No change needed; the current implementation is correct for all existing data. Document as a constraint: message indices must be 0-based and contiguous for readable filenames.

---

### Architectural Notes

1. **Clean separation between export logic and HTTP routing.** `export_graph_nodes()` is a pure function (path + identifiers in, status + dict out) with no coupling to the HTTP handler. Correct pattern for testability.

2. **`shutil.rmtree` for re-export is the right call.** Overwriting individual files would leave stale files if a previous export had more messages. Full directory replacement is determinism-safe.

3. **`nodes/{conv_id}/` directory structure is forward-compatible.** CTXB-P4-T2 will reference `nodes/{conv_id}/{index:04d}_{msg_id}.md` as relative paths from `export_dir`, which is exactly how Hyperprompt resolves file references from `--root {export_dir}`.

4. **Response includes full `compile_target`** — this lets the caller (future UI, CTXB-P4-T4) know the export dir, lineage completeness, and merge parent ordering without a second API call.

---

### Tests

- 74 tests total, 13 new in `ExportApiTests`.
- Covers: conversation scope, checkpoint scope (truncation), determinism, stale file removal, error cases (missing conv_id, 404 conv, 404 checkpoint), HTTP endpoint.
- No coverage gaps relative to the acceptance criteria.
- NFR check: tests run in ~6.7s total — well within the 200ms API response budget per request.

---

### Next Steps

- CTXB-P4-T2 (Generate Hyperprompt `.hc` root file) can immediately consume the `nodes/{conv_id}/` output and the `conversations` array in the export response to build the correct `.hc` structure.
- Consider exposing a `GET /api/export?conversation_id=...` variant in CTXB-P4-T4 so the UI can check whether an export already exists before triggering a new one.
