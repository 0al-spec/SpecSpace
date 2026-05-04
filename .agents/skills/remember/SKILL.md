---
name: remember
description: Capture friction, methodology learnings, and operational corrections. Writes atomic notes to ops/observations/ or ops/methodology/. Triggers on "/remember", "remember this", "capture friction", "note this pattern".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Write, Grep, Glob
context: fork
---

## THE MISSION

Capture operational learnings before they're lost. Two destinations:

- **ops/observations/** — friction signals, surprises, process gaps
- **ops/methodology/** — behavioral corrections, methodology updates

**Target: $ARGUMENTS**

## Workflow

### Step 1: Classify the Capture

What kind of capture is this?

| Type | Destination | Example |
|------|------------|---------|
| Friction / something was hard | ops/observations/ | "search by file path fails because we don't have a file-indexed query" |
| Surprise / unexpected result | ops/observations/ | "feature records with inline links are 3x easier to navigate" |
| Process gap / step was missing | ops/observations/ | "no workflow for bulk-documenting past features from git log" |
| Methodology correction | ops/methodology/ | "rationale field should explain the problem, not the solution" |

### Step 2: Write the Capture

**For ops/observations/:**

```markdown
---
description: [What happened and what it suggests — max 200 chars]
category: friction | surprise | process-gap | methodology
status: pending
observed: YYYY-MM-DD
---
# [the observation as a prose sentence]

[What happened, why it matters, and what might change as a result.]
```

**For ops/methodology/:**

```markdown
---
description: [The behavioral correction or methodology insight]
category: methodology
created: YYYY-MM-DD
status: active
---
# [the methodology insight as a prose sentence]

[Why this is the right behavior and what it replaces.]
```

### Step 3: Threshold Check

After writing, report current counts:
- Pending observations: N (threshold: 10 -> run /arscontexta:retrospect)
- Pending tensions: N (threshold: 5 -> run /arscontexta:retrospect)
