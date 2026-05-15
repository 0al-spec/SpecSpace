# CTXB-P11-T3 — Docker Compose CI smoke

## Objective

Add a CI deployment smoke that proves the SpecSpace Docker/Compose boundary can
build and run in a clean environment with readonly SpecGraph fixture mounts.

## Acceptance Checks

- CI builds `specspace-api:local` and `specspace-ui:local` through
  `compose.specspace.yml`.
- CI starts both containers on non-conflicting host ports.
- Smoke validates `/api/v1/health`, `/api/v1/spec-graph`,
  `/api/v1/runs/recent`, UI HTML, and UI-proxied API.
- CI uses repository-local temporary fixtures, not private operator paths.
- Existing `Viewer App` and `Backend` jobs remain unchanged in behavior.

## Implementation Plan

1. Add a fixture preparation mode or script for Docker smoke inputs.
2. Add a dedicated `Docker Compose Smoke` GitHub Actions job.
3. Validate locally with the same commands the job uses.
4. Record validation in `CTXB-P11-T3_Validation_Report.md`.
