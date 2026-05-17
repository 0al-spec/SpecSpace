# CTXB-P13-T10 — Evaluate Agent UI framework options for the first adapter

## Summary

Select the first Agent UI adapter target for SpecSpace without installing a
dependency or letting framework SDK types leak into Agent Workbench domain
contracts.

## Deliverables

- Compare `assistant-ui`, AG-UI, CopilotKit, and Vercel AI SDK.
- Record the first adapter decision and deferred alternatives.
- Preserve the FSD boundary introduced by `CTXB-P13-T9`.
- Identify the next implementation slice.

## Acceptance Criteria

- The evaluation covers UI primitives, protocol fit, runtime fit, license, and
  FSD coupling risk.
- The decision names one first adapter target.
- The decision keeps `entities/agent-workbench` framework-neutral.
- No third-party dependency is installed by this task.

## Validation Plan

- Review `docs/AGENT_UI_FRAMEWORK_EVALUATION.md`.
- `git diff --check`
- `npm run lint:fsd --prefix graphspace`
