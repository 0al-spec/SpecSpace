## REVIEW REPORT — Canonicalize from Lineage Manifest

**Scope:** main..HEAD (5 commits)
**Files:** 3 changed (`viewer/canonicalize.py`, `Makefile`, `tests/test_canonicalize.py`)

### Summary Verdict
- [x] Approve

### Critical Issues
None.

### Secondary Issues

- [Low] `apply_manifest` validates each conversation in isolation using `schema.validate_conversation`, which runs single-file validation. It does not run `schema.validate_workspace` (cross-file checks: duplicate `conversation_id`, missing parent references). This means a parent conversation that doesn't appear in the output (e.g. the parent file had an error) won't cause the child to be flagged. Acceptable for now — the user will see broken edges in the graph, which is the existing diagnostic for missing parents. A future enhancement could add a workspace validation pass after all files are written.

- [Nit] `load_manifest` is a thin wrapper that opens a hardcoded `lineage.json` path. If the manifest is missing, it raises an uncaught `FileNotFoundError`. The `main()` function has no guard for this. Low impact — the error message from Python is clear enough.

### Architectural Notes

- The split is clean: ChatGPTDialogs owns detection (open source), ContextBuilder owns canonicalization (proprietary). No coupling between the two beyond the `lineage.json` format contract.
- `apply_manifest` is a pure function in terms of its inputs/outputs and is correctly unit-tested in isolation.
- The script reuses existing `schema.validate_conversation` — no schema logic is duplicated.

### Tests
- 6 tests added, 53/53 total pass.
- Covers: root injection, branch injection, schema pass-through, idempotency, missing-file resilience, message preservation.
- Missing: workspace-level validation (cross-file), missing manifest file. Both acceptable gaps given the low-severity notes above.

### Next Steps
- [Optional] Add workspace validation pass after writing all files (follow-up task if needed).
- [Optional] Guard `load_manifest` against missing file with a clear error message.
