---
name: stats
description: Feature vault metrics and progress visualization. Shows feature counts by status, area coverage, schema health, and graph density. Triggers on "/stats", "vault stats", "feature metrics", "how many features".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
context: fork
---

## THE MISSION

Show meaningful metrics about the ContextBuilder feature knowledge vault.

## Workflow

```bash
echo "=== Feature Vault Stats ==="
echo ""
echo "Feature Records:"
echo "  Total: $(ls features/*.md 2>/dev/null | grep -v index.md | wc -l | tr -d ' ')"
echo "  In Progress: $(rg -l '^status: in-progress' features/ 2>/dev/null | wc -l | tr -d ' ')"
echo "  Shipped: $(rg -l '^status: shipped' features/ 2>/dev/null | wc -l | tr -d ' ')"
echo "  Reverted: $(rg -l '^status: reverted' features/ 2>/dev/null | wc -l | tr -d ' ')"
echo "  Deprecated: $(rg -l '^status: deprecated' features/ 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "staging/ queue: $(ls staging/*.md 2>/dev/null | wc -l | tr -d ' ') items pending"
echo ""
echo "Graph Health:"
echo "  Observations: $(ls ops/observations/*.md 2>/dev/null | wc -l | tr -d ' ')"
echo "  Tensions: $(ls ops/tensions/*.md 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "Schema Health:"
rg -L '^description:' features/*.md 2>/dev/null | wc -l | tr -d ' ' | xargs -I{} echo "  Missing description: {} files"
rg -L '^status:' features/*.md 2>/dev/null | wc -l | tr -d ' ' | xargs -I{} echo "  Missing status: {} files"
rg -L '^rationale:' features/*.md 2>/dev/null | wc -l | tr -d ' ' | xargs -I{} echo "  Missing rationale: {} files"
```

## Output

Present stats in clean format. Add interpretation where thresholds are exceeded (e.g., "10+ observations — consider running /arscontexta:retrospect").
