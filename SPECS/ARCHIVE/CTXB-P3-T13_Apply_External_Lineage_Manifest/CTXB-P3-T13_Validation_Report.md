# Validation Report — CTXB-P3-T13

**Task:** Apply external lineage manifest to canonicalize imported conversations
**Date:** 2026-03-24
**Verdict:** PASS

## Quality Gates

| Gate | Result | Details |
|------|--------|---------|
| Tests | PASS | 53/53 tests pass (`make test`) |
| Lint | PASS | Clean (`make lint`) |

## Acceptance Criteria

- [x] `make canonicalize DIALOG_DIR=… OUTPUT_DIR=…` produces canonical JSON files for all conversations in the manifest.
- [x] Root conversations (no parent in manifest) get `lineage: {parents: []}`.
- [x] Branch conversations get `lineage: {parents: [{conversation_id, message_id, link_type: "branch"}]}`.
- [x] Output files pass `schema.validate_conversation`.
- [x] Command is idempotent — running twice on same inputs produces identical output.
- [x] Validation errors are reported per-file without aborting the whole run.

## Changes

- **`viewer/canonicalize.py`** — new script that reads `lineage.json`, injects `conversation_id` + `lineage` into each source file, validates with `schema.validate_conversation`, writes to output dir.
- **`Makefile`** — added `canonicalize` target: `make canonicalize DIALOG_DIR=… OUTPUT_DIR=…`.
- **`tests/test_canonicalize.py`** — 6 tests covering root injection, branch injection, schema validation, idempotency, error resilience, and message preservation.

## Usage

```bash
# Step 1: run ChatGPTDialogs detect_lineage.py to produce lineage.json
python scripts/detect_lineage.py /path/to/import_json

# Step 2: canonicalize in ContextBuilder
make canonicalize \
  DIALOG_DIR=/path/to/import_json \
  OUTPUT_DIR=/path/to/canonical_json

# Step 3: serve
make serve DIALOG_DIR=/path/to/canonical_json
```
