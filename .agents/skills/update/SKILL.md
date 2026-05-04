---
name: update
description: Backward pass — update old feature records with new connections. When a new feature is documented, older features that relate to it should know about it. Triggers on "/update", "/update [feature]", "backward pass", "update old records".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
context: fork
---

## Runtime Configuration (Step 0)

Read `ops/derivation-manifest.md` for vocabulary mapping and `ops/config.yaml` for processing depth.

---

## THE MISSION

New feature records don't automatically update older ones. A feature from last month may now be superseded, related to, or enabled by a new one. The backward pass asks: **"If we wrote this older feature record today, what would be different?"**

**Target: $ARGUMENTS**

If target is a new feature record, find older records that should be updated to reference it.
If no target, check for recently documented features and run backward pass.

## Workflow

### Step 1: Identify Update Candidates

For each recently documented feature, find older feature records that:
- Touch the same files (check files_changed fields)
- Address the same problem area
- Were superseded or enabled by the new feature

```bash
# Find features touching same files as new feature
rg "$(grep 'files_changed' -A5 "features/$1.md" | grep '  - ' | head -1 | tr -d ' -')" features/ -l 2>/dev/null

# Find features in same status category
rg "^status: shipped" features/ -l

# Keyword search for related areas
rg -i "[keyword from new feature]" features/ -l
```

### Step 2: Evaluate Each Candidate

For each candidate, ask: "Does the new feature change how we understand this older record?"

- Does the new feature supersede this one? -> Add `superseded_by` note and update status
- Does the new feature enable this one? -> Add enabling relationship
- Does the new feature provide context that makes this more understandable? -> Add reference

Only update if the relationship is genuine and adds value. Do not force connections.

### Step 3: Apply Updates

For genuinely related older records, add:

```markdown
Related Features:
- [[new feature title]] -- supersedes/enables/relates to this feature
```

Or update inline prose if appropriate.

### Step 4: Status Updates

If the new feature superseded an older one, update the older record's status:

```yaml
status: deprecated
```

Add a note explaining the supersession.

## Quality Gates

- Every update adds genuine relationship context, not just a link
- Status updates are accurate (deprecated means actually deprecated)
- No forced connections

## Output Format

```
## Update Pass Complete

### Records Updated
- [[older feature]] -- added relationship to [[new feature]]: [why]

### Status Changes
- [[older feature]] -- status changed to deprecated: [reason]

### No Update Needed
- [[candidate]] -- evaluated but no genuine relationship found: [why]
```
