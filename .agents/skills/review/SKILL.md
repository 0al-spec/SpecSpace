---
name: review
description: Verify feature record schema completeness, link health, and description quality. Runs three checks — cold-read test, schema validation, link health. Triggers on "/review", "/review [feature]", "check schema", "verify feature record", "quality check".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Write, Grep, Glob, Bash
context: fork
---

## Runtime Configuration (Step 0)

Read `ops/derivation-manifest.md` for vocabulary mapping and `ops/config.yaml` for depth.

---

## THE MISSION

Three checks on every feature record:
1. Description quality (cold-read test)
2. Schema completeness (all required fields)
3. Link health (no dangling links, register membership)

**Target: $ARGUMENTS**

If no target, run batch review on all features/ files with missing fields.

## Workflow

### Check 1: Cold-Read Test (Description Quality)

Read ONLY the title and description. Without reading the body, predict what the feature record contains. Then read the body.

**Pass criteria:** Your prediction covered the main content of the body.
**Fail criteria:** Major content was hidden — description just restated the title.

Good description: "Removes all animated SVG edges at zoom < 0.5 and replaces with straight lines, cutting Safari GPU pressure by ~60%"
Bad description: "Feature that removes SVG edges" (just restates title)

The description must add scope, mechanism, or metric that the title does not cover.

### Check 2: Schema Completeness

```bash
# Check required fields
rg -L '^description:' features/*.md   # missing description
rg -L '^status:' features/*.md        # missing status
rg -L '^rationale:' features/*.md     # missing rationale

# Check status values are valid
rg '^status:' features/ | grep -v 'in-progress\|shipped\|reverted\|deprecated'

# Check files_changed is present and non-empty
rg -L 'files_changed:' features/*.md
```

For each failure:
- FAIL: Missing required field (description, status, files_changed, rationale)
- WARN: Missing optional field (created, areas)
- PASS: All required fields present and valid

### Check 3: Link Health

```bash
# Find dangling links (links to non-existent files)
rg -o '\[\[([^\]]+)\]\]' features/ -r '$1' --no-filename | sort -u | while read title; do
  find . -name "$title.md" -not -path "./.git/*" 2>/dev/null | grep -q . || echo "Dangling: [[$title]]"
done

# Check register membership
for f in features/*.md; do
  [ "$(basename $f)" = "index.md" ] && continue
  title=$(basename "$f" .md)
  rg -q "\[\[$title\]\]" features/index.md || echo "Not in register: $f"
done
```

### Step 4: Fix Issues

For each FAIL:
- Missing description -> write description following the quality standard
- Invalid status -> correct to valid enum
- Missing rationale -> write rationale explaining WHY
- Dangling link -> either create the linked record or remove the link
- Not in register -> add to features/index.md with context phrase

## Output Format

```
## Review Complete

### [feature title]

**Cold-Read Test:** PASS | FAIL
[If FAIL: proposed new description]

**Schema:**
- description: PASS | FAIL
- status: PASS | FAIL -- [current value]
- files_changed: PASS | FAIL
- rationale: PASS | FAIL

**Link Health:**
- dangling links: PASS | FAIL -- [list if any]
- register membership: PASS | FAIL

**Overall:** PASS | WARN | FAIL
[Fixes applied / Fixes needed]
```
