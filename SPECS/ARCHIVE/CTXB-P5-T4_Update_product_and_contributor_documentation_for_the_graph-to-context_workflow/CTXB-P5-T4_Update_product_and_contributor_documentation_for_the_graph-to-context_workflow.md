# CTXB-P5-T4 — Update product and contributor documentation for the graph-to-context workflow

**Status:** In Progress
**Priority:** P1
**Dependencies:** CTXB-P4-T4

## Description

Rewrite repository documentation so it matches the graph product scope, the canonical file contract, the Hyperprompt dependency, and the compile workflow.

## Deliverables

- Updated `README.md` covering:
  - What ContextBuilder owns vs external agents
  - Root, branch, merge, export node, `.hc`, and compiled artifact concepts
  - Compile workflow: export → Hyperprompt → `compiled.md`
  - Hyperprompt dependency setup and `--hyperprompt-binary` flag
  - Graph-to-context pipeline walkthrough for contributors
  - Updated repository layout including the React app and scripts
  - New API endpoints: `POST /api/export` and `POST /api/compile`

## Acceptance Criteria

- [ ] Docs explain what ContextBuilder owns and what external agents own
- [ ] Docs describe root, branch, merge, export node, `.hc`, and compiled artifact concepts
- [ ] A contributor can understand the local graph-to-context pipeline
- [ ] Hyperprompt dependency and its setup are documented
- [ ] `POST /api/export` and `POST /api/compile` API contracts are described
- [ ] Repository layout reflects current structure

## Out of Scope

- End-to-end operator guide for handing compiled context to an external agent (CTXB-P5-T5)
- Provenance tracking within artifacts (CTXB-P4-T5)
