# PRD — CTXB-P7-T6: Consolidate Path Traversal Protection in dialog_path_for_name

**Status:** INPROGRESS  
**Phase:** 7 — Technical Debt and Quality  
**Priority:** P1  
**Branch:** feature/CTXB-P7-T6-path-traversal-protection  
**Date:** 2026-04-12

---

## Problem

Path containment (preventing directory traversal) is checked in only one place:
`safe_dialog_path()` in the HTTP handler layer. Two internal callers bypass this
layer entirely:

| Caller | Uses | Containment check? |
|--------|------|--------------------|
| `safe_dialog_path` | `dialog_path_for_name` + manual `startswith` | ✅ HTTP layer only |
| `validate_write_request` | `dialog_path_for_name` directly | ❌ None |

If `validate_write_request` (or any future internal caller) is invoked with a
crafted name such as `../../etc/passwd.json`, it will resolve to a path outside
`dialog_dir` with no error.

## Solution

Move the containment check **into** `dialog_path_for_name` itself:

```python
def dialog_path_for_name(dialog_dir: Path, name: str) -> Path:
    resolved = (dialog_dir / name).resolve()
    dir_resolved = dialog_dir.resolve()
    if not str(resolved).startswith(str(dir_resolved) + os.sep) \
       and resolved != dir_resolved:
        raise ValueError(
            f"Path '{name}' resolves outside dialog_dir '{dialog_dir}': {resolved}"
        )
    return resolved
```

`safe_dialog_path` catches the `ValueError` and returns `None` instead of
duplicating the containment logic.

---

## Deliverables

| # | Artifact | Change |
|---|----------|--------|
| 1 | `viewer/server.py` | `dialog_path_for_name` raises `ValueError` on escape; `safe_dialog_path` catches it |
| 2 | `tests/test_path_traversal.py` | New test module: escape rejected, valid path accepted, safe_dialog_path returns None on escape |

---

## Acceptance Criteria

- AC1: `dialog_path_for_name(dialog_dir, "../../etc/passwd.json")` raises `ValueError`.
- AC2: `dialog_path_for_name(dialog_dir, "valid.json")` returns the correct resolved path.
- AC3: `safe_dialog_path` returns `None` for traversal names without duplicating the check.
- AC4: All existing tests pass.
- AC5: `make lint` passes.

---

## Design Notes

- Use `str(resolved).startswith(str(dir_resolved) + os.sep)` to avoid a false
  match where `dialog_dir=/tmp/foo` would incorrectly accept `/tmp/foobar/x.json`.
  The `+ os.sep` ensures a proper directory boundary.
- `dialog_dir` passed to `dialog_path_for_name` must already be `.resolve()`-d
  by callers (already the case in both existing call sites).
