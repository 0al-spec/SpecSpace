# CTXB-P13-T12 — Agent Conversation Panel Shell Over Mock Runtime

Date: 2026-05-17
Verdict: PASS

## Goal

Expose the Agent Workbench conversation loop in the SpecSpace UI using the
local/mock runtime from `CTXB-P13-T11`, without installing or coupling to a
third-party Agent UI framework yet.

## Result

- Added `widgets/agent-conversation-panel`.
- Added a utility dock entry for Agent conversation.
- Added an "Open Conversation" affordance from the Agent context panel.
- The conversation panel starts a mock conversation, streams operator/agent
  turns, shows context attachment tool calls, and lists analysis outputs.
- Context and transcript Spec IDs remain graph-aware through `SpecIdText`.

## Next

`CTXB-P13-T13` should spike `assistant-ui` behind the existing conversation
panel boundary. The spike must preserve the SpecSpace-owned runtime/event
contracts and remain removable.
