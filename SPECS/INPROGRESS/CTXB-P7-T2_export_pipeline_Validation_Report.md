# Validation Report — CTXB-P7-T2: Export Pipeline Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract Markdown export and compile provenance helpers

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/export.py` — Markdown node rendering, `root.hc` generation, compile provenance, and export pipeline implementation | ✅ Done |
| `viewer/server.py` — thin `export_graph_nodes` compatibility wrapper with explicit graph/cache dependencies | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `viewer.server.generate_hc_root`, `_render_node_markdown`, and provenance helpers remain import-compatible | ✅ Verified by `tests/test_export.py` |
| AC2 | `viewer.server.export_graph_nodes` keeps its public signature | ✅ Wrapper preserves the existing call shape |
| AC3 | Export determinism and sentinel protection remain unchanged | ✅ Verified by focused export tests and API contract tests |
| AC4 | Compile integration still receives export provenance paths | ✅ Verified by `tests/test_compile.py` and `tests/test_export.py` |
| AC5 | Backend lint and full test suite pass after extraction | ✅ `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Focused tests | `python -m pytest tests/test_export.py tests/test_compile.py tests/test_api_contracts.py::ExportApiTests` | ✅ 76 passed |
| Python lint | `make lint` | ✅ Passed |
| Full backend tests | `python -m pytest tests/` | ✅ 478 passed |

---

## Implementation Summary

- Added `viewer/export.py` for export pipeline behavior that does not need HTTP routing state.
- Kept `viewer.server.export_graph_nodes(dialog_dir, conversation_id, message_id=None)` as a compatibility wrapper.
- Passed `collect_workspace_listing`, `build_graph_indexes`, `build_compile_target`, and `EXPORT_SENTINEL` into the extracted implementation explicitly to avoid a `viewer.export` → `viewer.server` import cycle.
- Reduced `viewer/server.py` from 3062 lines to 2827 lines in this slice.

## Residual Work

- Extract Hyperprompt compile helpers into `viewer/compile.py`, preserving `DEFAULT_HYPERPROMPT_BINARY` mutation compatibility.
- Extract conversation graph read-model helpers into `viewer/graph.py`.
- Move workspace-cache internals only after adding wrappers that preserve `_build_workspace_listing` monkeypatch behavior.
