# ContextBuilder — Claude Development Rules

This file is the table of contents for project-specific Claude rules. Keep
detailed methodology in linked documents so session context stays focused.

## Core Rules

- [UI development](docs/agent/ui-development.md) — shared UI Kit rules and
  SpecSpace FSD guidance.
- [SpecGraph surface contract sync](docs/agent/specgraph-surface-contract-sync.md)
  — how to treat SpecGraph JSON artifacts and viewer contracts.
- [Feature knowledge system](docs/agent/feature-knowledge-system.md) — feature
  records, registers, processing pipeline, graph maintenance, and guardrails.

## SpecSpace

When working on the SpecSpace subproject, follow
[FSD Rules For Web Application Development](FSD.md). These rules define the
Feature-Sliced Design layer boundaries, import direction, public APIs, and
placement rules for UI, API, and state code.

## Maintenance Policy

- Add long-form rules under `docs/agent/`.
- Keep this file short: links plus one-line purpose.
- Prefer updating the specialized document over expanding this table of contents.
