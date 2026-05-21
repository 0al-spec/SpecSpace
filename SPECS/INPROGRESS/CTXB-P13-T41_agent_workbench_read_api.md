# CTXB-P13-T41 — Add Agent Workbench Readonly Conversation API Boundary

## Status

INPROGRESS

## Context

`CTXB-P13-T40` made local Agent Conversation artifact snapshots visible in the
Agent Conversation panel. The next parity step is a backend read boundary for
the same artifact contract so persistence and service-backed storage can be
added without changing the UI-facing schema.

## Goal

Expose guarded SpecSpace v1 read endpoints for SpecSpace-owned Agent Workbench
conversation artifacts backed by the documented local layout:

```text
workbench/
  conversations/
    index.json
    awb-conv-0001.json
```

## Scope

- Add readonly backend read models for the Agent Workbench conversation index
  and individual conversation artifacts.
- Add `GET /api/v1/agent-workbench/conversations`.
- Add `GET /api/v1/agent-workbench/conversations/{conversation_id}`.
- Add CLI/env configuration for the local workbench artifact store.
- Expose readonly capability and health source state.
- Keep writable endpoints and frontend backend wiring out of scope.

## Acceptance Criteria

- Missing Agent Workbench configuration returns structured `503`, not a silent
  empty success.
- A configured empty store returns a valid empty
  `specspace_agent_conversation_index`.
- Configured fixture artifacts can be read through the v1 endpoints.
- Path-like conversation ids are rejected.
- Conversation artifacts whose `conversation_id` does not match the requested
  id return structured `422`.
- Capabilities report readonly availability separately from writable authority.

## Validation Plan

- Focused backend tests for Agent Workbench read models and v1 API endpoints.
- Route table tests for the new prefix route.
- Server runtime tests for `SPECSPACE_AGENT_WORKBENCH_DIR`.
- `make lint`.
- Focused pytest set plus full `python -m pytest tests/ -q`.
