# CTXB-P13-T38 — Add Local Agent Conversation History and Resume

## Status

In Progress.

## Problem

Agent Conversation can start from selected specs, proposals, metrics, edges,
gaps, and Spec Markdown artifacts. The mock transcript now proves which context
was handed to the agent, but each visible panel session still behaves like a
single disposable thread. Operators cannot inspect earlier local conversations
or return to a previous context handoff without recreating it.

## Goal

Add a small frontend-only history surface for local mock conversations and make
resume replay the stored transcript instead of creating synthetic agent output.

## Scope

- Store mock conversation runtime events in the existing in-memory runtime.
- Expose a compact history list through the Agent Workbench runtime contract.
- Let the Agent Conversation panel start a fresh visible conversation or resume
  a prior local conversation.
- Keep Agent Context independent: starting a new conversation must not clear the
  current context draft.

## Non-Goals

- No backend persistence.
- No real agent execution.
- No raw Spec Markdown body rendering in history or resume.
- No cross-device or cross-refresh history.

## Acceptance Criteria

- Started mock conversations appear in a compact local history list with title,
  turn count, and context count.
- Selecting a prior conversation replays its stored transcript into the panel.
- Resume does not invent new assistant/system output.
- Starting a new conversation clears only the visible transcript and composer
  state, not Agent Context.
- Focused tests cover history ordering, replay, defensive cloning, and raw
  Markdown omission from exposed history records and resume output.
