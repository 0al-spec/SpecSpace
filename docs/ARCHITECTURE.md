# ContextBuilder — Engineering Documentation

> See also: [README.md](../README.md) for quick start, API reference, and file contract · [PROBLEMS.md](PROBLEMS.md) for known issues

## What is ContextBuilder

ContextBuilder is a local-first tool for working with conversation lineage graphs. It reads JSON conversation files from disk, builds a directed graph of their relationships (root, branch, merge), lets users visually navigate the graph, select a lineage path, and compile the selection into a single Markdown artifact via an external Hyperprompt compiler.

There are no cloud dependencies, no databases, no auth. The filesystem is the only persistence layer.

Additionally, ContextBuilder supports an optional **SpecGraph** mode — visualization of YAML specification nodes with dependency edges, maturity tracking, and gap analysis.

---

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Browser (React)                     │
│                                                            │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │ Sidebar  │  │ ReactFlow    │  │ Inspector Panel        ││
│  │ (files,  │  │ Canvas       │  │ (conversation detail / ││
│  │  modes)  │  │ (graph viz)  │  │  spec detail)          ││
│  └──────────┘  └──────────────┘  └────────────────────────┘│
│  ┌──────────────────┐  ┌──────────────────────────────────┐│
│  │ Search (Cmd+K)   │  │ AgentChat (mock, future)         ││
│  └──────────────────┘  └──────────────────────────────────┘│
└────────────────────────┬───────────────────────────────────┘
                         │ HTTP (localhost)
                         │ /api/*
┌────────────────────────▼─────────────────────────────────────┐
│                   Python HTTP Server                         │
│                                                              │
│  ┌─────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Graph Index │  │ Validation │  │ Export & Compile       │ │
│  │ (on every   │  │ (schema.py)│  │ (Markdown + .hc files  │ │
│  │  request)   │  │            │  │  → Hyperprompt binary) │ │
│  └─────────────┘  └────────────┘  └────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ SpecGraph (optional, --spec-dir)                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                           │
                    Filesystem
          ┌────────────────┼───────────────┐
          ▼                ▼               ▼
       *.json           *.yaml          export/
     (canonical      (spec nodes)      (compiled
   conversations)                      artifacts)
                    
```

---

## Data Model

### Conversations

Each JSON file on disk represents a **conversation** — an ordered list of messages with metadata.

Three kinds:
- **Root** — standalone conversation, no parents
- **Branch** — forked from a single parent message (one parent reference)
- **Merge** — combines context from multiple parents (2+ parent references)

**Canonical conversation structure:**
```json
{
  "conversation_id": "stable-hash",
  "title": "...",
  "lineage": {
    "parents": [
      {
        "conversation_id": "parent-id",
        "message_id": "fork-point",
        "link_type": "branch"
      }
    ]
  },
  "messages": [
    {
      "message_id": "msg-001",
      "role": "user",
      "content": "..."
    }
  ]
}
```

**Graph concepts:**
- **Node** = conversation (with checkpoints = key messages)
- **Edge** = parent reference (branch or merge link)
- **Lineage path** = chain of edges from root to a target conversation, through all ancestors
- **Compile target** = a conversation + optional checkpoint, defining the scope of what gets exported

### Spec Nodes (optional)

YAML files describing specification items with fields like `id`, `title`, `status`, `maturity`, `depends_on`, `refines`, `relates_to`, acceptance criteria, evidence, and gap metrics.

---

## Backend (Python)

Four Python modules, no external dependencies beyond PyYAML and stdlib.

### `viewer/schema.py` — Data Validation

Core responsibility: classify, normalize, and validate conversation payloads.

Key operations:
- **classify_conversation()** → `"canonical-root"` | `"canonical-branch"` | `"canonical-merge"` | `"imported-root"` | `"invalid"`
- **normalize_conversation()** — converts imported-root to canonical form (derives stable `conversation_id` from hash of source_file + title + message_ids, adds empty lineage)
- **validate_conversation()** — runs full validation: required fields, no duplicate message IDs, lineage consistency (single parent = branch, multiple = merge)
- **validate_workspace()** — cross-file checks: duplicate conversation IDs, missing parent conversations, missing parent messages

### `viewer/canonicalize.py` — Batch Import Tool

CLI tool: `python3 viewer/canonicalize.py <source_dir> <output_dir>`

Reads a `lineage.json` manifest (optional) from source_dir, applies canonical metadata to each JSON file, validates, writes output. Used to prepare imported ChatGPT conversation exports for graph indexing.

### `viewer/specgraph.py` — Spec Graph Builder

Loads `*.yaml` spec files, builds a graph with nodes and edges (`depends_on`, `refines`, `relates_to`). Computes gap metrics (evidence gaps, input gaps, execution gaps). Returns data in the same shape as the conversation graph API for frontend reuse.

### `viewer/server.py` — HTTP Server & Graph Engine

The largest module. Threaded HTTP server (stdlib `http.server`) that:

1. **Indexes the workspace on every request** — no caching, no stale state. External tools can modify files freely.
2. **Builds the graph** — nodes, edges, roots, diagnostics, blocking/non-blocking integrity split.
3. **Resolves lineage** — DFS traversal of ancestors to compute compile targets (ordered lineage, merge parents, root identification, cycle detection).
4. **Exports** — renders each message as Markdown with YAML front-matter, generates `provenance.json`, `provenance.md`, and `root.hc` (Hyperprompt input file).
5. **Compiles** — invokes the external Hyperprompt binary to produce `compiled.md`.
6. **Serves static files** — React dist/ with SPA fallback.

**API Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/graph` | Full graph: nodes, edges, roots, diagnostics |
| GET | `/api/conversation?conversation_id=` | Node detail + compile target + integrity |
| GET | `/api/checkpoint?conversation_id=&message_id=` | Checkpoint detail + compile target |
| GET | `/api/files` | Workspace listing with per-file validation |
| GET | `/api/file?name=` | Raw JSON + validation for a single file |
| GET | `/api/capabilities` | Feature flags (spec_graph enabled?) |
| GET | `/api/spec-graph` | Spec graph (if --spec-dir) |
| GET | `/api/spec-node?id=` | Single spec node detail |
| GET | `/api/spec-watch` | SSE stream — file change notifications |
| POST | `/api/file` | Write/overwrite a conversation file |
| POST | `/api/export` | Export lineage as Markdown + .hc |
| POST | `/api/compile` | Export + invoke Hyperprompt compiler |
| DELETE | `/api/file?name=` | Delete a conversation file |

**Startup:**
```bash
python3 viewer/server.py --port 8001 --dialog-dir <canonical_json_dir> [--spec-dir <yaml_dir>]
```

---

## Frontend (React + TypeScript)

Stack: React 19, ReactFlow (graph visualization), Dagre (layout), Vite (bundler), assistant-ui (chat primitives).

### Component Tree

```
App.tsx                          ← orchestrator, all global state
├── Sidebar.tsx                  ← left panel: mode switch, file/spec list
├── ReactFlow canvas             ← graph visualization
│   ├── ConversationNode.tsx     ← collapsed conversation node
│   ├── SpecNode.tsx             ← spec node with status/maturity
│   └── (MessageNode, etc.)      ← expanded message sub-nodes
├── SpecInspector.tsx            ← right panel: spec detail (resizable)
│   └── (or InspectorOverlay)    ← right panel: conversation detail
├── SearchPalette.tsx            ← Cmd+K search/command palette
└── AgentChat.tsx                ← modal AI chat (mock adapter)
```

### Data Flow

1. **useGraphData()** — fetches `/api/graph`, transforms to ReactFlow nodes/edges, manages expand/collapse state (persisted in sessionStorage)
2. **useSpecGraphData()** — fetches `/api/spec-graph`, applies layout per view mode (canonical/linear/tree), listens to SSE `/api/spec-watch` for auto-refresh
3. **layoutGraph.ts** — layout algorithms:
   - `computeBasePositions()` — Dagre hierarchical layout (LR direction)
   - `computeLinearPositions()` — custom: cycle-breaking → topological sort → longest-path ranks → lane assignment
   - `expandedNodeHeight()` — dynamic height based on checkpoint count

### State Management

No external state library. State lives in:
- **App.tsx** — selected nodes, graph mode, compile target, modal visibility
- **sessionStorage** — viewport position, expand state, selections (survives refresh)
- **React Context** — CompileTargetContext (broadcast to all nodes)

### View Modes (Spec Graph)

| Mode | Layout | Description |
|------|--------|-------------|
| Canonical | Dagre | Raw edges as stored |
| Linear | Custom | Left-to-right flow, cycle-breaking, topo sort |
| Tree | Dagre (inverted refines) | Refinement hierarchy + optional cross-links |

### Keyboard Shortcuts

- `Cmd+K` / `Ctrl+K` — toggle search palette
- `F` — fit all nodes to view
- Arrow keys — navigate search results
- `Escape` — close modals

---

## Export & Compile Pipeline

The core value proposition — turning a graph selection into a compiled context artifact.

```
User selects target conversation (+ optional checkpoint)
                    │
                    ▼
        build_compile_target()
        ├── DFS ancestor traversal
        ├── Ordered lineage_conversation_ids (oldest-first)
        ├── Identify roots, merge parents
        └── Check for unresolved edges
                    │
                    ▼
        export_graph_nodes()
        ├── Clean export/{target}/ directory
        ├── For each conversation in lineage:
        │   └── nodes/{conv_id}/{index}_{msg_id}.md
        │       (Markdown with YAML front-matter comment)
        ├── provenance.json (machine-readable metadata)
        ├── provenance.md (human-readable summary)
        └── root.hc (Hyperprompt source file)
                    │
                    ▼
        invoke_hyperprompt()
        ├── Resolve binary path (multiple fallback candidates)
        └── Run: hyperprompt root.hc --root <dir> --output compiled.md
                    │
                    ▼
        compiled.md + manifest.json
```

Key design decisions:
- **Deterministic exports** — directory is cleaned on each export for reproducibility
- **Provenance tracking** — every exported Markdown includes source conversation_id, message_id, role
- **External compiler** — Hyperprompt is a separate binary; ContextBuilder generates input and surfaces compiler errors

---

## Test Suite

13 test files covering:

| Area | Files | What's tested |
|------|-------|---------------|
| Schema | `test_schema.py`, `test_normalization.py`, `test_validation.py`, `test_integrity.py` | Classification, normalization, validation, error paths |
| Canonicalization | `test_canonicalize.py` | Manifest application, root normalization |
| Graph | `test_graph.py`, `test_reindex.py` | Workspace indexing, hot-reload (new/deleted files) |
| API | `test_api_contracts.py`, `test_selection.py` | HTTP endpoints, compile target selection |
| Export/Compile | `test_export.py`, `test_compile.py` | Markdown rendering, .hc generation, Hyperprompt invocation |
| SpecGraph | `test_specgraph.py` | YAML ingestion, spec graph construction |
| Smoke | `test_smoke.py` | Project structure, required files exist |

Fixtures live in `real_examples/` (real conversation data) and `tests/conftest.py`.

Run: `make test`

---

## Project Commands (Makefile)

| Command | What it does |
|---------|-------------|
| `make quickstart` | Canonicalize + start API + start UI |
| `make canon` | Canonicalize with default paths |
| `make api` | Start Python API server (port 8001) |
| `make ui` | Start Vite dev server (port 5173) |
| `make dev` | Start both API and UI |
| `make test` | Run all tests |
| `make lint` | py_compile on all Python files |
| `make stop` | Kill servers on ports 8001/5173 |

---

## Key Design Principles

1. **Filesystem as truth** — no database, graph is rebuilt from disk on every API call
2. **No caching** — guarantees consistency when files are modified externally
3. **Deterministic output** — same input always produces identical export
4. **Non-blocking diagnostics** — graph surfaces warnings without blocking operations (missing parents are non-blocking; broken references within a lineage block export)
5. **Separation of concerns** — ContextBuilder owns graph structure and export; Hyperprompt owns compilation; the browser owns visualization
6. **Local-first** — everything runs on localhost, no cloud, no auth
