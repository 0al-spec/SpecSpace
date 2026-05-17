# CTXB-P13-T5 Validation Report

Date: 2026-05-17  
Verdict: PASS

## Checks

- `python -m pytest tests/test_specspace_api_v1.py -q` — 27 passed
- `python -m mypy viewer/` — passed
- `make lint` — passed
- `npm test --prefix graphspace -- proposal-index proposal-filters` — 2 files / 5 tests passed
- `npm test --prefix graphspace` — 30 files / 186 tests passed
- `npm run lint:fsd --prefix graphspace` — passed
- `npm run build --prefix graphspace` — passed with the existing Vite chunk-size warning
- `python -m pytest tests/ -q` — 563 passed, 41 subtests passed

## Notes

- Proposal markdown metadata is included when local `docs/proposals/*.md` files are available, but static HTTP deployments do not require those files.
- Missing optional proposal artifacts degrade to source diagnostics and empty contribution sets rather than failing `/api/v1/proposals`.
