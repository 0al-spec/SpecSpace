---
name: document
description: Extract structured feature records from staging/ notes or raw descriptions. Transforms raw capture into properly-schemed feature records in features/. Comprehensive documentation is the default. Triggers on "/document", "/document [file]", "document this feature", "create feature record", "process staging".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Write, Grep, Glob, Bash
context: fork
---

## Runtime Configuration (Step 0 — before any processing)

Read `ops/derivation-manifest.md` for vocabulary mapping and `ops/config.yaml` for processing depth. If not found, use defaults: notes folder = features/, inbox = staging/, note type = feature record.

---

## THE MISSION

Transform raw staging/ notes into structured feature records in features/. Every feature that was actually built deserves a properly-schemed record. Zero documentation from a staging item that describes a real feature is a BUG.

**Target: $ARGUMENTS**

Parse immediately:
- If target is a file path in staging/: document that specific item
- If target is empty: scan staging/ for undocumented items, pick one
- If target is "all": process all staging/ items sequentially

## Workflow

### Step 1: Read Source

Read the staging item fully. Understand:
- What was actually built (the feature claim)
- Why it was built (the rationale — problem solved or goal achieved)
- Which files were changed

### Step 2: Check for Existing Record

Before creating, check if a feature record already exists:

```bash
rg -l "$(basename "$1" .md | head -c 40)" features/ 2>/dev/null
```

If a duplicate exists, evaluate for enrichment (update existing record with new detail from staging).

### Step 3: Craft Title

The title IS the feature claim. Express it as a prose proposition.

Test: "This feature record documents that [title]" must read naturally.

Good: `telemetry overlay shows zoom and fps in real time`
Good: `animated SVG edges removed to reduce Safari memory pressure`
Bad: `telemetry feature` (topic label)
Bad: `edge fix` (too vague)

Rules: lowercase with spaces, no punctuation that breaks filesystems (. * ? + [ ] { } | \ ^)

### Step 4: Write Feature Record

Use this template:

```markdown
---
description: [One sentence adding context beyond the title. What it does, how it works, or the key constraint. Max 200 chars, no trailing period]
status: [in-progress | shipped | reverted | deprecated]
files_changed:
  - [path/to/changed/file.ext]
rationale: [Why this feature was built. The problem it solves or goal it achieves]
created: [YYYY-MM-DD]
areas: []
---

# [title as prose claim]

[Optional body: technical context, implementation notes, trade-offs. Keep concise — key facts are in schema fields.]

---

Related Features:
- [[related feature title]] -- [relationship: enables / supersedes / depends on / relates to]

Areas:
- [[feature register]]
```

### Step 5: Verify Before Writing

- [ ] Title passes the claim test ("This feature record documents that [title]")
- [ ] Description adds information beyond the title (scope, mechanism, or implication)
- [ ] Status is a valid enum value (in-progress / shipped / reverted / deprecated)
- [ ] files_changed contains at least one path
- [ ] rationale explains WHY (not just WHAT)
- [ ] Areas footer links to [[feature register]]

### Step 6: Create File

Write to: `features/[title].md`

### Step 7: Pipeline Chaining

After creating the feature record, output next step based on ops/config.yaml chaining mode:

- **manual:** "Next: /arscontexta:trace [[feature title]]"
- **suggested:** Output next step AND add to ops/queue/queue.json
- **automatic:** Immediately queue for trace phase

## Quality Gates

| Gate | Failure Action |
|------|---------------|
| Title passes claim test | Rewrite title |
| Description adds new info | Rewrite description |
| All required schema fields present | Fill missing fields |
| files_changed not empty | List touched files |
| rationale explains WHY not WHAT | Rewrite rationale |
| Areas footer present | Add [[feature register]] link |

## Critical

Never auto-document without presenting the proposed record to the user first.

When in doubt, document. A feature record with incomplete fields can be improved; a missing record cannot be found.
