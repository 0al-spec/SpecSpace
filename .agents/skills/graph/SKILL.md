---
name: graph
description: Interactive graph analysis of the feature knowledge graph. Ask natural language questions or use explicit operation names. Triggers on "/graph", "graph analysis", "find synthesis opportunities", "what connects to".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
context: fork
---

## THE MISSION

Answer graph questions about the ContextBuilder feature knowledge graph using ripgrep and shell scripts.

**Target: $ARGUMENTS**

Parse the request:
- "what connects to [[feature]]" -> backlink search
- "triangles" / "synthesis opportunities" -> open triadic closures
- "orphans" -> features with no incoming links
- "density" -> link density report
- "clusters" -> find disconnected feature groups

## Available Operations

```bash
# Backlinks to a feature
rg "\[\[feature title\]\]" --glob '*.md' features/

# Orphan detection
for f in features/*.md; do
  [ "$(basename $f)" = "index.md" ] && continue
  title=$(basename "$f" .md)
  count=$(rg "\[\[$title\]\]" features/ --glob '*.md' -l 2>/dev/null | grep -v "$f" | wc -l | tr -d ' ')
  [ "$count" -eq 0 ] && echo "Orphan: $title"
done

# Link density
total_links=$(rg '\[\[' features/*.md --no-filename 2>/dev/null | wc -l | tr -d ' ')
total_features=$(ls features/*.md 2>/dev/null | grep -v index.md | wc -l | tr -d ' ')
[ "$total_features" -gt 0 ] && echo "Avg links per feature: $(echo "$total_links / $total_features" | bc)"

# Features by file area (what features touch what code)
rg '^files_changed:' -A 5 features/ | grep '  - ' | awk '{print $2}' | sort | uniq -c | sort -rn | head -20
```

## Output

Present results in plain language with actionable suggestions. Large result sets are summarized, not dumped. Always include: what the analysis found, what it means for the feature graph, and what action to take.
