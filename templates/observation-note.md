---
_schema:
  entity_type: observation
  applies_to: ops/observations/*.md
  required:
    - description
    - category
    - status
    - observed
  enums:
    category:
      - friction
      - surprise
      - process-gap
      - methodology
    status:
      - pending
      - promoted
      - implemented
      - archived

# Template fields
description: ""
category: friction
status: pending
observed: YYYY-MM-DD
---

# {observation as a prose sentence}

{What happened, why it matters, and what might change as a result.}
