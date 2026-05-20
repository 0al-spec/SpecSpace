# CTXB-P13-T36 — Start Agent Conversation from Spec Markdown Exports

## Status

In Progress.

## Context

`CTXB-P13-T35` made exported and Hyperprompt-compiled Spec Markdown first-class
Agent Context items. Operators can attach exact Markdown artifacts to the local
context draft, but starting a conversation still requires manually opening Agent
Conversation and writing a generic prompt.

This task adds direct conversation starts from the Spec Inspector Markdown export
surface. The action should attach the exact exported or compiled artifact and
seed the Agent Conversation prompt with enough context for the future agent to
analyze the selected material.

## Deliverables

- Add a Spec Markdown conversation prompt seed.
- Add Spec Inspector start-chat actions for exported and compiled Markdown.
- Wire the page shell so start-chat adds the artifact to Agent Context and opens
  Agent Conversation with the seeded prompt.
- Preserve existing export, copy, download, compile, and add-context behavior.
- Add focused prompt seed tests and validation notes.

## Acceptance Criteria

- Exported Markdown can start an Agent Conversation after adding the export to
  Agent Context.
- Hyperprompt-compiled Markdown can start an Agent Conversation after adding the
  compiled result to Agent Context.
- The starter prompt includes root spec, artifact kind, scope, node count, and
  filename.
- Existing add/copy/download actions remain unchanged.
- The implementation stays frontend-only and uses the mock runtime boundary
  already present in Agent Conversation.

## Non-Goals

- Do not execute a real external agent.
- Do not persist conversations server-side.
- Do not change the Spec Markdown export or Hyperprompt compile endpoints.
- Do not mutate SpecGraph artifacts.

## Validation Plan

- `npm test --prefix graphspace -- agent-workbench`
- `npm run build --prefix graphspace`
- `npm run lint:fsd --prefix graphspace`
- Browser smoke on desktop and mobile:
  - export Markdown from Spec Inspector;
  - click `Start Chat`;
  - verify Agent Conversation opens with Markdown attached and a seeded prompt.
