# CTXB-P4-T3 — Integrate Hyperprompt Compiler Invocation

**Status:** IN PROGRESS
**Priority:** P0
**Phase:** 4 — Compile Pipeline
**Dependencies:** CTXB-P4-T2

---

## Description

Invoke the Hyperprompt compiler (`hyperprompt`) as a subprocess to compile the generated `root.hc` into a final Markdown context artifact (`compiled.md`) and a manifest (`manifest.json`).

The server exposes a `/api/compile` POST endpoint. It first runs the existing export pipeline (writes `nodes/` Markdown files and `root.hc`), then invokes the compiler. The entire operation is atomic from the caller's perspective.

---

## Deliverables

1. **`viewer/server.py`** — `invoke_hyperprompt(export_dir, binary_path)` function
2. **`viewer/server.py`** — `compile_graph_nodes(dialog_dir, conversation_id, message_id, binary)` function
3. **`viewer/server.py`** — `/api/compile` POST endpoint + `handle_compile` handler
4. **`viewer/server.py`** — `--hyperprompt-binary` CLI argument (optional; defaults to the params.yaml path)
5. **`tests/test_compile.py`** — Unit / integration tests covering the compile path

---

## Compiler Invocation

```
hyperprompt {export_dir}/root.hc \
  --root {export_dir} \
  --output {export_dir}/compiled.md \
  --manifest {export_dir}/manifest.json \
  --stats
```

Exit codes:
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | IO error |
| 2 | Syntax error |
| 3 | Resolution / circular dependency error |
| 4 | Internal compiler error |

---

## API Contract

**POST `/api/compile`**

Request body:
```json
{ "conversation_id": "...", "message_id": "..." }
```
`message_id` is optional (checkpoint scope).

Success response (`200`):
```json
{
  "export_dir": "/abs/path/export/...",
  "hc_file": "/abs/path/export/.../root.hc",
  "node_count": 12,
  "conversations": [...],
  "compile_target": {...},
  "compile": {
    "compiled_md": "/abs/path/export/.../compiled.md",
    "manifest_json": "/abs/path/export/.../manifest.json",
    "exit_code": 0,
    "stdout": "...",
    "stderr": ""
  }
}
```

Error response (`422` on compile failure):
```json
{
  "error": "Hyperprompt compiler failed: Syntax error",
  "exit_code": 2,
  "stderr": "...",
  "stdout": ""
}
```

"Binary not found" response (`422`):
```json
{
  "error": "Hyperprompt not found",
  "details": "Binary not found at: /path/to/hyperprompt"
}
```

---

## Acceptance Criteria

- [ ] Successful compile writes `compiled.md` and `manifest.json` to `{export_dir}`.
- [ ] Non-zero exits surface the exit code and stderr as actionable errors to the user.
- [ ] Missing binary at the configured path surfaces a clear "Hyperprompt not found" error.
- [ ] A missing `root.hc` (export never ran) returns a clear error.
- [ ] Tests cover: success path, missing binary, missing hc file, non-zero exit code.
- [ ] The integration satisfies PRD FR-14, FR-15, and NFR-11.

---

## Implementation Notes

- `invoke_hyperprompt` is a pure function (takes `export_dir: Path`, `binary_path: str`), making it straightforward to test without a running server.
- `compile_graph_nodes` wraps export + compile into one operation so the caller doesn't need to call `/api/export` first.
- The `--hyperprompt-binary` CLI flag defaults to the path in `.flow/params.yaml` (`hyperprompt.binary`).
- All subprocess errors (timeout, OS error) map to `500`.
