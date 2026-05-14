# CTXB-P7-T13 Validation Report

## Scope
- Added GitHub Actions workflow at `.github/workflows/ci.yml`.
- CI runs on every push and on pull requests targeting `main`.
- Backend job uses Python 3.11 and runs repository Makefile gates.
- Viewer app job uses the documented Node.js 18 baseline, installs from `viewer/app/package-lock.json`, and runs frontend gates.

## Acceptance
- `make lint` is a required backend CI step.
- `make test` is a required backend CI step.
- `npm run typecheck --prefix viewer/app` is a required viewer CI step.
- `npm run build --prefix viewer/app` is a required viewer CI step.
- `npm run lint --prefix viewer/app` is included as an additional viewer gate from `CTXB-P7-T11`.

## Validation
- `python - <<'PY' ... yaml.safe_load(...)`: passed
- `make lint`: passed
- `make test`: passed
- `npm ci --prefix viewer/app`: passed
- `npm run typecheck --prefix viewer/app`: passed
- `npm run lint --prefix viewer/app`: passed
- `npm run build --prefix viewer/app`: passed, with the existing Vite chunk-size warning
