# Validation Report — CTXB-P7-T2: Graph Read-Model Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract conversation graph helpers

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/graph.py` — conversation graph diagnostics, graph snapshot, indexes, lineage paths, compile-target model, and selection read-model helpers | ✅ Done |
| `viewer/server.py` — thin graph API compatibility wrappers using the existing workspace cache | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `viewer.server.collect_graph_api` keeps its public signature | ✅ Wrapper preserves the existing call shape |
| AC2 | `viewer.server.collect_conversation_api` and `collect_checkpoint_api` keep their public signatures | ✅ Verified by selection/API tests |
| AC3 | Export still receives the same graph indexes and compile-target payloads | ✅ Verified by export tests |
| AC4 | Graph diagnostics, integrity payloads, and reindex behavior remain unchanged | ✅ Verified by focused graph/reindex/validation/integrity tests |
| AC5 | Backend lint and full test suite pass after extraction | ✅ `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Focused tests | `python -m pytest tests/test_graph.py tests/test_selection.py tests/test_api_contracts.py tests/test_reindex.py tests/test_export.py tests/test_validation.py tests/test_integrity.py` | ✅ 173 passed |
| Python lint | `make lint` | ✅ Passed |
| Full backend tests | `python -m pytest tests/` | ✅ 480 passed |

---

## Implementation Summary

- Added `viewer/graph.py` as the focused module for conversation graph read-model construction and selection payloads.
- Moved graph snapshot, diagnostics, indexes, lineage path, compile-target, conversation, and checkpoint helpers out of `viewer/server.py`.
- Kept compatibility names imported in `viewer/server.py`, including `build_graph_indexes` and `build_compile_target`, because the export wrapper depends on them.
- Kept high-level `server.collect_graph_api`, `server.collect_conversation_api`, and `server.collect_checkpoint_api` wrappers so existing tests and handlers keep the same signatures.
- Reduced `viewer/server.py` from 2730 lines to 2204 lines in this slice.

## Residual Work

- Extract workspace-cache internals with explicit care for `_build_workspace_listing` monkeypatch behavior.
- Continue reducing `viewer/server.py` by moving SpecGraph route/read-model helpers that are currently still embedded in the handler layer.
