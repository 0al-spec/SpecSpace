# Validation Report — CTXB-P1-T1

**Task:** CTXB-P1-T1 — Define the canonical conversation and lineage schema
**Date:** 2026-03-22
**Verdict:** PASS

## Deliverables Checked

1. Canonical schema documentation added to `README.md`.
2. Canonical root / branch / merge fixtures added under `real_examples/canonical_json/`.
3. Schema helper module added at `viewer/schema.py`.
4. Automated tests added for imported example compatibility and canonical fixture classification.

## Validation Steps

### 1. Test Suite

Command:

```bash
make test
```

Result:

- PASS
- 6 tests executed successfully

### 2. Lint / Syntax Validation

Command:

```bash
make lint
```

Result:

- PASS
- Python syntax compilation succeeded for the updated runtime and test files

## Notes

1. The real imported examples confirm that `message_id` and `turn_id` are both stable but not interchangeable.
2. Imported examples currently lack top-level `conversation_id` and lineage metadata, so they remain compatible roots pending normalization in later tasks.
3. Coverage is not configured as a separate project quality gate in `.flow/params.yaml`; this task used the repository-defined `make test` and `make lint` checks.
