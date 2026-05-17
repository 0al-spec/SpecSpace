# CTXB-P13-T7 — Define Agent Workbench conversation artifact model

## Summary

Define the persisted conversation artifact model for future SpecSpace Agent
Workbench flows. The model must support graph-context attachments, proposal
origins, analysis outputs, and future agent execution without reusing the
legacy ContextBuilder conversation-authoring schema as the product contract.

## Deliverables

- Document the Agent Workbench conversation artifact boundary.
- Define a versioned conversation artifact shape and a companion index shape.
- Define how selected specs, edges, gaps, proposals, metrics, and registry
  metadata attach to a turn.
- Define how a proposal can originate from a conversation turn without mutating
  SpecGraph canonical artifacts directly.
- Document storage/deployment boundaries for readonly static deployments versus
  future writable workbench deployments.
- Add lightweight fixtures/tests that pin the contract examples.

## Acceptance Criteria

- The new contract is explicitly separate from legacy ContextBuilder dialog
  JSON and legacy `/api/conversation` routes.
- The artifact model can represent conversation turns, graph context
  attachments, proposal origins, and analysis/handoff outputs.
- The storage boundary states that SpecSpace-owned workbench artifacts do not
  mutate SpecGraph `specs/nodes` or `runs` directly.
- The contract is versioned and has example fixtures covered by tests.

## Validation Plan

- `python -m pytest tests/test_agent_workbench_contract.py -q`
- `python -m pytest tests/ -q`
- Documentation review against `docs/SPECSPACE_BOUNDARY.md` and
  `SPECS/SPECSPACE_PARITY_ROADMAP.md`.
