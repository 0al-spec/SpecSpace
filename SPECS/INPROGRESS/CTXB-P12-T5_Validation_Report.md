# CTXB-P12-T5 Validation Report

Status: PASS
Date: 2026-05-16

## Scope

Timeweb deploy branch sync guard.

## Checks

- `TIMEWEB_DEPLOY_REMOTE=specspace scripts/check-timeweb-deploy-branch.sh`
  - PASS
- `TIMEWEB_DEPLOY_REMOTE=specspace scripts/validate-timeweb-deploy-branch.sh`
  - PASS
- `python3 -c "import pathlib, yaml; yaml.safe_load(pathlib.Path('.github/workflows/ci.yml').read_text())"`
  - PASS
- `make lint`
  - PASS

## Notes

- `docker-compose.yml` is intentionally not present in the main PR stack.
- The dedicated `timeweb-deploy` branch owns the Timeweb root
  `docker-compose.yml`.
- `timeweb-deploy:docker-compose.yml` must stay byte-for-byte identical to
  `compose.specspace.yml` so Timeweb sees the same compose stack.
- `.githooks/pre-push` runs the sync guard for developers who opt in with
  `git config core.hooksPath .githooks`.
- CI validates the deploy branch in the `Timeweb Docker Support` job.
