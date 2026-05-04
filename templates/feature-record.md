---
_schema:
  entity_type: feature-record
  applies_to: features/*.md
  required:
    - description
    - status
    - files_changed
    - rationale
  optional:
    - created
    - areas
    - pr
    - breaking_change
  enums:
    status:
      - in-progress
      - shipped
      - reverted
      - deprecated
  constraints:
    description:
      max_length: 200
      format: "One sentence adding context beyond the title — what it does, how it works, or why it matters"
    files_changed:
      format: "Array of file paths relative to project root"
    rationale:
      format: "One or more sentences explaining the problem solved or goal achieved"

# Template fields
description: ""
status: in-progress
files_changed:
  - ""
rationale: ""
created: YYYY-MM-DD
areas: []
---

# {prose-as-title feature claim}

{Body: describe what was built, the implementation approach, and any important technical context.
Keep concise — the key facts are in the schema fields above. Body is for nuance, tradeoffs, and context
that doesn't fit in structured fields.}

---

Related Features:
- [[related feature title]] -- relationship type (enables / supersedes / depends on / relates to)

Areas:
- [[feature register]]
