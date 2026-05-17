# CTXB-P13-T1 — Select SpecSpace parity track after deployment hardening

Status: PASS  
Date: 2026-05-17

## Summary

SpecSpace deployment hardening is complete enough to return to product parity work. The selected Phase 13 track starts with readonly SpecPM registry integration, then moves to proposal viewer parity, metrics parity, Agent Workbench conversation artifacts, and graph-context selection.

## Outputs

- Added Phase 13 to `SPECS/Workplan.md`.
- Kept `SPECS/SPECSPACE_PARITY_ROADMAP.md` as the active planning context.
- Updated `SPECS/INPROGRESS/next.md` to select `CTXB-P13-T4`.

## Decision

The next task is `CTXB-P13-T4` because `CTXB-P13-T2` and `CTXB-P13-T3` are already represented in current `main`:

- GraphSpace disables local SpecPM lifecycle badge fetches for HTTP/static providers.
- SpecSpace accepts `--specpm-registry-url` / `SPECSPACE_SPECPM_REGISTRY_URL`.
- `/api/v1/health` reports the configured readonly SpecPM registry source.
- `/api/v1/specpm/registry` already reads registry status and package index summary.

The remaining first-track gap is focused package and package-version reads.

## Acceptance

- Phase 13 states the parity goal without reopening legacy ContextBuilder conversation authoring as SpecSpace core.
- The first implementation track is explicit and ordered.
- Already-completed deployment-hardening slices are reflected so the queue does not repeat work.
