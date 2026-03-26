# CTXB-P5-B1 — Compile fails with "Hyperprompt not found" for branch compilation on arm64 build layout

**Status:** Planned
**Priority:** P1
**Phase:** Phase 5 — Hardening, Tests, and Documentation
**Dependencies:** CTXB-P4-T3, CTXB-P5-T6

## Objective

Make compile work out of the box when Hyperprompt is installed in Swift's architecture-specific release path (`.build/arm64-apple-macosx/release/hyperprompt`) instead of the legacy flat release path (`.build/release/hyperprompt`). Keep explicit overrides (`--hyperprompt-binary` and environment variables) authoritative, and improve diagnostics so API callers understand which paths were checked when discovery fails.

## Success Criteria

- `POST /api/compile` succeeds without manual path edits when Hyperprompt exists at `/Users/egor/Development/GitHub/0AL/Hyperprompt/.build/arm64-apple-macosx/release/hyperprompt`.
- Failure responses still return actionable diagnostics, including checked paths and the selected resolution source.
- Existing compile-path behavior for explicit binary overrides remains unchanged.
- `make test` and `make lint` pass after the change.

## Acceptance Tests

1. Add/adjust unit tests for binary resolution in `tests/test_server.py`:
   - arm64 fallback path is selected when default flat release path is missing.
   - explicit override path is still preferred over discovered fallback paths.
   - missing binary error includes both canonical and fallback candidate paths.
2. Run full quality gates from `.flow/params.yaml` (`make test`, `make lint`).

## Test-First Plan

1. Update or add failing tests that encode the expected arm64 fallback behavior and failure diagnostics.
2. Run the targeted test selection to confirm RED state.
3. Implement minimal server changes to satisfy tests.
4. Re-run targeted tests, then full quality gates.

## Execution Plan

### Phase A — Discovery contract update
- **Inputs:** Current compile endpoint and Hyperprompt resolution helpers in `viewer/server.py`.
- **Outputs:** Deterministic ordered candidate list covering explicit path, env path, canonical release path, architecture-specific release path(s), and optional project-local fallback path(s).
- **Verification:** Targeted tests assert path priority and selected source labeling.

### Phase B — Error diagnostics hardening
- **Inputs:** Compile failure response payload when binary is missing.
- **Outputs:** Clear message listing checked candidate paths and hinting at override mechanisms.
- **Verification:** Tests assert diagnostics include both canonical and arm64 candidates.

### Phase C — Documentation alignment
- **Inputs:** README and/or Makefile serving instructions.
- **Outputs:** Brief note clarifying default discovery behavior and override knobs.
- **Verification:** Manual doc review for consistency with server behavior.

## Notes

- Keep path checks local and filesystem-based; do not shell out to `which` for non-PATH defaults.
- Preserve backwards compatibility for users already setting `HYPERPROMPT_BINARY` or `--hyperprompt-binary`.
