# CTXB-P13-T42 — Connect Agent Conversation Panel To Readonly Workbench API

## Context

`CTXB-P13-T41` added guarded backend read endpoints for SpecSpace-owned Agent
Workbench conversation artifacts:

```text
GET /api/v1/agent-workbench/conversations
GET /api/v1/agent-workbench/conversations/{conversation_id}
```

The Agent Conversation panel still only knows about the local mock runtime. The
next parity step is to let operators inspect persisted/read-only workbench
artifacts exposed by that API without implying that SpecSpace can append turns
or write proposal outputs yet.

## Goal

Connect the frontend Agent Conversation panel to the readonly Workbench store:

- fetch and parse the conversation index;
- show stored conversations as a separate readonly source;
- fetch a selected stored conversation artifact on demand;
- render its transcript projection and artifact snapshot;
- keep send/append actions disabled for stored readonly artifacts.

## Non-Goals

- No writable conversation persistence.
- No agent backend execution.
- No proposal materialization from conversation outputs.
- No raw SpecGraph Markdown body expansion beyond the existing artifact
  contract.

## Acceptance Criteria

- The Agent Conversation panel can show a configured readonly Workbench
  conversation index without requiring local mock runtime state.
- Opening a stored conversation fetches its artifact through
  `/api/v1/agent-workbench/conversations/{conversation_id}` and renders its
  transcript/snapshot as readonly.
- Unconfigured or missing stores degrade to a muted diagnostic instead of
  breaking the panel.
- Stored artifacts do not expose writable send/append affordances until writable
  API capability exists.
- Existing local mock conversation start/resume/context-removal flows remain
  unchanged.
