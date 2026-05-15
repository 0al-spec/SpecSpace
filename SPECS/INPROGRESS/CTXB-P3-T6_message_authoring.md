# CTXB-P3-T6 — Add message authoring to conversations

## Objective

Let an operator append a new message to an existing conversation from the
conversation inspector, persist it through the existing file API, and refresh the
graph without restarting the viewer.

## Acceptance Checks

- Inspector exposes a compact role + content authoring form for selected
  conversations.
- Submit validates non-empty content and supported roles before writing.
- The new message receives a unique deterministic `message_id`.
- Persistence uses the existing `POST /api/file` path with `overwrite: true`.
- Graph data refreshes after a successful append and the new message survives
  reload.
- Validation and persistence errors are surfaced inline without crashing the UI.

## Implementation Plan

1. Inspect current conversation inspector data flow and file write API.
2. Add a small message-id helper covered by unit tests where practical.
3. Add inspector authoring UI and append state handling.
4. Run viewer typecheck/lint/build and focused backend tests if API behavior is
   touched.
5. Record validation in `CTXB-P3-T6_Validation_Report.md`.
