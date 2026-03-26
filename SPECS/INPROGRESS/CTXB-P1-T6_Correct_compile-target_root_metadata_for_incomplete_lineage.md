# CTXB-P1-T6 — Correct compile-target root metadata for incomplete lineage

**Status:** In Progress
**Priority:** P1
**Dependencies:** CTXB-P1-T5 ✅

---

## Problem

`build_compile_target` in `viewer/server.py` computes `root_conversation_ids` by
taking the first element of each lineage path:

```python
root_conversation_ids = sorted({path[0] for path in lineage_paths if path})
```

`build_lineage_paths` only follows **resolved** parent edges. When a node has
unresolved or missing parent edges, it terminates and returns `[[conversation_id]]`,
making that node appear as a path root. The `root_conversation_ids` computation
then includes it — even though the node has parent edges (they are just
unresolved), so it is **not** a true root.

This misrepresents partial lineage as complete lineage and may cause downstream
compilation steps to assume a falsely reachable root.

---

## Deliverables

1. **Fix** — `viewer/server.py`: filter `root_conversation_ids` to only include
   conversations whose `parent_edge_ids` list is empty (true graph roots).
2. **Regression tests** — `tests/test_selection.py`: new test class
   `CompileTargetBrokenLineageTests` covering:
   - Broken-parent scenario: a branch whose parent conversation is absent from
     the workspace → `root_conversation_ids` is empty, `is_lineage_complete`
     is False.
   - Missing-parent-message scenario: parent conversation present but the
     referenced parent message is absent → `root_conversation_ids` is empty,
     `is_lineage_complete` is False.
   - Complete lineage still produces correct `root_conversation_ids`.
3. **README clarification** — `viewer/README.md` (or API contract doc): note
   that `root_conversation_ids` contains only true graph roots and is empty when
   lineage is incomplete.

---

## Acceptance Criteria

- Incomplete lineage selections do not include synthetic roots in
  `root_conversation_ids`.
- The API contract clearly distinguishes reachable roots from partial or broken
  ancestry (via `is_lineage_complete` and `unresolved_parent_edge_ids`).
- Regression tests cover broken-parent and missing-parent-message
  compile-target responses.
- All existing tests continue to pass.

---

## Implementation Notes

**Fix location:** `viewer/server.py`, line 466 (inside `build_compile_target`).

Change:
```python
root_conversation_ids = sorted({path[0] for path in lineage_paths if path})
```
To:
```python
root_conversation_ids = sorted(
    conv_id
    for conv_id in {path[0] for path in lineage_paths if path}
    if not nodes_by_conversation[conv_id]["parent_edge_ids"]
)
```

**Rationale:** A conversation is a true root if and only if it has no parent
edges at all. Conversations with unresolved edges have `parent_edge_ids` entries
and should not appear in `root_conversation_ids`.

**Test fixtures:** Build minimal synthetic workspace payloads inline (no new
fixture files needed). A branch with a parent pointing to a missing conversation
file exercises the broken-parent path. A branch with a resolvable parent but an
invalid `parent_message_id` exercises the missing-parent-message path.
