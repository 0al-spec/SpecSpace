# CTXB-P13-T8 — Add graph-context-to-agent-context selection flow

## Summary

Add the first SpecSpace UI flow for collecting selected graph context into an
Agent Workbench `context_set` shape. This is a local readonly UI affordance:
it does not call an agent, persist conversations, or mutate SpecGraph.

## Deliverables

- Add a GraphSpace model for a serializable Agent Workbench context draft.
- Support adding the currently selected SpecGraph node to the context draft.
- Render an Agent context utility panel that shows selected context items and
  the serialized `context_set` preview.
- Add a disabled/placeholder handoff affordance that clearly does not imply
  agent execution yet.
- Add tests for context item deduplication and serialized shape.

## Acceptance Criteria

- Selected spec nodes can be collected into an explicit context set.
- The context set has a stable serialized shape compatible with
  `docs/AGENT_WORKBENCH_CONVERSATIONS.md`.
- The UI does not imply model execution until an agent backend exists.
- The flow stays local to SpecSpace UI state and does not write to SpecGraph
  artifacts.

## Validation Plan

- `npm test --prefix graphspace -- agent-context`
- `npm test --prefix graphspace`
- `npm run lint:fsd --prefix graphspace`
- `npm run build --prefix graphspace`
