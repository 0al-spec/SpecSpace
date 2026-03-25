# CTXB-P4-T3 Validation Report — Integrate Hyperprompt Compiler Invocation

**Date:** 2026-03-25
**Verdict:** PASS

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | ✅ 92/92 passed |
| Lint | `make lint` | ✅ No errors |

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Successful compile writes `compiled.md` and `manifest.json` to `{export_dir}` | ✅ Verified by `test_success_path` and `test_successful_compile_returns_200_with_artifacts` |
| Non-zero exits surface the exit code and stderr as actionable errors | ✅ Covered by exit code 1, 2, 3, 4 unit tests and `test_compile_failure_surfaces_exit_code` |
| Missing binary at configured path surfaces clear "Hyperprompt not found" error | ✅ `test_missing_binary_returns_422` and `test_compile_with_missing_binary_returns_422` |
| Missing `root.hc` returns a clear error | ✅ `test_missing_hc_file_returns_400` |
| Tests cover: success, missing binary, missing hc, non-zero exit | ✅ All covered in `tests/test_compile.py` |
| Integration satisfies PRD FR-14, FR-15, NFR-11 | ✅ Compile invoked via subprocess, stderr/exit surfaced, binary path configurable |

---

## Changes Made

### `viewer/server.py`
- Added `import subprocess`
- Added `_EXIT_CODE_DESCRIPTIONS` mapping for exit codes 1–4
- Added `DEFAULT_HYPERPROMPT_BINARY` constant
- Added `invoke_hyperprompt(export_dir, binary_path)` — pure function; checks binary existence, runs subprocess, maps exit codes to error messages
- Added `compile_graph_nodes(dialog_dir, conversation_id, message_id, binary)` — wraps export + compile
- Added `handle_compile()` handler method
- Added `/api/compile` POST route in `do_POST`
- Added `--hyperprompt-binary` CLI argument with default path from params.yaml

### `tests/test_compile.py` (new file)
- 7 unit tests for `invoke_hyperprompt`: missing binary, missing hc, success, exit codes 1–4
- 5 integration tests for `/api/compile`: missing conv id, unknown conv, success, missing binary, compile failure

---

## API Contract

**POST `/api/compile`** — request: `{conversation_id, message_id?}`

Success (`200`): export response + `"compile": {compiled_md, manifest_json, exit_code, stdout, stderr}`

Compile failure (`422`): export response + `"compile": {error, exit_code, stderr, stdout}`

Missing binary (`422`): export response + `"compile": {error, details, exit_code: null}`
