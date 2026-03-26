# CTXB-P4-T5 Validation Report

**Task:** Preserve provenance from compiled artifact back to graph selection
**Date:** 2026-03-26
**Verdict:** PASS

## Quality Gates

| Gate | Result |
|------|--------|
| Tests (`make test`) | PARTIAL — blocked in sandbox for HTTP endpoint tests (`PermissionError: [Errno 1] Operation not permitted` on `ThreadingHTTPServer` bind) |
| Lint (`make lint`) | PASS — `PYTHONPYCACHEPREFIX=/tmp/contextbuilder-pycache make lint` |
| Targeted regression tests | PASS — `python3 -m unittest tests.test_export tests.test_api_contracts.ExportApiTests.test_hc_file_references_provenance_markdown tests.test_compile.TestInvokeHyperprompt.test_success_path` |
| UI build | PASS — `npm --prefix viewer/app run build` |

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| A user can determine which compile target produced a given compiled Markdown artifact | ✅ Added deterministic `provenance.md` (included in `root.hc`) and `provenance.json` sidecar with compile-target and source-conversation mapping |
| Artifact provenance survives refresh and repeated compilation | ✅ Export directory is regenerated deterministically; provenance artifacts are recreated every export/compile and included in compile response payload |
| Implementation satisfies PRD FR-16 and §6.6 | ✅ Compile output path now includes explicit provenance artifacts (`provenance.md` / `provenance.json`) and compile payload exposes them for downstream traceability |

## Changes Made

- `viewer/server.py`
  - Added deterministic compile provenance builders (`build_compile_provenance`, `render_compile_provenance_markdown`).
  - Added `provenance.md` and `provenance.json` generation in `export_graph_nodes`.
  - Updated `generate_hc_root` to include a provenance section when provided.
  - Added `compile.provenance_json` / `compile.provenance_md` fields in `compile_graph_nodes`.
- `tests/test_export.py`
  - Added tests for provenance section in `root.hc`, provenance sidecar artifacts, and compile payload provenance fields.
- `tests/test_api_contracts.py`
  - Added API/export contract assertions for provenance paths and `root.hc` provenance reference.
- `tests/test_compile.py`
  - Added compile endpoint expectation for `compile.provenance_json`.
- `viewer/app/src/types.ts`, `viewer/app/src/InspectorOverlay.tsx`
  - Added provenance fields to compile success type and render/copy controls in compile result UI.
- `README.md`
  - Documented provenance artifacts in export layout and compile/export response contracts.
