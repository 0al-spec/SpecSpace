# CTXB-P5-T5 — Add end-to-end verification guidance for handing compiled context to an external agent

**Status:** In Progress
**Priority:** P1
**Dependencies:** CTXB-P5-T3, CTXB-P5-T4

## Description

Document the local operator flow from JSON conversations to final compiled Markdown so users can hand off context artifacts to external LLM/agent workflows with explicit and reproducible verification steps.

## Deliverables

- Updated `README.md` with an operator-oriented end-to-end handoff section that covers:
  - Preflight checks before export/compile
  - Step-by-step API/UI flow from graph selection to `compiled.md`
  - Verification checklist for artifacts (`nodes/*.md`, `root.hc`, `compiled.md`, `manifest.json`)
  - Failure triage guidance for common compile/handoff errors
  - External handoff checklist (what to send, what metadata to include)
- Optional companion document under `docs/` if the README section grows too large.
- Validation report documenting quality gate outcomes and acceptance-criteria mapping.

## Acceptance Criteria

- [ ] A user can follow the documented local workflow from JSON conversations to final compiled context output.
- [ ] Verification steps are explicit and reproducible, including expected artifacts and checks.
- [ ] The final handoff path to an external agent is explicit (what to pass and how to validate before handoff).
- [ ] Guidance is consistent with existing API contracts and repository tooling.

## Out of Scope

- Implementing provenance persistence in compiled artifacts (`CTXB-P4-T5`).
- Changing server compile/export behavior beyond documentation clarifications.
- Build-system variable improvements for `make serve` (`CTXB-P5-T6`).
