# CTXB-P13-T39 — Add Agent Conversation Artifact Snapshot Contract

## Status

In Progress.

## Problem

Local Agent Conversation history can now be inspected and resumed, but the code
does not yet expose a typed snapshot that matches the documented Agent Workbench
artifact model. Without that contract, future writable storage, proposal-origin
records, and readonly workbench APIs would have to rediscover the shape from UI
state.

## Goal

Add a framework-neutral Agent Workbench conversation artifact snapshot model and
builders that can turn local runtime history into the documented
`specspace_agent_conversation` and index shapes.

## Scope

- Add typed conversation artifact and index models in `entities/agent-workbench`.
- Build artifact snapshots from `AgentConversationHistoryEntry` plus runtime
  events.
- Preserve output `origin_turn_id` and context-set references.
- Keep redacted Spec Markdown context redacted in artifact snapshots.

## Non-Goals

- No backend storage endpoints.
- No writable conversation persistence.
- No assistant-ui or React types in entity code.
- No proposal materialization flow yet.

## Acceptance Criteria

- Artifact snapshots include storage authority, context sets, turns, outputs,
  parent refs, timestamps, and status.
- Output snapshots preserve the turn that created them.
- Index entries expose counts needed by future conversation lists.
- Focused tests cover artifact construction, output origin mapping, index
  counts, and Spec Markdown redaction preservation.
