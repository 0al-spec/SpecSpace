# CTXB-P3-T13 — Apply external lineage manifest to canonicalize imported conversations

**Priority:** P1
**Dependencies:** CTXB-P1-T1, CTXB-P1-T2
**Branch:** `feature/CTXB-P3-T13-canonicalize-from-lineage-manifest`

## Problem

ChatGPTDialogs' `detect_lineage.py` detects shared-prefix relationships across exported JSON files and produces a `lineage.json` manifest. However, it does not modify the source files. ContextBuilder has no way to load those files with correct lineage edges — all conversations appear as disconnected roots.

ContextBuilder needs a canonicalization command that reads the manifest, injects `conversation_id` and `lineage` metadata into each conversation, validates the result, and writes canonical JSON files that the server can load as a proper graph.

## Canonical Schema Contract (from schema.py)

A valid canonical conversation requires:
- `conversation_id` — non-empty string
- `title` — string
- `messages` — list of `{message_id, role, content}`
- `lineage.parents` — list; empty for roots, one entry for branches

A branch parent entry requires:
- `conversation_id`, `message_id`, `link_type: "branch"`

## Solution

Add `viewer/canonicalize.py` — a standalone script that:

1. Reads `lineage.json` from the source directory (produced by ChatGPTDialogs).
2. For each conversation in the manifest:
   - Reads the source JSON file from `DIALOG_DIR`.
   - Assigns `conversation_id` from the manifest slug.
   - Injects `lineage.parents` from the manifest (empty list for roots, one parent entry for branches).
   - Validates the result with `schema.validate_conversation`.
   - Writes the canonical file to `OUTPUT_DIR`.
3. Skips `lineage.json` itself (not a conversation).
4. Reports counts and any validation errors.

Add `make canonicalize` target to `Makefile`.

## Deliverables

1. **`viewer/canonicalize.py`** — canonicalization script.
2. **`Makefile`** — `canonicalize` target.
3. **`tests/test_canonicalize.py`** — tests.

## Acceptance Criteria

- [ ] `make canonicalize DIALOG_DIR=… OUTPUT_DIR=…` produces canonical JSON files for all conversations in the manifest.
- [ ] Root conversations (no parent in manifest) get `lineage: {parents: []}`.
- [ ] Branch conversations get `lineage: {parents: [{conversation_id, message_id, link_type: "branch"}]}`.
- [ ] Output files pass `schema.validate_conversation`.
- [ ] Command is idempotent — running twice on same inputs produces identical output.
- [ ] Validation errors are reported per-file without aborting the whole run.
- [ ] ContextBuilder server loads the output directory and displays the full lineage graph with edges.

## Task Plan

### T1: Implement `viewer/canonicalize.py`
- Read `lineage.json` manifest.
- For each entry: read source file, inject `conversation_id` + `lineage`, validate, write to output.
- Print summary: N written, M errors.

### T2: Add `make canonicalize` target
- `make canonicalize DIALOG_DIR=… OUTPUT_DIR=…`

### T3: Write `tests/test_canonicalize.py`
- Test root injection (no parent → `lineage.parents = []`).
- Test branch injection (parent → correct parent entry).
- Test idempotency.
- Test validation error reporting (bad source file doesn't abort run).
- Test that output files pass `schema.is_canonical_conversation`.

### T4: Run quality gates
- `make test` — all tests pass.
- `make lint` — clean.
