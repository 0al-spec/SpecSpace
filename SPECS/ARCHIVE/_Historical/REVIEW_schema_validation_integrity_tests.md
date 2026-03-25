## REVIEW REPORT — schema_validation_integrity_tests

**Scope:** main..HEAD (feature/CTXB-P5-T1-automated-tests-schema-validation)
**Files:** 1 new (tests/test_integrity.py) + 4 SPECS updates

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues

None.

### Secondary Issues

- [Low] `_VALID_IMPORTED`, `_VALID_CANONICAL_ROOT`, etc. are module-level mutable dicts. Tests mutate `deepcopy()` of them correctly, but a test that directly mutated the module-level payload (e.g. forgot `deepcopy`) would silently corrupt other tests. Using `copy.deepcopy` in a `setUp` or defining them as functions would eliminate the risk entirely. Low priority because current code does the right thing.

- [Low] The `NormalizationErrorTests.test_missing_top_level_fields_are_reported` test uses an inline payload with no `source_file`. If `IMPORTED_ROOT_REQUIRED_FIELDS` changes in the future, the comment "missing source_file" may no longer accurately describe which field is missing. Pinning the assertion to confirm `source_file` is actually in the reported message text would make the failure message self-documenting. Not blocking.

- [Nit] The `_errors` / `_norm_errors` helper functions are undocumented about whether they return a `set` (which loses ordering and multiplicity). Since error codes are currently expected to be unique per call, this is fine. A comment noting this assumption would be helpful.

### Architectural Notes

- The new test file correctly targets the production functions directly (`collect_canonical_validation_errors`, `collect_normalization_errors`, `validate_file_name`, `validate_conversation`) rather than going through the HTTP server layer. This ensures tests remain fast and isolated.
- Tests assert error codes as set membership (`assertIn`), not exact equality. This is the right choice — it allows the production code to report additional context errors alongside the primary one without breaking the test.
- 39 new tests cover 16 previously untested error codes. Together with the existing 92 tests, the suite now provides strong regression protection across the full validation surface.

### Tests

- Total: 131 tests (up from 92), 0 failures.
- `make lint` passes with no errors.
- New `test_integrity.py` covers all error codes in `collect_canonical_validation_errors` and `collect_normalization_errors` that were absent from the existing suite.
- Existing tests in `test_validation.py`, `test_normalization.py`, `test_graph.py` continue passing — no regressions.

### Next Steps

- No blocking follow-ups required.
- The Low-severity observation about mutable module-level dicts could be addressed in CTXB-P5-T2 or a dedicated cleanup pass.
- CTXB-P5-T2 (P0) is the natural successor task.
