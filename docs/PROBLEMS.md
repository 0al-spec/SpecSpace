# ContextBuilder — Analysis of Problems and Shortcomings

---

## 1. Performance: Full Workspace Re-read on Every Request

**The biggest architectural problem.** Every API call — `/api/graph`, `/api/conversation`, `/api/files`, `/api/export`, even `/api/file?name=X` for a single file — triggers `collect_workspace_listing()`, which:

1. Scans the directory (`glob("*.json")`)
2. Reads and parses **every** JSON file
3. Validates each file individually
4. Runs cross-file workspace validation (`validate_workspace`)
5. Builds the entire graph snapshot

For a workspace with 50 conversations, every click in the UI causes 50+ file reads, 50+ JSON parses, and O(n²) validation.

**Impact:** UI latency grows linearly with workspace size. A single file detail request (`/api/file?name=one.json`) does the same work as fetching the entire graph.

**Root cause:** Intentional design ("no caching, no stale state"), but the tradeoff is not well-calibrated. Filesystem-as-truth doesn't require re-reading everything — mtime-based invalidation or request-scoped memoization would preserve correctness while dramatically reducing I/O.

---

## 2. `server.py` is a Monolith (~1500 lines)

All backend logic lives in a single file:
- HTTP routing
- Graph indexing and traversal
- Export/compilation pipeline
- Hyperprompt binary resolution
- Provenance generation
- Static file serving
- SSE file watching

This makes it hard to navigate, test in isolation, and modify. Functions like `build_graph_snapshot` (200 lines), `export_graph_nodes` (100+ lines), and the 300-line `ViewerHandler` class are all entangled.

**Related:** The module uses `dict[str, Any]` everywhere instead of typed data classes. Graph nodes, edges, checkpoints, compile targets — all untyped dicts. This means:
- No IDE autocompletion for fields
- No static checking that field names are correct
- Easy to introduce typos (`converastion_id` would silently pass)
- `schema.py` defines `CompileTargetPayload` as a TypedDict but it's not actually used for type enforcement

---

## 3. Duplicated Validation Logic

`collect_normalization_errors()` and `collect_canonical_validation_errors()` in `schema.py` share nearly identical message validation loops (lines 254–310 vs 344–399):

```python
# Both functions do this:
for index, message in enumerate(messages):
    if not _is_mapping(message): ...
    missing_message_fields = [field for field in MESSAGE_REQUIRED_FIELDS if field not in message]
    if missing_message_fields: ...
    if not _is_non_empty_string(message.get("message_id")): ...
    if not _is_non_empty_string(message.get("role")): ...
    if not isinstance(message.get("content"), str): ...
    message_ids.append(...)
if len(message_ids) != len(set(message_ids)): ...
```

~60 lines of nearly identical code. If message validation rules change, both places need to be updated.

---

## 4. Hardcoded Paths to Developer Machine

```python
DEFAULT_HYPERPROMPT_BINARY = "/Users/egor/Development/GitHub/0AL/Hyperprompt/.build/release/hyperprompt"
```

`server.py:958` — an absolute path to a specific user's machine. The fallback resolution logic (`_default_hyperprompt_fallbacks`) also builds paths relative to this hardcoded string. This makes the project non-portable: any other developer would need to override this with `--hyperprompt-binary`.

Similarly, the `Makefile` defaults:
```makefile
CANONICAL_DIR := $(HOME)/Development/GitHub/ChatGPTDialogs/canonical_json
SPEC_DIR := $(HOME)/Development/GitHub/0AL/SpecGraph/specs/nodes
```

These assume a specific directory layout on the developer's machine.

---

## 5. Security: No Path Traversal Protection in `dialog_path_for_name`

```python
def dialog_path_for_name(dialog_dir: Path, name: str) -> Path:
    return (dialog_dir / name).resolve()
```

