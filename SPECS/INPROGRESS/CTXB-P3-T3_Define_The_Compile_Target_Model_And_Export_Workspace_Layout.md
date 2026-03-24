# CTXB-P3-T3 — Define the Compile Target Model and Export Workspace Layout

**Status:** In Progress
**Priority:** P0
**Phase:** Phase 3 — Authoring and Export Primitives
**Dependencies:** CTXB-P1-T5, CTXB-P2-T2

---

## Objective

Formalize the compile-target data model so that every downstream export task (P4) has a single, unambiguous contract to program against. This task:

1. Adds `export_dir` to the compile-target payload returned by `build_compile_target`.
2. Defines the deterministic export directory layout on disk.
3. Adds a formal `CompileTargetPayload` TypedDict in `schema.py` that documents every field.
4. Mirrors the full compile-target shape as a TypeScript interface in `types.ts`.
5. Updates `InspectorOverlay.tsx` to display the resolved export path alongside the lineage badge.

---

## Export Directory Contract

```
{dialog_dir}/export/
  {target_conversation_id}/                    ← conversation scope
    index.hc                                   ← generated Hyperprompt root (Phase 4)
    nodes/
      {conversation_id}.md                     ← one file per lineage node (Phase 4)
  {target_conversation_id}--{target_message_id}/   ← checkpoint scope
    index.hc
    nodes/
      {conversation_id}.md
```

**Rules:**
- The base export root is `{dialog_dir}/export/`.
- The target subdirectory name is `{target_conversation_id}` for conversation scope, or `{target_conversation_id}--{target_message_id}` for checkpoint scope.
- Directory separators and `--` are the only special characters; no URL encoding.
- This task establishes the path contract only — no directories are created yet.

---

## Acceptance Criteria

- `build_compile_target` returns `export_dir` (absolute path string) matching the layout above.
- `CompileTargetPayload` TypedDict in `schema.py` documents every key.
- `CompileTarget` TypeScript interface in `types.ts` mirrors the full server payload.
- `InspectorOverlay.tsx` shows the resolved `export_dir` alongside the lineage badge.
- All existing tests pass; new tests cover `export_dir` in conversation and checkpoint scopes.

---

## Phase 1: Python — Add `CompileTargetPayload` TypedDict

**File:** `viewer/schema.py`

Add at the bottom of the module (after existing dataclasses):

```python
from typing import TypedDict

class CompileTargetPayload(TypedDict, total=False):
    scope: str                              # "conversation" | "checkpoint"
    target_conversation_id: str
    target_message_id: str | None           # present for checkpoint scope
    target_kind: str                        # "root" | "branch" | "merge"
    lineage_conversation_ids: list[str]     # ordered oldest-first
    lineage_edge_ids: list[str]             # sorted
    lineage_paths: list[list[str]]          # sorted paths to roots
    root_conversation_ids: list[str]        # sorted
    merge_parent_conversation_ids: list[str]  # sorted
    unresolved_parent_edge_ids: list[str]   # sorted
    is_lineage_complete: bool
    export_dir: str                         # absolute path for export artifacts
    target_checkpoint_index: int            # present for checkpoint scope
    target_checkpoint_role: str             # present for checkpoint scope
```

**Verification:** `make lint` passes, `make test` passes (no behavioural change yet).

---

## Phase 2: Python — Add `export_dir` to `build_compile_target`

**File:** `viewer/server.py`

1. Import `Path` (already imported) — confirm at top of file.
2. Update signature to accept `dialog_dir: Path`:

```python
def build_compile_target(
    graph: dict[str, Any],
    conversation_id: str,
    *,
    scope: str,
    dialog_dir: Path,
    target_message_id: str | None = None,
    checkpoint: dict[str, Any] | None = None,
) -> dict[str, Any]:
```

3. Compute export dir before building `payload`:

```python
if target_message_id is not None:
    target_subdir = f"{conversation_id}--{target_message_id}"
else:
    target_subdir = conversation_id
export_dir = str(dialog_dir / "export" / target_subdir)
```

4. Add `"export_dir": export_dir` to the `payload` dict.

5. Update both call sites in `collect_conversation_api` and `collect_checkpoint_api` to pass `dialog_dir=dialog_dir`.

**Tests to write first** (`tests/test_api_contracts.py`):
```python
def test_compile_target_includes_export_dir_conversation_scope(self):
    # compile_target.export_dir ends with "/{conversation_id}"
    ...

def test_compile_target_includes_export_dir_checkpoint_scope(self):
    # compile_target.export_dir ends with "/{conversation_id}--{message_id}"
    ...
```

**Verification:** `make test` passes, `make lint` passes.

---

## Phase 3: TypeScript — Add `CompileTarget` interface

**File:** `viewer/app/src/types.ts`

Append:

```typescript
export interface CompileTarget {
  scope: "conversation" | "checkpoint";
  target_conversation_id: string;
  target_message_id: string | null;
  target_kind: "root" | "branch" | "merge";
  lineage_conversation_ids: string[];
  lineage_edge_ids: string[];
  lineage_paths: string[][];
  root_conversation_ids: string[];
  merge_parent_conversation_ids: string[];
  unresolved_parent_edge_ids: string[];
  is_lineage_complete: boolean;
  export_dir: string;
  target_checkpoint_index?: number;
  target_checkpoint_role?: string;
}
```

**File:** `viewer/app/src/InspectorOverlay.tsx`

1. Replace the inline `compile_target` shape in the `ConversationDetailPayload` interface with `compile_target: CompileTarget`.
2. Import `CompileTarget` from `./types`.
3. After the lineage badge, add an export-path row:

```tsx
{convDetail?.compile_target?.export_dir && (
  <div className="inspector-export-path">
    Export: <code>{convDetail.compile_target.export_dir}</code>
  </div>
)}
```

**Verification:** TypeScript build passes (`npm run build` or `npm run typecheck` if configured).

---

## Phase 4: Validation Report

Run:
```bash
make test
make lint
```

Fill in `CTXB-P3-T3_Validation_Report.md` with results.

---

## Notes

- Do not create the export directory during this task — that is Phase 4 work (CTXB-P4-T1).
- `CompileTargetPayload` is a TypedDict, not a dataclass, to match the dict-returning style used throughout `server.py`.
- The `--` separator in checkpoint scope directory names avoids `/` which would require nested directory creation.
- Workplan: mark CTXB-P3-T3 ✅ after archive.
