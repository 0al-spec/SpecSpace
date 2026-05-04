---
name: trace
description: Find connections between feature records and update the feature register. Use after /document creates feature records. Triggers on "/trace", "/trace [feature]", "find connections", "update feature register", "connect features".
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

Find genuine connections between feature records. Build a traversable feature knowledge graph. Every connection must pass the articulation test: can you say WHY these features connect?

Bad connections pollute the graph. When uncertain, do not connect.

**Target: $ARGUMENTS**

## Workflow

### Step 1: Understand the Feature

Read the target feature record fully. Identify:
- The core feature claim
- Which files it touches
- Its current status
- What problem it solves

### Step 2: Discovery

**Primary: Browse the feature register**

Read `features/index.md`. Look for features that:
- Touch the same files
- Address the same problem area
- Were built to enable or supersede this feature
- Are related UI/performance/dev-tooling concerns

**Secondary: Keyword search**

```bash
# Features touching same files
rg "viewer/app/src" features/ | grep -v "^features/$(basename $TARGET)"

# Features in same status
rg "^status: shipped" features/ --include="*.md" -l

# Features by area keywords
rg -i "telemetry\|performance\|animation\|zoom" features/ -l
```

### Step 3: Evaluate Connections

For each candidate, apply the articulation test:

> [[feature A]] connects to [[feature B]] because [specific reason]

**Valid relationship types:**

| Relationship | When to use |
|-------------|-------------|
| enables | This feature makes another possible |
| supersedes | This replaces an older approach |
| depends on | This requires another feature to work |
| relates to | Shares files or addresses same concern |
| reverts | This undoes a previous feature |

Reject "related" without specifics. If you cannot name the relationship type, the connection fails.

### Step 4: Add Connections

**Inline links (preferred):**

```markdown
Since [[animated SVG edges removed to reduce Safari memory pressure]], the
performance target requires alternative edge rendering approaches.
```

**Footer links:**

```markdown
Related Features:
- [[animated SVG edges removed to reduce Safari memory pressure]] -- supersedes this by removing the SVG approach entirely
```

### Step 5: Update Feature Register

Add the new feature record to `features/index.md` under the appropriate section with a context phrase:

```markdown
## In Progress
- [[feature title]] -- what it does and why it matters

## Shipped (Recent)
- [[feature title]] -- shipped, what it achieved
```

Every entry MUST have a context phrase. Bare link lists are address books, not registers.

### Step 6: Feature Register Size Check

After updating, count entries. If any section exceeds ~20 features:
- Note: "Section approaching split threshold — consider creating [[area-register]]"

### Step 7: Pipeline Chaining

After tracing completes:
- **manual:** "Next: /arscontexta:update [[feature title]]"
- **suggested:** Output next step AND advance queue entry

## Quality Gates

- Every connection passes articulation test
- Feature register entry has context phrase
- No dangling links created
- Feature register sections are current

## Output Format

```
## Trace Complete

### Connections Found
- [[feature A]] -> [[feature B]] -- [relationship]: [why]

### Feature Register Updated
- Added to [section]: [[feature]] -- [context phrase]

### Orphan Check
- Feature is in register: YES / NO (action taken: ...)
```