The function itself doesn't validate that the resolved path stays inside `dialog_dir`. Protection exists in `safe_dialog_path()`, but only for HTTP handlers. Internal functions (`load_workspace_payloads`, `validate_write_request`) call `dialog_path_for_name` directly.

`safe_dialog_path()` does check path containment, but **after** the file name validation. A malicious file name like `../../etc/passwd` would be caught by `validate_file_name` (requires `.json` suffix), but the overall pattern is fragile — security relies on multiple independent checks all being correct.

---

## 6. SSE File Watcher: Polling with `time.sleep(1)` in a Thread

`handle_spec_watch()` (line 1407) blocks a server thread indefinitely:

```python
while True:
    time.sleep(1)
    current_mtimes = get_mtimes(self.server.spec_dir)
    if current_mtimes != last_mtimes: ...
```

Each connected browser tab holds one thread permanently. With `ThreadingHTTPServer` and a default thread pool, a handful of tabs can exhaust server capacity. There's no timeout, no max-connections limit, and no graceful shutdown.

The polling approach (1-second interval, full directory scan) is also wasteful compared to OS-level file watching (`fsevents` on macOS, `inotify` on Linux).

---

## 7. Frontend: God Component in `App.tsx`

`App.tsx` (590 lines) manages:
- Graph mode switching
- Conversation selection
- Message selection
- Compile target tracking
- Chat modal state
- Search modal state
- Edge highlighting
- Search match dimming
- Viewport persistence
- Pan/zoom operations
- Node position state
- Keyboard shortcuts
- Capabilities check

That's 15+ concerns in one component. State is passed down through 5+ levels of props. No state management library, no reducer pattern, no custom hooks to extract logic groups.

**Consequence:** Every state change potentially re-renders the entire component tree. The `displayNodes` and `displayEdges` memos help, but adding any new feature requires touching this already-overloaded file.

---

## 8. Frontend: No Error Boundaries

No `ErrorBoundary` components anywhere. A runtime error in any component (e.g., a null dereference in `SpecInspector` when API returns unexpected data) crashes the entire app with a white screen. Given that the app renders external data (conversation JSON, spec YAML), defensive rendering is important.

---

## 9. No TypeScript Strict Mode / No Lint Configuration

`tsconfig.json` is present but there's no ESLint config, no Prettier config, and the TypeScript strictness level isn't enforced across the project. The frontend has `as` casts (e.g., `node.data as { kind?: string }` in `App.tsx:81`) that would be unnecessary with proper generics.

---

## 10. `useGraphData` and `useSpecGraphData` Don't Share Patterns

Both hooks follow the same pattern:
1. Fetch from API
2. Transform to ReactFlow nodes/edges
3. Compute layout
4. Return `{ nodes, edges, loading, error, refresh }`

But they're completely independent implementations with different internal structures, different API response types, and different layout strategies. There's no shared base hook or data-fetching abstraction.

`useSpecGraphData` has SSE auto-refresh; `useGraphData` doesn't. This inconsistency means conversation graph users must manually refresh after external changes.

---

## 11. No API Versioning or Contract Validation

The API has no versioning (`/api/graph` not `/api/v1/graph`). If the response shape changes, all clients break. There's no OpenAPI spec, no JSON schema validation on the client side, and no contract tests between frontend and backend (the test files test the Python API layer, not the HTTP contract as consumed by the frontend).

---

## 12. `shutil.rmtree` on Export Without Confirmation

```python
if export_dir.exists():
    shutil.rmtree(export_dir)
```

`export_graph_nodes()` (line 879) deletes the entire export directory recursively before writing. If `export_dir` points to the wrong place (due to a bug in path construction), this could delete important data. There's no safety check that the directory is actually an export directory (e.g., checking for a marker file).

---

## 13. SHA-1 for Conversation ID Derivation

```python
digest = hashlib.sha1(
    json.dumps(basis, ensure_ascii=False, sort_keys=True).encode("utf-8")
).hexdigest()[:12]
```

