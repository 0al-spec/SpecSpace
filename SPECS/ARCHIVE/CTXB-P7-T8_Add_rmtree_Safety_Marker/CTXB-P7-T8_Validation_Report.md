# Validation Report — CTXB-P7-T8: Add rmtree Safety Marker to Export Directory

**Date:** 2026-04-12  
**Verdict:** PASS

---

## Deliverables

| Artifact | Status |
|----------|--------|
| `viewer/server.py` — `EXPORT_SENTINEL = ".ctxb_export"` constant | ✅ |
| `viewer/server.py` — sentinel check before `rmtree`; sentinel written on creation | ✅ |
| `tests/test_export.py` — 3 new sentinel tests (written, re-export, blocks rmtree) | ✅ |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | Directory without sentinel is never deleted | ✅ Returns 500, dir survives |
| AC2 | Fresh export writes sentinel | ✅ `test_sentinel_written_on_first_export` |
| AC3 | Re-export with sentinel succeeds and re-writes sentinel | ✅ `test_re_export_with_sentinel_succeeds` |
| AC4 | All existing tests pass | ✅ 278 passed |
| AC5 | `make lint` passes | ✅ Clean |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python -m pytest tests/` | ✅ 278 passed (3 new + 275 existing) |
| Lint | `make lint` | ✅ No output (clean) |

---

## Implementation Note

`test_missing_sentinel_blocks_rmtree` uses an isolated `tempfile.TemporaryDirectory`
(not the shared class-level dir) to avoid cross-test state pollution — the test
removes the sentinel and must not leave the shared export_dir in a broken state
for sibling tests.
