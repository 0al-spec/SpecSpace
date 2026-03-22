# Validation Report — CTXB-P1-T5

**Task:** CTXB-P1-T5 — Expose graph-aware API contracts for UI and compilation
**Date:** 2026-03-22
**Verdict:** PASS

## Deliverables Checked

1. `viewer/server.py` now exposes graph-specific read contracts through shared helpers and new HTTP endpoints for graph, conversation, and checkpoint detail.
2. Compile-target-ready metadata is returned for conversation and checkpoint selections without duplicating graph derivation logic outside the existing workspace snapshot.
3. `tests/test_api_contracts.py` now locks the graph API contract, file API behavior, and HTTP error handling with live-server integration coverage.
4. `README.md` now documents the new endpoints, blocked-lookup semantics, and compile-target metadata fields.
5. `viewer/__init__.py` and `tests/conftest.py` make the viewer package importable under both the repository’s `make test` flow and `pytest`.

## Validation Steps

### 1. Project Test Suite

Command:

```bash
make test
```

Result:

- PASS
- 35 tests executed successfully

### 2. Project Lint / Syntax Validation

Command:

```bash
make lint
```

Result:

- PASS
- Python syntax compilation succeeded for runtime and test files

### 3. Pytest Contract Run

Command:

```bash
pytest
```

Result:

- PASS
- 35 tests executed successfully under the standalone pytest runner

### 4. Ruff Static Checks

Command:

```bash
ruff check viewer tests
```

Result:

- PASS
- No lint violations remained in the runtime or test files

### 5. Coverage Gate

Command:

```bash
pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90
```

Result:

- PASS
- Total coverage reached 91.30%

## Notes

1. A broad exploratory `mypy viewer tests` run still reports existing repository-wide typing issues in legacy files such as `viewer/schema.py` and older tests; `.flow/params.yaml` does not configure mypy as a project gate, so this task kept the FLOW-required repository gates (`make test`, `make lint`) plus the additional passing pytest, Ruff, and coverage checks above.
2. The new graph endpoints are additive and do not change the existing `/api/files` or `/api/file` contracts.
3. Blocked `conversation_id` lookups now return explicit `409` JSON responses, while unknown graph identifiers return `404`.
