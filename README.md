# ContextBuilder

ContextBuilder is the local viewer/editor repository for already extracted dialog JSON files.

It does not capture browser tabs and it does not parse raw HTML. Its job is narrower:

- serve a local HTTP API over a directory of dialog JSON files
- provide a browser UI for browsing and editing those files

## Quick Start

Point the viewer at a directory containing extracted dialog JSON files, for example `ChatGPTDialogs/import_json/`:

```bash
make serve DIALOG_DIR=/absolute/path/to/ChatGPTDialogs/import_json
```

Then open:

```text
http://localhost:8000/viewer/index.html
```

You can also run the server directly:

```bash
python3 viewer/server.py --port 8000 --dialog-dir /absolute/path/to/dialogs
```

## Graph-First Viewer

The viewer now opens in a graph-first mode instead of treating the file list as the primary navigation surface.

- The main canvas is driven by `GET /api/graph` and renders the current workspace lineage directly.
- Root, branch, and merge conversations have distinct node states so the graph can be read without opening each file first.
- Broken lineage stays visible as a broken edge and warning state instead of disappearing from the canvas.
- Drag the canvas background to pan, then click a node to load that conversation into the transcript panel.
- Selecting a node also opens a structured conversation inspector with lineage edges, integrity details, and a checkpoint inventory.
- Click `Inspect checkpoint` on a transcript message or checkpoint card to focus that exact message anchor and review its workflow metadata.
- Branching from the active checkpoint is available directly from the checkpoint inspector, while merge and compile actions remain visible as later-phase affordances.
- The file list remains available in the sidebar for file-level actions such as open, delete, and save flows.

## File Contract

ContextBuilder currently supports imported root conversations in the shape produced by `ChatGPTDialogs` and defines a stricter canonical shape for conversations created and normalized by ContextBuilder itself.

### Imported Root Format

Current imported examples under `real_examples/import_json/` use this shape:

```json
{
  "title": "Conversation Title",
  "source_file": "/absolute/path/to/file.html",
  "message_count": 42,
  "messages": [
    {
      "role": "user",
      "content": "..."
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ]
}
```

In the current imported data:

- top-level files do not yet include `conversation_id`
- top-level files do not yet include lineage metadata
- messages include `message_id`
- messages may also include `turn_id` and `source`

Important: `message_id` and `turn_id` must not be assumed equivalent. Real imported examples show they may differ while both remain stable and meaningful.

Imported files are treated as compatible root conversations. They can be indexed and viewed immediately, but they require normalization before they become canonical branch or merge conversations in the graph.

### Canonical Conversation Format

Canonical conversations created or normalized by ContextBuilder must follow this shape:

```json
{
  "conversation_id": "conv-trust-social-root",
  "title": "Trust Social Root Conversation",
  "source_file": "/absolute/path/to/file.html",
  "messages": [
    {
      "message_id": "msg-root-1",
      "role": "user",
      "content": "Outline the concept.",
      "turn_id": "turn-root-1",
      "source": "conversation-turn-1"
    }
  ],
  "lineage": {
    "parents": []
  }
}
```

Canonical message semantics:

- `message_id` is the canonical message anchor for graph lineage and exported context artifacts
- `turn_id` is preserved imported provenance when available
- `source` is a stable imported source anchor when available

### Canonical Branch Format

Branch conversations are canonical conversations with exactly one parent reference:

```json
{
  "conversation_id": "conv-branding-branch",
  "title": "Branding Branch",
  "messages": [
    {
      "message_id": "msg-branch-1",
      "role": "user",
      "content": "Continue from the protocol naming checkpoint."
    }
  ],
  "lineage": {
    "parents": [
      {
        "conversation_id": "conv-trust-social-root",
        "message_id": "msg-root-2",
        "link_type": "branch"
      }
    ]
  }
}
```

### Canonical Merge Format

Merge conversations are canonical conversations with two or more parent references:

```json
{
  "conversation_id": "conv-contextbuilder-merge",
  "title": "Context Compiler Merge",
  "messages": [
    {
      "message_id": "msg-merge-1",
      "role": "user",
      "content": "Combine graph selection with Hyperprompt compilation."
    }
  ],
  "lineage": {
    "parents": [
      {
        "conversation_id": "conv-trust-social-root",
        "message_id": "msg-root-2",
        "link_type": "merge"
      },
      {
        "conversation_id": "conv-branding-branch",
        "message_id": "msg-branch-2",
        "link_type": "merge"
      }
    ]
  }
}
```

### Schema Notes

- Imported roots remain valid inputs even when `conversation_id` is missing.
- Canonical files created by ContextBuilder must include `conversation_id`.
- `lineage.parents` is mandatory for canonical files and empty only for canonical roots.
- Parent references always use `conversation_id`, `message_id`, and `link_type`.
- ContextBuilder preserves imported provenance such as `source_file`, `turn_id`, and `source` when exporting to downstream artifacts.

### Normalization Rules

Imported JSON files are normalized into canonical roots before they participate in graph indexing:

1. If a payload is already canonical, ContextBuilder preserves it as-is.
2. If a payload matches the imported root shape and has stable message identity, ContextBuilder derives a deterministic `conversation_id` and adds:

```json
{
  "lineage": {
    "parents": []
  }
}
```

3. Deterministic `conversation_id` generation is based on stable imported provenance:
   - `source_file`
   - `title`
   - ordered `message_id` values
4. Imported payloads that are missing stable message identity or have inconsistent `message_count` are rejected as invalid and must not silently enter the graph.

### Integrity Validation Rules

