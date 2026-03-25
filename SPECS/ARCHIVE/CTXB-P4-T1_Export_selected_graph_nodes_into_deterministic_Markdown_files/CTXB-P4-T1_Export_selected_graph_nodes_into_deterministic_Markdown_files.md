# CTXB-P4-T1 — Export Selected Graph Nodes into Deterministic Markdown Files

**Phase:** P4 — Hyperprompt Export and Compilation Pipeline
**Priority:** P0
**Dependencies:** CTXB-P3-T3 (compile target model), CTXB-P3-T4 (UI compile target selection)
**Parallelizable:** no

---

## Goal

Implement a `POST /api/export` server endpoint that materialises the selected compile target as a set of deterministic `.md` node files on disk. These files are the leaf inputs for the Hyperprompt `.hc` root file generated in CTXB-P4-T2.

---

## Context

- `build_compile_target()` already computes `lineage_conversation_ids` (ordered oldest→newest), `export_dir`, and target scope.
- The graph holds each conversation's full `messages` array (with `message_id`, `role`, `content`, optional `turn_id`, `source`).
- Export directory pattern: `{dialog_dir}/export/{conversation_id}` (conversation scope) or `{dialog_dir}/export/{conversation_id}--{message_id}` (checkpoint scope).
- PRD §6.4 requires: determinism, visible provenance (conversation + message identity), verbatim content, standalone meaningfulness.

---

## Deliverables

### 1. `POST /api/export` endpoint in `viewer/server.py`

**Request body:**
```json
{ "conversation_id": "...", "message_id": "..." }
```
`message_id` is optional (omit for conversation-scope export).

**Algorithm:**
1. Call `build_compile_target()` for the given selection.
2. Create `{export_dir}/nodes/{conversation_id}/` subdirectory for each conversation in scope.
3. For each `conv_id` in `lineage_conversation_ids` (oldest first):
   - Fetch the conversation's messages from the graph.
   - Determine the export slice:
     - If `conv_id == target_conversation_id` AND scope is `"checkpoint"`: export messages `0..target_checkpoint_index` (inclusive).
     - Otherwise: export all messages.
   - Write one `.md` file per message to `{export_dir}/nodes/{conv_id}/{index:04d}_{message_id}.md`.
4. Return export summary JSON.

**Response body:**
```json
{
  "export_dir": "/abs/path/to/export/...",
  "node_count": 12,
  "conversations": [
    {
      "conversation_id": "...",
      "node_dir": "nodes/conv_id/",
      "files": ["0000_msg_id.md", "0001_msg_id.md", ...]
    }
  ]
}
```

### 2. Markdown node file format

Each file: `{export_dir}/nodes/{conv_id}/{index:04d}_{message_id}.md`

```markdown
<!-- conversation_id: {conv_id} message_id: {msg_id} role: {role} -->

{content}
```

Optional provenance fields appended to the comment when present in source data:
```markdown
<!-- conversation_id: {conv_id} message_id: {msg_id} role: {role} turn_id: {turn_id} source: {source} -->
```

Rules:
- Content is written verbatim (no rewriting, no escaping beyond what's already in the source).
- Trailing newline on every file.
- File encoding: UTF-8.

### 3. Determinism guarantee

- Same `(conversation_id, message_id)` input → identical directory structure and file contents.
- Existing export directory is overwritten on re-export (full directory replaced, not appended).
- File index in name (`{index:04d}`) is the message's position in the conversation's `messages` array.

### 4. Tests in `tests/test_api_contracts.py`

New test class `ExportApiTests` covering:
- Conversation-scope export: all messages of all lineage conversations written correctly.
- Checkpoint-scope export: target conversation truncated at target message index.
- Determinism: exporting twice produces identical files.
- Re-export overwrites cleanly (no stale files from previous run).
- Missing `conversation_id` returns 400.
- Invalid `conversation_id` returns 404.
- Node file format: provenance comment present, content verbatim.

---

## Acceptance Criteria

- [ ] `POST /api/export` with `{ conversation_id }` writes all lineage messages to `{export_dir}/nodes/`.
- [ ] `POST /api/export` with `{ conversation_id, message_id }` truncates target conversation at the specified checkpoint.
- [ ] Repeated export of unchanged inputs yields byte-identical files.
- [ ] Each export node preserves `conversation_id`, `message_id`, role, and content.
- [ ] Node filenames are deterministic: `{index:04d}_{message_id}.md` under `nodes/{conversation_id}/`.
- [ ] Response includes `export_dir`, `node_count`, and per-conversation file listing.
- [ ] All existing tests pass.
- [ ] New `ExportApiTests` pass.
- [ ] PRD FR-12 and §6.4 satisfied.

---

## Files Expected to Change

| File | Change |
|------|--------|
| `viewer/server.py` | Add `POST /api/export` handler and `export_graph_nodes()` helper |
| `tests/test_api_contracts.py` | Add `ExportApiTests` class |

---

## Out of Scope

- Generating the `.hc` root file (CTXB-P4-T2).
- Invoking Hyperprompt (CTXB-P4-T3).
- UI button to trigger export (CTXB-P4-T4).
- Merge-order logic for `.hc` file (CTXB-P4-T2).
