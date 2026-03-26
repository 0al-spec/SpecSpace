# ContextBuilder

ContextBuilder is a local graph viewer and context compiler for conversation JSON files. It reads a directory of dialog JSON files, builds a lineage graph of roots, branches, and merges, lets you select a thought direction, and compiles that selection into a Hyperprompt-backed Markdown context artifact ready for an external LLM or agent.

## Scope Boundaries

| Concern | Owner |
|---------|-------|
| Extracting conversations from browser HTML | `ChatGPTDialogs` |
| Graph structure, validation, selection, export, compile orchestration | **ContextBuilder** (this repo) |
| Running LLMs, executing prompts, agent workflows | External — ContextBuilder hands off a compiled Markdown artifact |
| Browser capture, cloud sync, semantic retrieval | Out of scope for v1 |

ContextBuilder does not execute models. Its output is a deterministic Markdown file you hand to an external agent.

---

## Quick Start

Point the viewer at a directory containing dialog JSON files:

```bash
make serve DIALOG_DIR=/absolute/path/to/dialogs
```

Then open:

```
http://localhost:8000/viewer/index.html
```

Or run the server directly (with a custom Hyperprompt binary path):

```bash
python3 viewer/server.py --port 8000 --dialog-dir /path/to/dialogs \
  --hyperprompt-binary /path/to/hyperprompt
```

### Development Mode (React UI + API)

```bash
make dev DIALOG_DIR=/path/to/dialogs
# API on :8001, React UI on :5173
```

---

## Graph-to-Context Pipeline

```
JSON conversations on disk
        │
        ▼
  ContextBuilder API          GET /api/graph
  (graph index +              GET /api/conversation
   validation)                GET /api/checkpoint
        │
        ▼
  Select branch target        POST /api/export
  → Export lineage nodes      → export/{target}/nodes/*.md
  → Generate root.hc          → export/{target}/root.hc
        │
        ▼
  Compile with Hyperprompt    POST /api/compile
        │
        ▼
  compiled.md                 ← hand to external agent
```

1. **Graph index** — ContextBuilder reads all JSON files in the dialog directory, validates and normalizes them, and builds an in-memory lineage graph.
2. **Export** — You select a conversation or checkpoint as the compile target. ContextBuilder writes each ancestor conversation as a deterministic Markdown file under `export/{target}/nodes/` and generates `export/{target}/root.hc` with exactly one depth-0 root node. Provenance, conversation labels, and node includes are emitted as children under that root in lineage order.
3. **Compile** — Hyperprompt reads `root.hc`, resolves the included node files, and writes `export/{target}/compiled.md`. That file is the final context artifact.

### Export Directory Layout

```
{dialog-dir}/export/{target}/
├── nodes/
│   ├── {conv-id-1}.md
│   ├── {conv-id-2}.md
│   └── ...
├── provenance.md   ← compile-target provenance included in compiled output
├── provenance.json ← machine-readable provenance for traceability/audit
├── root.hc          ← Hyperprompt root file
├── compiled.md      ← final compiled artifact
└── manifest.json    ← compiler manifest (written by Hyperprompt)
```

The export directory is deterministically regenerated on each export. Prior contents are removed.

---

## Hyperprompt Dependency

