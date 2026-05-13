# CTXB-P8-T2 Validation Report

## Scope

SpecPM lifecycle status badges on GraphSpace SpecGraph canvas nodes.

## Automated Checks

- `python -m pytest tests/test_specpm_lifecycle.py` - pass
- `npm test` - pass, 23 files / 152 tests
- `npm run lint:fsd` - pass with the existing 8 `insignificant-slice` warnings
- `npm run build` - pass

## Manual Checks

- Browser verification on `http://localhost:5173/` - pass:
  - `SG-SPEC-0001` shows `draft_preview_only` from package `specgraph.core_repository_facade`.
  - `SG-SPEC-0002` has no lifecycle badge and remains unchanged.

## Notes

- `/api/specpm/lifecycle` now preserves SpecGraph anchors from
  `contract_summary` and `boundary_source_preview`.
- Badge model uses the strongest tone when multiple package/stage statuses map
  to the same node: blocked > ready > draft > unknown.
