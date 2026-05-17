# CTXB-P13-T9 — FSD boundary for Agent Workbench UI adapters

## Summary

Prepare the Agent Workbench UI for future third-party agent UI framework
integration without coupling SpecSpace domain code to a concrete framework.
The task turns the local Agent context panel from page-local code into explicit
FSD slices with a stable adapter boundary.

## Deliverables

- Promote Agent Workbench context-set behavior into
  `entities/agent-workbench`.
- Add framework-neutral `AgentConversationRuntime` and `AgentRuntimeEvent`
  interfaces for future runtime adapters.
- Add `features/add-spec-to-agent-context` for the user action that maps a
  selected SpecNode into an Agent Workbench context draft.
- Promote the Agent context utility panel into `widgets/agent-context-panel`.
- Document the Agent UI framework adapter boundary and FSD placement rules.
- Keep the existing local context selection behavior unchanged.

## Acceptance Criteria

- Agent Workbench domain types do not import React or framework SDK types.
- Viewer page composes the feature/widget/entity through public APIs.
- FSD lint has no errors, with any intentional retained slice exceptions
  documented in `graphspace/docs/fsd-slice-rationale.md`.
- Existing Agent context UI still lets the user add the selected SpecNode to a
  local context draft.

## Validation Plan

- `npm test --prefix graphspace -- agent-workbench add-spec-to-agent-context`
- `npm test --prefix graphspace`
- `npm run lint:fsd --prefix graphspace`
- `npm run build --prefix graphspace`
- Browser smoke on `http://127.0.0.1:5173/`