ContextBuilder calls the [Hyperprompt](https://github.com/0AL/Hyperprompt) compiler to produce the final Markdown artifact.

### Build Hyperprompt

```bash
cd /path/to/Hyperprompt
swift build -c release
# binary at one of:
#   .build/release/hyperprompt
#   .build/arm64-apple-macosx/release/hyperprompt
```

### Pass the Binary to ContextBuilder

```bash
python3 viewer/server.py \
  --dialog-dir /path/to/dialogs \
  --hyperprompt-binary /path/to/Hyperprompt/.build/release/hyperprompt
```

If `--hyperprompt-binary` is not provided (or uses the default value), ContextBuilder resolves Hyperprompt in this order:

1. `.build/release/hyperprompt`
2. `.build/arm64-apple-macosx/release/hyperprompt`
3. `.build/x86_64-apple-macosx/release/hyperprompt`
4. `.build/*/release/hyperprompt` (other architecture-specific layouts)
5. `deps/hyperprompt` inside this repository

If no candidate exists, `POST /api/compile` returns `422` with `compile.checked_paths` so you can see exactly which paths were attempted. The export directory remains intact so you can inspect the generated `.hc` file.

---

## End-to-End Handoff Verification

Use this runbook when you need a reproducible path from local JSON conversations to a compiled artifact ready for an external agent.

### 1. Preflight Checks

1. Start from canonical JSON conversations (or run `make canon` first).
2. Start the server:
   ```bash
   make serve DIALOG_DIR=/absolute/path/to/canonical_json
   ```
3. If you need a custom Hyperprompt binary path, run the server directly:
   ```bash
   python3 viewer/server.py \
     --port 8000 \
     --dialog-dir /absolute/path/to/canonical_json \
     --hyperprompt-binary /absolute/path/to/hyperprompt
   ```
4. Confirm API health by opening `http://localhost:8000/viewer/index.html` and checking that the graph loads.

### 2. Select and Compile a Target

1. In the graph, select a conversation or checkpoint.
2. Trigger compile from the checkpoint inspector, or call the API:
   ```bash
   curl -sS -X POST http://localhost:8000/api/compile \
     -H "Content-Type: application/json" \
     -d '{"conversation_id":"<target-conversation-id>","message_id":"<optional-checkpoint-id>"}'
   ```
3. Record `export_dir`, `hc_file`, and `compile.compiled_md` from the response.

### 3. Verify Artifacts

For the returned `{export_dir}`, verify all expected outputs:

1. `nodes/*.md` exists and contains one deterministic file per exported lineage conversation.
2. `root.hc` exists, has exactly one depth-0 root node, and references node files in lineage order.
3. `compiled.md` exists and is non-empty.
4. `manifest.json` exists (when Hyperprompt compile succeeds).

Minimal shell verification:

```bash
ls -la "{export_dir}/nodes"
test -s "{export_dir}/root.hc"
test -s "{export_dir}/compiled.md"
test -s "{export_dir}/manifest.json"
```

### 4. Failure Triage

- `404` from `POST /api/compile`: target `conversation_id` or `message_id` does not exist.
- `409` from `POST /api/compile`: target is blocked by integrity errors; inspect graph diagnostics and fix lineage/schema issues first.
- `422` with `compile.error`: Hyperprompt binary missing or compile-time failure; inspect `compile.checked_paths`, verify `--hyperprompt-binary` path (if set), and rerun.

When compile fails, inspect `root.hc` and exported node Markdown files in `{export_dir}` before retrying.

### 5. External Agent Handoff Checklist

Before handing off to an external LLM/agent, package:

1. `compiled.md` (primary context artifact).
2. `manifest.json` (provenance and compile metadata).
3. Target metadata used for compilation (`conversation_id`, optional `message_id`, and timestamp).
4. Optional: `root.hc` and `nodes/` for auditability/debugging.

Recommended handoff note template:

```
Context artifact: /absolute/path/to/export/<target>/compiled.md
Manifest: /absolute/path/to/export/<target>/manifest.json
Compile target: conversation_id=<id>, message_id=<id-or-none>
Compiled at: YYYY-MM-DDTHH:MM:SSZ
```

---

## Graph-First Viewer

The viewer opens in a graph-first mode:

- The main canvas is driven by `GET /api/graph` and renders workspace lineage.
- Root, branch, and merge conversations have distinct node states.
- Broken lineage is visible as broken edges and warning states, not silently hidden.
- Drag the canvas background to pan; click a node to open its transcript and inspector.
- The inspector shows lineage edges, integrity details, and a checkpoint inventory.
- Click `Inspect checkpoint` on a message to focus that checkpoint and review its workflow metadata.
- Branching from the active checkpoint is available from the checkpoint inspector.
- Compile actions are accessible from the checkpoint inspector once a target is selected.
- The sidebar file list remains available for file-level actions (open, delete, save).

---

## File Contract

### Imported Root Format

Files produced by `ChatGPTDialogs` (or any compatible exporter):

```json
{
  "title": "Conversation Title",
  "source_file": "/absolute/path/to/file.html",
  "message_count": 42,
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Imported files may omit `conversation_id` and lineage metadata. ContextBuilder normalizes them into canonical roots on first save.

### Canonical Conversation Format

Canonical conversations created or normalized by ContextBuilder:

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

- `message_id` is the canonical anchor for graph lineage and export artifacts.
- `turn_id` and `source` are preserved imported provenance when available.

### Canonical Branch Format

```json
{
  "conversation_id": "conv-branding-branch",
  "title": "Branding Branch",
  "messages": [
    { "message_id": "msg-branch-1", "role": "user", "content": "Continue from the protocol naming checkpoint." }
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

```json
{
  "conversation_id": "conv-contextbuilder-merge",
  "title": "Context Compiler Merge",
  "messages": [
    { "message_id": "msg-merge-1", "role": "user", "content": "Combine graph selection with Hyperprompt compilation." }
  ],
  "lineage": {
    "parents": [
      { "conversation_id": "conv-trust-social-root", "message_id": "msg-root-2", "link_type": "merge" },
      { "conversation_id": "conv-branding-branch", "message_id": "msg-branch-2", "link_type": "merge" }
    ]
  }
}
```

### Schema Rules

- Imported roots are valid inputs even when `conversation_id` is absent.
- Canonical files created by ContextBuilder must include `conversation_id`.
- `lineage.parents` is mandatory for canonical files; empty only for canonical roots.
- Parent references always require `conversation_id`, `message_id`, and `link_type`.
- `link_type` is `branch` for single-parent conversations and `merge` for multi-parent.
- ContextBuilder preserves imported provenance (`source_file`, `turn_id`, `source`) in exports.

### Normalization Rules

1. Already-canonical payloads are preserved as-is.
2. Imported roots with stable message identity get a deterministic `conversation_id` and `lineage: { parents: [] }` added on save.
3. `conversation_id` is derived from `source_file`, `title`, and ordered `message_id` values.
4. Payloads missing stable message identity or with inconsistent `message_count` are rejected.

---

## Integrity Validation

ContextBuilder validates individual payloads and whole-workspace lineage before persisting or graph-indexing any conversation:

1. Canonical conversations require a non-empty `conversation_id`, valid messages with stable `message_id` values, and a `lineage.parents` list.
2. Duplicate `message_id` values within one conversation are rejected.
3. Parent references must include `conversation_id`, `message_id`, and `link_type`.
4. Single-parent conversations use `branch` links; multi-parent use `merge` links.
5. Duplicate parent references are rejected.
6. Workspace validation surfaces: duplicate `conversation_id` across files, missing parent conversations, missing parent `message_id` values, and invalid JSON.

---

## API Reference

### Read APIs

| Endpoint | Description |
|----------|-------------|
| `GET /api/files` | Workspace listing with per-file validation metadata and graph snapshot |
| `GET /api/graph` | Full graph snapshot, summary counts, and integrity split (blocking / non-blocking) |
| `GET /api/file?name=...` | One file payload with its validation result |
| `GET /api/conversation?conversation_id=...` | One graph node with edges, integrity, and compile target metadata |
| `GET /api/checkpoint?conversation_id=...&message_id=...` | One checkpoint anchor with child edges and compile target metadata |

### Write APIs

| Endpoint | Body | Description |
|----------|------|-------------|
| `POST /api/file` | `{ name, data, overwrite? }` | Validate and save a conversation file |
| `DELETE /api/file?name=...` | — | Delete a conversation file |

### Compile APIs

| Endpoint | Body | Description |
|----------|------|-------------|
| `POST /api/export` | `{ conversation_id, message_id? }` | Export lineage nodes to disk and generate `root.hc` |
| `POST /api/compile` | `{ conversation_id, message_id? }` | Export lineage nodes and invoke the Hyperprompt compiler |

**Export response fields:**

- `export_dir` — absolute path to the export directory
- `hc_file` — absolute path to `root.hc`
- `provenance_md` — absolute path to `provenance.md`
- `provenance_json` — absolute path to `provenance.json`
- `node_count` — total number of exported node markdown files
- `conversations` — exported conversations with node directories and file lists
- `compile_target` — the compile target metadata used

**Compile response fields** (in addition to export fields):

- `compile.compiled_md` — absolute path to `compiled.md`
- `compile.manifest_json` — absolute path to `manifest.json`
- `compile.provenance_md` — absolute path to `provenance.md`
- `compile.provenance_json` — absolute path to `provenance.json`
- `compile.error` — present only on failure, with a human-readable description

### Error Behavior

- Unknown `conversation_id` → `404`
- Conversation blocked by integrity errors → `409` with diagnostics
- Unknown checkpoint anchor → `404`
- Hyperprompt binary missing or compile failure → `422` with `compile.error`

---

## Graph Snapshot Model

`GET /api/graph` returns:

- `graph.nodes` — graph-safe conversations keyed by `conversation_id`
- `graph.edges` — resolved or broken parent links between checkpoints and child conversations
- `graph.roots` — canonical root `conversation_id` values with no parents
- `graph.blocked_files` — files excluded from the graph due to validation errors
- `graph.diagnostics` — aggregate counts for nodes, edges, roots, blocked files, and issues
- `summary` — counts for nodes, edges, roots, blocked files, total diagnostics, blocking issues, non-blocking issues
- `integrity` — diagnostics split into `blocking` and `non_blocking`

Each graph node includes:

- `conversation_id`, `file_name`, `kind` (root / branch / merge), `title`, `source_file`
- `checkpoints` — ordered messages, each with `message_id`, metadata, and outbound child edge IDs
- `parent_edge_ids` and `child_edge_ids`
- node-level diagnostics for broken parent references

Each graph edge includes:

- parent conversation and `message_id`
- child conversation and file
- `link_type` (`branch` or `merge`)
- `status` (`resolved` or `broken`)
- edge-specific diagnostics

### Compile Target Fields

Returned by `GET /api/conversation` and `GET /api/checkpoint`:

| Field | Description |
|-------|-------------|
| `scope` | `conversation` or `checkpoint` |
| `target_conversation_id` | Selected conversation |
| `target_message_id` | Selected message anchor (checkpoint scope only) |
| `lineage_conversation_ids` | Deterministic ancestor ordering ending at target |
| `lineage_edge_ids` | Parent edges included in the ancestry |
| `lineage_paths` | Root-to-target paths, preserving merge provenance |
| `root_conversation_ids` | Reachable roots for the selected target |
| `merge_parent_conversation_ids` | Merge parents visible in ancestry |
| `unresolved_parent_edge_ids` | Broken parent edges making lineage incomplete |
| `is_lineage_complete` | `false` when any ancestor edge is unresolved |

---

## Repository Layout

```
ContextBuilder/
├── viewer/
│   ├── server.py          # Local API and static file server (Python)
│   ├── schema.py          # Schema validation helpers
│   ├── canonicalize.py    # Batch import normalization script
│   └── app/               # React + TypeScript UI (Vite)
│       ├── src/           # React components and graph canvas
│       └── dist/          # Built UI assets (served by server.py)
├── tests/                 # Python unit and integration tests
├── real_examples/         # Example dialog JSON fixtures
├── Makefile               # Developer entrypoints
└── README.md
```

---

## Makefile Targets

| Target | Purpose |
|--------|---------|
| `make serve DIALOG_DIR=...` | Start the combined API + static file server |
| `make dev DIALOG_DIR=...` | Start API on :8001 and React dev server on :5173 |
| `make api DIALOG_DIR=...` | Start API only |
| `make ui` | Start React dev server only |
| `make canonicalize DIALOG_DIR=... OUTPUT_DIR=...` | Batch-normalize imported JSON to canonical form |
| `make canon DIALOG_DIR=...` | Alias for `canonicalize` with default `OUTPUT_DIR=/tmp/canonical_json` |
| `make test` | Run all Python tests |
| `make lint` | Syntax-check Python source files |

---

## Contributor Guide

### Prerequisites

- Python 3.11+
- Node.js 18+ (for the React UI)
- [Hyperprompt](https://github.com/0AL/Hyperprompt) compiler binary (for compile tests and runtime compile)

### Run Tests

```bash
make test
```

### Lint

```bash
make lint
```

### Understand the Pipeline

1. `viewer/schema.py` — canonical schema rules and validation helpers used by the server and tests.
2. `viewer/canonicalize.py` — batch normalization for imported root JSON files.
3. `viewer/server.py` — all HTTP handlers, graph indexing, export, and compile orchestration.
4. `viewer/app/src/` — React graph canvas, inspector panels, compile affordances.
5. `tests/` — unit tests for schema, graph indexing, API handlers, export pipeline, and compile integration.

### Adding a New Conversation Kind

1. Add schema rules to `viewer/schema.py`.
2. Update `build_graph_index` in `viewer/server.py` to handle the new kind.
3. Add fixture files under `real_examples/` or `tests/fixtures/`.
4. Add regression tests in `tests/`.
