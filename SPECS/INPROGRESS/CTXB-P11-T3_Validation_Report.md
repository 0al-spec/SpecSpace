# CTXB-P11-T3 Validation Report

Status: PASS
Date: 2026-05-15

## Scope

Docker Compose CI smoke for SpecSpace deployment boundary.

## Checks

- `for script in scripts/prepare-specspace-smoke-fixtures.sh scripts/smoke-specspace-deploy.sh; do bash -n "$script"; done`
  - PASS
- `scripts/prepare-specspace-smoke-fixtures.sh "$fixture_root"`
  - PASS
- `SPECSPACE_SMOKE_MODE=compose scripts/smoke-specspace-deploy.sh`
  - PASS
  - Local validation used `SPECSPACE_COMPOSE_PROJECT_NAME=specspace_ci_local`, `SPECSPACE_API_PORT=18021`, and `SPECSPACE_UI_PORT=15193`.
  - Smoke covered API health, SpecGraph graph payload, recent runs, UI HTML, and UI-proxied API.
- `docker ps -a --filter name=specspace_ci_local`
  - PASS, no containers left after trap cleanup.
- GitHub Actions workflow YAML parse check
  - PASS
- `make lint`
  - PASS

## Notes

- A first local run found port `8021` already occupied before container startup.
- The smoke script now installs its cleanup trap before `compose up`, so partial compose state is removed even when startup fails.
