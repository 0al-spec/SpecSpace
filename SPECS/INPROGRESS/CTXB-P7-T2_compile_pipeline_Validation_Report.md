# Validation Report — CTXB-P7-T2: Compile Pipeline Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract Hyperprompt compile helpers

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/hyperprompt_compile.py` — Hyperprompt binary resolution, invocation, exit-code mapping, and export+compile composition | ✅ Done |
| `viewer/server.py` — thin compile compatibility wrappers preserving mutable default-binary behavior | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `viewer.server.DEFAULT_HYPERPROMPT_BINARY` mutation remains observable by `server.invoke_hyperprompt` | ✅ Verified by `tests/test_compile.py` |
| AC2 | `viewer.server.resolve_hyperprompt_binary` keeps its public signature | ✅ Wrapper preserves the existing call shape |
| AC3 | `viewer.server.invoke_hyperprompt` keeps its public signature and payload behavior | ✅ Verified by compile tests |
| AC4 | `viewer.server.compile_graph_nodes` still combines export and compile payloads | ✅ Verified by export tests |
| AC5 | Backend lint and full test suite pass after extraction | ✅ `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Focused tests | `python -m pytest tests/test_compile.py tests/test_export.py` | ✅ 58 passed |
| Python lint | `make lint` | ✅ Passed |
| Full backend tests | `python -m pytest tests/` | ✅ 480 passed |

---

## Implementation Summary

- Added `viewer/hyperprompt_compile.py` for Hyperprompt binary resolution, invocation, exit-code mapping, and compile composition.
- Exposed `EXIT_CODE_DESCRIPTIONS` and `default_hyperprompt_fallbacks` as public cross-module compatibility names.
- Kept `DEFAULT_HYPERPROMPT_BINARY` in `viewer/server.py` because tests and CLI defaults treat it as the mutable compatibility point.
- Kept `server.resolve_hyperprompt_binary`, `server.invoke_hyperprompt`, and `server.compile_graph_nodes` as wrappers that pass the current default binary path into the extracted module.
- Reduced `viewer/server.py` from 2827 lines to 2730 lines in this slice.

## Residual Work

- Extract conversation graph read-model helpers into `viewer/graph.py`.
- Move workspace-cache internals only after adding wrappers that preserve `_build_workspace_listing` monkeypatch behavior.
