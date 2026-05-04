---
name: next
description: Intelligent next-action recommendations. Reconciles condition-based maintenance tasks with the processing queue. Tells you what to work on next based on actual system state. Triggers on "/next", "what should I work on", "what's next", "show queue".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
context: fork
---

## THE MISSION

Answer: "What should I work on next?" by evaluating actual system state against conditions.

## Workflow

### Step 1: Reconcile Maintenance Conditions

Check each condition and report fired conditions:

```bash
# Orphan feature records (highest priority — session-level)
orphans=0
for f in features/*.md; do
  [ "$(basename $f)" = "index.md" ] && continue
  title=$(basename "$f" .md)
  rg -q "\[\[$title\]\]" features/ || ((orphans++))
done
[ $orphans -gt 0 ] && echo "PRIORITY:SESSION -- $orphans orphan feature records (run /arscontexta:trace)"

# Dangling links (session-level)
dangling=$(rg -o '\[\[([^\]]+)\]\]' features/ -r '$1' --no-filename 2>/dev/null | sort -u | while read title; do
  find . -name "$title.md" -not -path "./.git/*" 2>/dev/null | grep -q . || echo "dangling"
done | wc -l | tr -d ' ')
[ "$dangling" -gt 0 ] && echo "PRIORITY:SESSION -- $dangling dangling links (run /arscontexta:review)"

# staging/ items (session-level)
staging_count=$(ls staging/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$staging_count" -gt 0 ] && echo "PRIORITY:SESSION -- $staging_count items in staging/ (run /arscontexta:document)"

# Stale in-progress features (multi-session)
cutoff=$(date -v-14d '+%Y-%m-%d' 2>/dev/null || date -d '14 days ago' '+%Y-%m-%d')
rg -l '^status: in-progress' features/ 2>/dev/null | while read f; do
  created=$(rg '^created:' "$f" | awk '{print $2}')
  [[ "$created" < "$cutoff" ]] && echo "PRIORITY:MULTI_SESSION -- stale in-progress: $f (review status)"
done

# Observations accumulation (slow)
obs_count=$(ls ops/observations/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$obs_count" -ge 10 ] && echo "PRIORITY:SLOW -- $obs_count pending observations (run /arscontexta:retrospect)"

# Tensions accumulation (slow)
tension_count=$(ls ops/tensions/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$tension_count" -ge 5 ] && echo "PRIORITY:SLOW -- $tension_count pending tensions (run /arscontexta:retrospect)"
```

### Step 2: Check Processing Queue

```bash
[ -f ops/queue/queue.json ] && cat ops/queue/queue.json | python3 -c "
import json,sys
q = json.load(sys.stdin)
pending = [t for t in q.get('tasks',[]) if t.get('status')=='pending']
if pending:
    print(f'Queue: {len(pending)} pending tasks')
    for t in pending[:3]:
        print(f'  {t[\"id\"]}: {t[\"current_phase\"]} -- {t[\"target\"][:50]}')
" 2>/dev/null
```

### Step 3: Recommend Next Action

Prioritize by consequence speed (session > multi_session > slow) and output the top recommendation.

## Output Format

```
## Next Action

**Recommended:** [highest priority action]
[Why this is the priority]

**All Conditions:**
- SESSION: [fired conditions]
- MULTI_SESSION: [fired conditions]
- SLOW: [fired conditions]
- None: [conditions that passed]

**Queue:** [pending task count] tasks pending
```
