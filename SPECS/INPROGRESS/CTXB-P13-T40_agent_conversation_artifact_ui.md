# CTXB-P13-T40 — Expose Agent Conversation Artifact Snapshots in the UI

## Status

In Progress.

## Problem

Agent Conversation artifacts now have a typed snapshot contract, but operators
cannot yet see the artifact boundary from the Agent Conversation panel. That
makes the contract invisible and delays feedback on whether the snapshot shape
is useful before backend persistence is added.

## Goal

Expose readonly local `specspace_agent_conversation` snapshots in the Agent
Conversation panel through an explicit runtime capability.

## Scope

- Add an artifact-snapshot read capability to the mock Agent Conversation
  runtime.
- Render a compact artifact summary for the active or resumed conversation.
- Keep the snapshot UI readonly and frontend-local.
- Preserve Spec Markdown body redaction in rendered artifact data.

## Non-Goals

- No backend persistence.
- No `/api/v1/agent-workbench/*` endpoint yet.
- No raw conversation export/download flow.
- No proposal materialization from conversation outputs.

## Acceptance Criteria

- The mock runtime can return conversation artifact snapshots and an index
  artifact without exposing mutable internals.
- The active Agent Conversation panel shows artifact kind, schema/API version,
  storage authority, turn count, output count, and context item count.
- Snapshot details remain unavailable when the runtime does not implement the
  artifact capability.
- The panel does not render raw Spec Markdown or compiled Markdown bodies.
- Existing conversation start, resume, send, and context removal flows remain
  unchanged.