SHA-1 is deprecated for security-sensitive contexts. While this isn't a security use case (it's a content hash for stable IDs), the 12-character truncation increases collision probability. For a local tool this is low-risk, but it's still a code smell.

---

## 14. No Graceful Degradation When Hyperprompt is Missing

If the Hyperprompt binary isn't found, `/api/compile` returns an error. But the UI doesn't surface this clearly — the user has to click "compile" and read an error response. There's no startup check, no warning in the sidebar, and no `/api/capabilities` flag for compile availability.

---

## 15. AgentChat is a Mock

`AgentChat.tsx` uses a hardcoded mock adapter with fake responses. The chat button is visible and clickable in the UI, which creates the impression of functionality that doesn't exist. There's no backend endpoint (`/api/agent`), no LLM integration, and no plan for how this would work.

---

## 16. Frontend Build Not Verified in CI

There's no CI configuration (no GitHub Actions, no pre-commit hooks). The `Makefile` has `make lint` (py_compile only) and `make test` (Python tests only). There's no:
- Frontend build check (`npm run build`)
- TypeScript type checking (`tsc --noEmit`)
- Frontend tests
- Linting (Python or TypeScript)

---

## 17. Inconsistent Data Flow: Double Work on Conversation Detail

When a user clicks a conversation node:
1. Frontend calls `/api/conversation?conversation_id=X`
2. Server calls `collect_workspace_listing()` → reads ALL files, builds full graph
3. Server finds the one node, builds compile_target (another DFS traversal)
4. Returns the result

The graph was already built for the initial `/api/graph` call. Building it again from scratch for a detail request is wasteful. The frontend could pass the already-known graph structure, or the server could cache the last graph snapshot.

---

## 18. `spec-watch` SSE and `spec-graph` Re-read Are Independent

When the SSE endpoint detects a file change, it sends a `change` event. The frontend then calls `/api/spec-graph`, which re-reads all YAML files from scratch. But the SSE endpoint already computed `get_mtimes()` — it knows *which* files changed. This information is discarded; the frontend does a full re-fetch regardless.

---

## 19. No Pagination or Lazy Loading

`/api/graph` returns all nodes with all checkpoints (including full message content). For workspaces with long conversations (hundreds of messages), this response can be very large. The frontend receives everything upfront and holds it in memory.

Similarly, `/api/files` returns all files with full validation results. There's no pagination, no cursor, no incremental loading.

---

## 20. Subprocess Invocation for Compilation

The Hyperprompt compiler is invoked via `subprocess.run()` with a 60-second timeout. If the process hangs (e.g., waiting for stdin), the server thread blocks for 60 seconds. There's no progress reporting, no cancellation mechanism, and no way to queue multiple compile requests.

---

## Summary Table

| # | Area | Severity | Effort to Fix |
|---|------|----------|---------------|
| 1 | Full re-read every request | High | Medium |
| 2 | Monolithic server.py | Medium | Medium |
| 3 | Duplicated validation | Low | Low |
| 4 | Hardcoded paths | Medium | Low |
| 5 | Path traversal gaps | Medium | Low |
| 6 | SSE thread blocking | Medium | Medium |
| 7 | God component App.tsx | Medium | High |
| 8 | No error boundaries | Medium | Low |
| 9 | No lint/strict TS | Low | Low |
| 10 | No shared data hooks | Low | Medium |
| 11 | No API versioning | Low | Medium |
| 12 | Unsafe rmtree | Medium | Low |
| 13 | SHA-1 truncated hash | Low | Low |
| 14 | No compile capability check | Low | Low |
| 15 | Mock agent chat | Low | — |
| 16 | No CI | Medium | Medium |
| 17 | Double graph builds | Medium | Medium |
| 18 | SSE doesn't pass changed files | Low | Low |
| 19 | No pagination | Low | Medium |
| 20 | Blocking subprocess | Low | Medium |