ContextBuilder now validates both individual payloads and whole-workspace lineage integrity before conversations are persisted or treated as graph-ready:

1. Canonical conversations must include:
   - a non-empty `conversation_id`,
   - valid message payloads with stable `message_id` values,
   - a `lineage.parents` list when stored in canonical form.
2. Duplicate `message_id` values inside the same canonical conversation are rejected.
3. Parent references must always include:
   - `conversation_id`,
   - `message_id`,
   - `link_type` with value `branch` or `merge`.
4. Single-parent conversations must use `branch` links; multi-parent conversations must use `merge` links.
5. Duplicate parent references are rejected.
6. Workspace validation surfaces:
   - duplicate `conversation_id` values across files,
   - missing parent conversations,
   - missing parent `message_id` values,
   - invalid or unreadable JSON files.

### API Validation Behavior

- `GET /api/files` now returns per-file validation metadata plus aggregate diagnostics for the current dialog directory.
- `GET /api/file` returns the requested payload together with the current validation result for that file.
- `GET /api/graph` returns the graph snapshot together with a summary that separates blocking integrity issues from non-blocking lineage diagnostics.
- `GET /api/conversation?conversation_id=...` returns one graph-safe conversation node, its parent and child edges, and compile-target-ready lineage metadata.
- `GET /api/checkpoint?conversation_id=...&message_id=...` returns one checkpoint anchor, its outbound child edges, and compile-target metadata anchored to that exact message.
- `POST /api/file` validates the file name and payload before writing. Valid imported roots are normalized into canonical roots on save; malformed or ambiguous payloads are rejected with structured error codes.

Graph lookup error behavior:

- unknown `conversation_id` values return `404`
- blocked `conversation_id` values return `409` with the blocking diagnostics
- unknown checkpoint anchors return `404`

### Graph Snapshot Model

`GET /api/files` now also returns a `graph` snapshot derived from the same normalized workspace scan. The graph snapshot is the authoritative lineage model for later UI and compile tasks.

The snapshot currently contains:

- `nodes`: graph-safe conversations keyed by unique `conversation_id`
- `edges`: resolved or broken parent links from parent checkpoints to child conversations
- `roots`: canonical root conversation IDs with no parent references
- `blocked_files`: files that remain diagnostics-only because they are invalid JSON, structurally invalid, or blocked by duplicate `conversation_id` values
- `diagnostics`: aggregate graph diagnostics for nodes, edges, and blocked files

Each graph node includes:

- `conversation_id`, `file_name`, `kind`, `title`, and `source_file`
- `checkpoints` derived from ordered messages, each with `message_id`, message metadata, and any outbound child edge IDs
- `parent_edge_ids` and `child_edge_ids`
- node-level diagnostics such as broken parent references

Each graph edge includes:

- the parent conversation and parent `message_id`
- the child conversation and child file
- `link_type` (`branch` or `merge`)
- `status` (`resolved` or `broken`)
- any edge-specific diagnostics

Important graph rules:

1. Missing parent conversations or missing parent messages do not hide an otherwise valid child conversation; the node remains visible with broken-edge diagnostics.
2. Duplicate `conversation_id` values block graph indexing for that identity and move the affected files into `blocked_files`.
3. Invalid JSON files remain visible only through diagnostics and are not indexed as graph nodes.
4. Node, edge, and diagnostic ordering is deterministic so later canvas and compile workflows can build on a stable snapshot.

### Graph Detail API

The graph-specific read API builds on the same snapshot and exposes stable graph identifiers for later UI and compilation workflows:

- `GET /api/graph` returns:
  - `graph`: the full snapshot described above
  - `summary`: counts for nodes, edges, roots, blocked files, total diagnostics, blocking issues, and non-blocking issues
  - `integrity`: the same graph diagnostics split into `blocking` and `non_blocking`
- `GET /api/conversation?conversation_id=...` returns:
  - `conversation`: the indexed node payload
  - `parent_edges` and `child_edges`
  - `integrity`: related diagnostics split into `blocking` and `non_blocking`
  - `compile_target`: deterministic selection metadata for the whole conversation
- `GET /api/checkpoint?conversation_id=...&message_id=...` returns:
  - `conversation`: the owning conversation node
  - `checkpoint`: the selected message anchor
  - `child_edges`: outbound branch or merge edges from that checkpoint
  - `compile_target`: deterministic selection metadata for that exact checkpoint

Current `compile_target` fields are intended to unblock later export tasks without persisting selection state yet:

- `scope`: `conversation` or `checkpoint`
- `target_conversation_id` and optional `target_message_id`
- `lineage_conversation_ids`: deterministic ancestor ordering ending at the selected target
- `lineage_edge_ids`: parent edges included in the selected ancestry
- `lineage_paths`: root-to-target conversation paths, preserving merge provenance as multiple paths
- `root_conversation_ids`: reachable roots for the selected target
- `merge_parent_conversation_ids`: merge parents visible in the selected ancestry
- `unresolved_parent_edge_ids`: broken parent edges that make the lineage incomplete
- `is_lineage_complete`: `false` when any parent edge in the selected ancestry is unresolved

The intended upstream producer is `ChatGPTDialogs`, but any directory with the same JSON contract is valid.

## Repository Layout

- `viewer/server.py`: local viewer API and static file server
- `viewer/index.html`: browser UI for browsing and editing dialogs
- `Makefile`: local server entrypoint

## Scope Boundary

- `ChatGPTDialogs`: extractor, fixtures, HTML-to-JSON contract docs
- `ContextBuilder`: viewer-web and viewer-api
- `capture-browser`: separate concern, intentionally not part of this repository
