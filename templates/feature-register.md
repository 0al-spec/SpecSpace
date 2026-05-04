---
_schema:
  entity_type: feature-register
  applies_to: features/index.md features/*-register.md
  required:
    - description
    - type
  optional:
    - areas
  enums:
    type:
      - moc
      - register

# Template fields
description: ""
type: register
---

# {register name}

{Brief orientation — 2-3 sentences explaining what this register covers and how to use it.}

## In Progress

{Link each in-progress feature with a context phrase:}
- [[feature title]] -- what it does, current state

## Shipped (Recent)

{Recent shipped features — move older ones to shipped/ when the list exceeds ~15 entries:}
- [[feature title]] -- one-line summary

## Reverted / Deprecated

- [[feature title]] -- why it was reverted

## Areas

{Sub-registers by product area, create when any area exceeds ~20 features:}
- [[area-register]] -- description of what this area covers
