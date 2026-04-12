# PRD — CTXB-P7-T8: Add rmtree Safety Marker to Export Directory

**Status:** INPROGRESS  
**Phase:** 7 — Technical Debt and Quality  
**Priority:** P1  
**Branch:** feature/CTXB-P7-T8-rmtree-safety-marker  
**Date:** 2026-04-12

---

## Problem

`export_graph_nodes()` in `viewer/server.py` calls `shutil.rmtree(export_dir)`
unconditionally before writing new files:

```python
if export_dir.exists():
    shutil.rmtree(export_dir)          # ← unsafe: no ownership check
nodes_dir.mkdir(parents=True)
```

If path construction produces a wrong value (e.g. due to a bug in
`build_compile_target` or a crafted `export_dir`), the function would silently
delete an arbitrary directory with no way to distinguish "our export folder" from
"something else".

## Solution

Introduce a sentinel file `EXPORT_SENTINEL = ".ctxb_export"`:

1. **On first creation** (`nodes_dir.mkdir(parents=True)`): write
   `export_dir / EXPORT_SENTINEL` immediately after.
2. **On re-export** (when `export_dir.exists()`): verify the sentinel exists
   before calling `rmtree`. If it is absent, abort with
   `HTTPStatus.INTERNAL_SERVER_ERROR` and a descriptive error.

```python
EXPORT_SENTINEL = ".ctxb_export"

# Re-export path
if export_dir.exists():
    if not (export_dir / EXPORT_SENTINEL).exists():
        return HTTPStatus.INTERNAL_SERVER_ERROR, {
            "error": "Export directory missing safety sentinel — aborting rmtree",
            ...
        }
    shutil.rmtree(export_dir)

nodes_dir.mkdir(parents=True)
(export_dir / EXPORT_SENTINEL).write_text(
    "ContextBuilder export directory — do not remove this file.\n",
    encoding="utf-8",
)
```

---

## Deliverables

| # | Artifact | Change |
|---|----------|--------|
| 1 | `viewer/server.py` | Add `EXPORT_SENTINEL` constant; guard `rmtree`; write sentinel on creation |
| 2 | `tests/test_export.py` | Add tests: sentinel written on first export, sentinel preserved on re-export, missing sentinel blocks rmtree |

---

## Acceptance Criteria

- AC1: A directory without `.ctxb_export` is **never** deleted by the export pipeline.
- AC2: Export to a fresh path writes the sentinel before returning.
- AC3: Re-export to an existing (sentinel-bearing) path verifies sentinel, then `rmtree`s and re-creates.
- AC4: All existing export tests continue to pass.
- AC5: `make lint` passes.
