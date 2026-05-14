# CTXB-P7-T13 Validation Report

## Scope
- Added GitHub Actions workflow at `.github/workflows/ci.yml`.
- CI runs on every push and on pull requests targeting `main`.
- Backend job uses Python 3.11, installs pinned dev dependencies from `requirements-dev.txt`, downloads the viewer build artifact, and runs repository Makefile gates.
- Viewer app job uses the documented Node.js 18 baseline, installs from `viewer/app/package-lock.json`, runs frontend gates, and uploads `viewer/app/dist` for backend static-serving tests.

## Acceptance
- `make lint` is a required backend CI step.
- `make test` is a required backend CI step.
- `npm run typecheck --prefix viewer/app` is a required viewer CI step.
- `npm run build --prefix viewer/app` is a required viewer CI step.
- `npm run lint --prefix viewer/app` is included as an additional viewer gate from `CTXB-P7-T11`.
- Backend tests receive the built viewer artifact before `make test`, matching the clean-checkout CI environment.

## Validation
- `python - <<'PY' ... yaml.safe_load(...)`: passed
- `python -m pip install -r requirements-dev.txt`: passed
- `make lint`: passed
- `make test`: 513 tests passed
- `npm ci --prefix viewer/app`: passed
- `npm run typecheck --prefix viewer/app`: passed
- `npm run lint --prefix viewer/app`: passed
- `npm run build --prefix viewer/app`: passed, with the existing Vite chunk-size warning
- `test -f viewer/app/dist/index.html`: passed
