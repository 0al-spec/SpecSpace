---
name: validate
description: Batch schema validation across all feature records. Checks required fields, enum values, description quality, and link health. Triggers on "/validate", "batch validate", "schema check", "audit feature records".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
context: fork
---

## THE MISSION

Run schema validation across all features/*.md files. Report violations by severity.

**Target: $ARGUMENTS**

If no target, validate all feature records. If target is a specific file, validate that file only.

## Validation Checks

```bash
# Required fields missing
echo "=== Missing description ===" && rg -L '^description:' features/*.md 2>/dev/null
echo "=== Missing status ===" && rg -L '^status:' features/*.md 2>/dev/null
echo "=== Missing rationale ===" && rg -L '^rationale:' features/*.md 2>/dev/null
echo "=== Missing files_changed ===" && rg -L 'files_changed:' features/*.md 2>/dev/null

# Invalid enum values
echo "=== Invalid status values ===" && rg '^status:' features/ | grep -v 'in-progress\|shipped\|reverted\|deprecated\|index'

# Description quality (restates title check — flag very short descriptions)
echo "=== Short descriptions (< 50 chars) ===" && rg '^description: .{0,49}$' features/ --include="*.md"

# Dangling links
echo "=== Dangling links ===" && rg -o '\[\[([^\]]+)\]\]' features/ -r '$1' --no-filename | sort -u | while read title; do
  find . -name "$title.md" -not -path "./.git/*" 2>/dev/null | grep -q . || echo "Dangling: [[$title]]"
done

# Register membership
echo "=== Not in register ===" && for f in features/*.md; do
  [ "$(basename $f)" = "index.md" ] && continue
  title=$(basename "$f" .md)
  rg -q "\[\[$title\]\]" features/index.md 2>/dev/null || echo "Missing from register: $f"
done
```

## Severity Levels

- **FAIL** — missing required field, invalid enum, dangling link
- **WARN** — short description, missing optional field, not in register
- **PASS** — all checks pass

## Output Format

```
## Validation Report [YYYY-MM-DD]

### FAIL (must fix)
- features/[name].md: missing [field]
- features/[name].md: dangling link [[target]]

### WARN (should fix)
- features/[name].md: description may restate title
- features/[name].md: not in feature register

### Summary
- Total feature records: N
- FAIL: N
- WARN: N
- PASS: N
```
