---
name: retrospect
description: Review accumulated observations and tensions. Triages each signal — PROMOTE to features/, IMPLEMENT as system change, ARCHIVE, or KEEP PENDING. Also detects methodology drift. Triggers on "/retrospect", "review observations", "triage friction", "system retrospective".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
context: fork
---

## THE MISSION

Review accumulated operational signals. Decide what to do with each one. Update the system when learnings warrant it.

**Target: $ARGUMENTS**

Modes: "drift" (detect methodology drift only), "observations" (triage observations only), "tensions" (resolve tensions only). No argument = full retrospective.

## Workflow

### Step 1: Gather Signals

```bash
echo "Pending observations: $(rg '^status: pending' ops/observations/ -l 2>/dev/null | wc -l | tr -d ' ')"
echo "Pending tensions: $(rg '^status: pending' ops/tensions/ -l 2>/dev/null | wc -l | tr -d ' ')"
```

### Step 2: Triage Observations

For each pending observation, decide:

| Decision | Criteria | Action |
|---------|----------|--------|
| PROMOTE | Observation crystallized into a genuine feature-level insight | Create feature record in features/ |
| IMPLEMENT | Points to a concrete improvement in CLAUDE.md, templates, or workflows | Update the relevant file, mark observation as implemented |
| ARCHIVE | Session-specific or no longer relevant | Update status to archived |
| KEEP PENDING | Not enough evidence yet | Leave as pending, note accumulation |

### Step 3: Triage Tensions

For each pending tension, decide:

| Decision | Criteria | Action |
|---------|----------|--------|
| RESOLVED | You have clarity on which side is correct | Update both feature records, mark tension resolved |
| DISSOLVED | The conflict was apparent, not real | Document why in the tension note, mark dissolved |
| KEEP PENDING | Still genuinely unresolved | Add evidence, leave pending |

### Step 4: Drift Detection (when "--drift" or full retrospective)

Check: does actual system behavior match ops/methodology/ directives?

```bash
# Check methodology notes for active directives
rg '^status: active' ops/methodology/ -l 2>/dev/null
```

For each active directive, verify actual behavior matches. Log drift observations if gaps found.

### Step 5: System Updates

If IMPLEMENT decisions were made, update the relevant files:
- CLAUDE.md for behavioral/methodology changes
- templates/ for schema changes
- ops/config.yaml for configuration changes

## Output Format

```
## Retrospective Complete [YYYY-MM-DD]

### Observations Triaged
- [obs title]: PROMOTED / IMPLEMENTED / ARCHIVED / KEPT PENDING
  [brief reasoning]

### Tensions Triaged
- [tension title]: RESOLVED / DISSOLVED / KEPT PENDING
  [brief reasoning]

### System Updates Made
- [file]: [what changed and why]

### Drift Detected
- [directive]: [behavior mismatch]
OR: No drift detected.

### Remaining
- Observations pending: N
- Tensions pending: N
```
