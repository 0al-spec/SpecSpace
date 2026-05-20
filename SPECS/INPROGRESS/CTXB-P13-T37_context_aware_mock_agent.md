# CTXB-P13-T37 — Summarize Attached Context in Agent Conversation Mock Runtime

## Status

In Progress.

## Problem

Agent Conversation can now start from selected proposals, metrics, specs, edges,
gaps, and Spec Markdown artifacts. The mock runtime still only reports the
number of attached context items, so the transcript does not prove which
artifacts were handed to the agent surface.

That is especially weak for Spec Markdown: operators need confidence that the
agent received the exact export or compiled artifact, but the UI must not dump
raw Markdown bodies into the conversation transcript.

## Goal

Make the mock Agent Conversation runtime emit a concise, operator-readable
summary of attached context items.

## Scope

- Summarize attached context items in the mock agent response.
- Include Spec Markdown source, root spec, scope, node count, and filename.
- Keep raw Markdown bodies out of the transcript.
- Keep the change within the existing frontend mock runtime boundary.

## Non-Goals

- No real agent execution.
- No persisted conversation storage.
- No backend mutation.
- No raw Markdown transcript rendering.

## Acceptance Criteria

- Mock agent responses include `Attached context` when context is present.
- Spec Markdown context is summarized without rendering its Markdown body.
- Existing context strip, remove behavior, and conversation send flow continue
  to work.
- Focused tests cover context summaries and raw body omission.
