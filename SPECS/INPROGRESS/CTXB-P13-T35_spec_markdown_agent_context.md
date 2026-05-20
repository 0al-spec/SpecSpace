# CTXB-P13-T35 — Add Spec Markdown Export and Compile Results to Agent Context

## Status

In Progress.

## Context

`CTXB-P13-T31` added readonly Spec Markdown export in the Spec Inspector, and
`CTXB-P13-T34` added optional Hyperprompt compile controls. Operators can now
preview, copy, and download the selected spec/subtree Markdown, but the output is
not yet usable by the Agent Workbench context draft.

The next parity step is to make those Markdown artifacts first-class Agent
Context items without introducing backend mutation, conversation execution, or
raw SpecGraph file writes.

## Deliverables

- Add a `spec_markdown` Agent Context item contract.
- Add Spec Inspector actions to attach exported Markdown and compiled Markdown
  to Agent Context.
- Render Markdown context items in Agent Context rows and Agent Conversation
  tokens.
- Preserve current export/compile copy/download behavior.
- Add focused unit coverage for context item keying, serialization, and compile
  metadata copying.

## Acceptance Criteria

- Exported Markdown can be added to Agent Context with root spec, scope,
  filename, node count, and Markdown body.
- Hyperprompt-compiled Markdown can be added separately with compile artifact
  diagnostics and compiled Markdown body.
- Agent Context deduplicates Markdown items by source kind, root spec, and
  scope.
- Agent Context and Agent Conversation panels render Markdown context tokens
  without assuming every context item is a spec/proposal/metric.
- No backend mutation or new execution path is introduced.

## Non-Goals

- Do not start agent conversations automatically from Markdown exports.
- Do not persist Agent Context drafts server-side.
- Do not introduce a new compile endpoint or change Hyperprompt execution.
- Do not expose raw run logs or mutate SpecGraph artifacts.

## Validation Plan

- `npm test --prefix graphspace -- agent-workbench`
- `npm run build --prefix graphspace`
- `npm run lint:fsd --prefix graphspace`
- Browser smoke on desktop and mobile:
  - open a spec in Spec Inspector;
  - export Markdown;
  - add it to Agent Context;
  - verify Agent Context and Agent Conversation tokens render.
