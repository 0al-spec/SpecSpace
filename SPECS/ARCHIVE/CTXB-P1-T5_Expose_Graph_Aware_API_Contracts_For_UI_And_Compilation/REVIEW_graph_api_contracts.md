## REVIEW REPORT — Graph API Contracts

**Scope:** main..HEAD
**Files:** 11

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues

- None.

### Secondary Issues

- [Medium] Incomplete compile-target ancestry currently labels the selected conversation as a reachable root. In `viewer/server.py`, `build_lineage_paths()` falls back to `[[conversation_id]]` whenever no resolved parent edge exists, and `build_compile_target()` then derives `root_conversation_ids` from those fallback paths. For conversations with broken parent references, this marks the child conversation as a root even though `is_lineage_complete` is `false`. Future export or selection consumers could treat broken lineage as a valid root path unless the metadata distinguishes “no reachable roots” from “this node is a true root.” Follow-up should adjust the contract so incomplete lineage never claims synthetic roots.

### Architectural Notes

- The new graph, conversation, and checkpoint endpoints are additive and keep the existing file APIs stable.
- The package/import fixes (`viewer/__init__.py`, `tests/conftest.py`) remove the environment split between `make test` and `pytest`, which improves reproducibility for later tasks.

### Tests

- `make test` passes.
- `make lint` passes.
- `pytest` passes.
- `ruff check viewer tests` passes.
- `pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90` passes with 91.30% total coverage.

### Next Steps

- Add a follow-up workplan task to correct compile-target root metadata for incomplete lineage before compile/export tasks consume it.
- Keep `FOLLOW-UP` explicit; no code changes are required in this review step itself.
