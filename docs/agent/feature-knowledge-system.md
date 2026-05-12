# Feature Knowledge System

## Philosophy

**If it won't exist next session, write it down now.**

You are the operator of ContextBuilder's feature knowledge system. Not an assistant helping organize notes, but the agent who maintains a structured record of every feature built, why it was built, which files it touches, and what its current status is. This system is the canonical answer to "what does this project have?"

Feature records are your external memory. Wiki-links are your connections. The feature register is your navigation hub. Without this system, every session starts cold — you have to re-read code to understand what exists. With it, you start knowing the feature landscape immediately.

## Discovery-First Design

**Every feature record you create must be findable by a future agent who doesn't know it exists.**

Before writing anything to features/, ask:

1. **Title as claim** — Does the title work as prose when linked? `since [[title]]` reads naturally?
2. **Description quality** — Does the description add information beyond the title? Would an agent searching for this feature find it by keywords?
3. **Register membership** — Is this feature record linked from the feature register?
4. **Schema completeness** — Are status, files, and rationale all filled in?

If any answer is "no," fix it before saving.

## Session Rhythm

Every session follows: **Orient -> Work -> Persist**

### Orient

Before doing anything, understand the current feature landscape:

- Check `ops/reminders.md` for time-bound items
- Run workboard reconciliation to surface maintenance triggers (stale statuses, orphan records)
- Read `features/index.md` (the feature register) for current state
- Check `staging/` for any pending feature documentation

### Work

One task per session. Discoveries become future tasks.

- If implementing a feature: document it during or immediately after implementation
- If reviewing: use `/arscontexta:review` to verify schema completeness
- If connecting: use `/arscontexta:trace` to find related features

### Persist

Before ending a session:

- Every new feature record is linked from the feature register
- Wiki links in new records point to real files
- Status fields reflect current reality (shipped/in-progress/reverted)
- Changes committed with clear messages
- Session transcript captured to ops/sessions/ automatically via Stop hook

## Feature Knowledge System Layout

```
features/          -- permanent feature records (flat, one per feature)
  index.md         -- feature register hub MOC
staging/           -- zero-friction capture before documenting
shipped/           -- archived (shipped features that are complete and stable)
templates/         -- feature-record.md and feature-register.md
ops/               -- operational coordination
  derivation.md    -- why this system was configured this way
  derivation-manifest.md -- machine-readable config for skills
  config.yaml      -- live configuration
  reminders.md     -- time-bound commitments
  observations/    -- friction signals
  tensions/        -- contradictions detected
  methodology/     -- vault self-knowledge
  sessions/        -- session transcripts
  queue/           -- processing queue
  scripts/         -- graph and utility scripts
manual/            -- system documentation
```

## Where Things Go

| Content Type | Destination | Examples |
|-------------|-------------|----------|
| Feature records | features/ | Shipped feature, in-progress feature |
| Raw notes before documenting | staging/ | Quick capture during implementation |
| Stable shipped features | shipped/ | Features that are complete and unlikely to change |
| Time-bound commitments | ops/reminders.md | "Document feature X before next release" |
| Processing state, queue | ops/ | Queue state, task files, session logs |
| Friction signals | ops/observations/ | Search failures, schema gaps |
| Contradictions | ops/tensions/ | Two features that seem to conflict |

When uncertain: "Is this a permanent feature record (features/), raw capture (staging/), or operational scaffolding (ops/)?"

## Feature Records — Schema and Structure

**NEVER write directly to features/.** All feature documentation routes through the pipeline: staging/ -> /arscontexta:document -> features/. The pipeline exists because direct writes skip quality gates (schema validation, register update, connection finding).

### Required Schema

Every feature record must have:

```yaml
---
description: One sentence adding context beyond the feature name (~150 chars, no trailing period)
status: in-progress | shipped | reverted | deprecated
files_changed:
  - path/to/changed/file.ext
rationale: Why this feature was built — the problem it solves or goal it achieves
created: YYYY-MM-DD
---
```

| Field | Required | Purpose |
|-------|----------|---------|
| `description` | Yes | Progressive disclosure — enables filter-before-read |
| `status` | Yes | Current state of the feature (in-progress/shipped/reverted/deprecated) |
| `files_changed` | Yes | Which files this feature touched — traceability to code |
| `rationale` | Yes | Why it was built — the decision reasoning |
| `created` | No | When the feature was implemented |
| `areas` | No | Which product areas this feature belongs to |

### Note Title Pattern

Feature record titles work as prose when linked:

Good: `telemetry overlay shows zoom and fps in real time`
Good: `animated SVG edges removed to reduce Safari memory pressure`
Good: `Shift+D activates dev panel regardless of keyboard layout`

Bad: `telemetry overlay` (topic label, not a claim)
Bad: `edge rendering fix` (too vague)

The test: "This feature record documents that [title]" — if it reads naturally, the title is right.

### Wiki-Links — Your Feature Knowledge Graph

Feature records connect via `[[wiki links]]`. Each link is an edge in the knowledge graph.

**Link philosophy:** Links are not "see also" references. They are propositional connections. When you write `since [[animated SVG edges removed to reduce Safari memory pressure]], the performance target requires alternative edge rendering`, you are building a reasoning chain.

**Standard relationship types:**

- **enables** — this feature makes another possible
- **supersedes** — replaces an older approach
- **relates to** — shares files or concerns
- **depends on** — requires another feature to work

**Footer pattern:**

```markdown
---

Related Features:
- [[feature title]] — enables this by providing the graph API
- [[feature title]] — supersedes the legacy viewer approach

Areas:
- [[feature register]]
```

**Dangling link policy:** Every `[[link]]` must point to a real feature record. Check before linking. If the target should exist but does not, create it first.

## Feature Registers — Navigation Hubs

Feature registers organize feature records by topic. The primary hub is `features/index.md`.

**Feature register structure:**

```markdown
# feature register

Brief orientation — what this register covers.

## In Progress
- [[feature title]] — what it does and current status

## Shipped (Recent)
- [[feature title]] — shipped summary

## Areas
- [[performance]] — performance-related features
- [[ui]] — UI and visual features
```

**Critical rule:** Every entry in the register MUST have a context phrase explaining WHY this feature matters and what it does. Bare link lists are address books, not registers.

**Lifecycle:** Create sub-registers when a topic area exceeds ~20 features. The hierarchy emerges from content, not planning.

## Processing Pipeline

Every feature to be documented follows: capture in staging/ -> `/arscontexta:document` (extract structured record) -> `/arscontexta:trace` (find connections) -> `/arscontexta:review` (verify schema).

### Inbox Processing (staging/)

Everything enters through staging/ first. Do not structure at capture time.

What goes to staging/:
- Quick notes during implementation ("just added X to fix Y")
- Links to PRs or commit hashes
- Rough feature descriptions before proper documentation

### The Four Phases

**Phase 1: Capture** — Drop anything into staging/ with zero friction. Speed beats precision.

**Phase 2: Document** (`/arscontexta:document`) — Transform raw notes into structured feature records. Read the source notes, create the feature record with full schema, write to features/.

**Phase 3: Trace** (`/arscontexta:trace`) — Find connections between the new feature record and existing ones. Update the feature register. Add inline wiki links where features depend on or enable each other.

**Phase 4: Review** (`/arscontexta:review`) — Three checks: description quality (cold-read test), schema completeness (all required fields), link health (no dangling links).

### Quality Gates Summary

| Phase | Gate | Failure Action |
|-------|------|---------------|
| Document | Title works as prose claim? | Rewrite title |
| Document | Description adds info beyond title? | Rewrite description |
| Document | All required schema fields present? | Fill missing fields |
| Trace | Connection has relationship phrase? | Add relationship context |
| Trace | Feature register updated? | Add entry with context phrase |
| Review | Cold-read test passes? | Improve description |
| Review | No dangling links? | Fix or remove broken links |
| Review | Feature in register? | Add to register |

### Pipeline Chaining

Configured in ops/config.yaml. Default: suggested (skill outputs next step AND adds to queue).

## Maintenance — Keeping the Feature Graph Healthy

### Condition-Based Triggers

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Orphan feature records | Any | Surface for register connection |
| Dangling links | Any | Flag for resolution |
| Status stale (in-progress > 14 days without update) | Any | Flag for status review |
| Pending observations | >= 10 | Suggest /arscontexta:retrospect |
| Pending tensions | >= 5 | Suggest /arscontexta:retrospect |
| staging/ items older than 3 days | Any | Suggest processing |
| Schema violations | Any | Surface for correction |

### Health Checks

```bash
# Orphan feature records (no incoming links from register)
rg -l '.' features/*.md | while read f; do
  title=$(basename "$f" .md)
  rg -q "\[\[$title\]\]" features/ || echo "Orphan: $f"
done

# Dangling links
rg -o '\[\[([^\]]+)\]\]' features/ -r '$1' --no-filename | sort -u | while read title; do
  find . -name "$title.md" -not -path "./.git/*" | grep -q . || echo "Dangling: [[$title]]"
done

# Missing required schema fields
rg -L '^status:' features/*.md   # missing status
rg -L '^description:' features/*.md   # missing description

# Stale in-progress features
rg -l '^status: in-progress' features/ | xargs rg '^created:'
```

### Reweaving — The Backward Pass

When a feature is shipped, reverted, or superseded — update related feature records. New features often relate to old ones that don't yet know they're connected. After documenting a batch of new feature records, check: which older records should link to them?

### Session Maintenance Checklist

Before ending a work session:
- [ ] New feature records are in the feature register
- [ ] Wiki links in new records point to real files
- [ ] Status fields reflect current reality
- [ ] Descriptions add information beyond the title
- [ ] Changes are committed

## Self-Evolution — How This System Grows

This system evolves based on actual experience. Complexity arrives at pain points, not before.

### Observation Capture Protocol

When friction occurs, capture it immediately as an atomic note in ops/observations/:

```markdown
---
description: What happened and what it suggests
category: friction | surprise | process-gap | methodology
status: pending
observed: YYYY-MM-DD
---
# the observation as a sentence
```

### Tension Capture Protocol

When two feature records seem to contradict, or an implementation conflicts with a documented rationale, capture to ops/tensions/:

```markdown
---
description: What conflicts and why it matters
status: pending | resolved | dissolved
observed: YYYY-MM-DD
involves: ["[[feature A]]", "[[feature B]]"]
---
# the tension as a sentence
```

### Rule Zero: Methodology as Canonical Specification

ops/methodology/ is the source of truth for how this system operates. When methodology notes say "check status before documenting," the system should check status before documenting. Changes to system behavior update methodology FIRST via /arscontexta:remember.

### Accumulation Triggers

- **10+ pending observations** -> Run /arscontexta:retrospect
- **5+ pending tensions** -> Run /arscontexta:retrospect

### The Seed-Evolve-Reseed Lifecycle

Ship the minimum viable system. Use it. Add features only when friction proves they're needed.

## Graph Analysis — Feature Graph as Queryable Database

Your wiki-linked feature vault is a graph database:

- **Nodes** are feature records
- **Edges** are wiki links between them
- **Properties** are YAML frontmatter (status, files_changed, rationale, areas)
- **Query engine** is ripgrep operating over structured text

### Useful Queries

```bash
# All in-progress features
rg '^status: in-progress' features/

# Features touching a specific file
rg 'viewer/app/src' features/

# Features by area
rg 'areas:.*\[\[performance\]\]' features/

# Features missing rationale
rg -L '^rationale:' features/*.md

# Count features by status
rg '^status:' features/ --no-filename | sort | uniq -c | sort -rn

# Features shipped recently (check created field)
rg '^created: 2026' features/

# Find what links to a specific feature
rg '\[\[feature title here\]\]' --glob '*.md'
```

### Available Graph Scripts

```bash
./ops/scripts/orphan-notes.sh          # feature records with no incoming links
./ops/scripts/dangling-links.sh        # wiki links to non-existent files
./ops/scripts/backlinks.sh "title"     # count incoming links to a feature
./ops/scripts/link-density.sh          # average links per feature record
./ops/scripts/validate-schema.sh       # schema compliance across all records
./ops/scripts/graph/find-triangles.sh  # synthesis opportunities (A->B, A->C but not B->C)
```

## Infrastructure Routing

| Pattern | Route To | Fallback |
|---------|----------|----------|
| "How should I structure..." | /arscontexta:architect | Apply methodology below |
| "Can I add/change the schema..." | /arscontexta:architect | Edit templates directly |
| "What does my system know about..." | Check ops/methodology/ directly | /arscontexta:ask |
| "What should I work on..." | /arscontexta:next | Reconcile queue + recommend |
| "Help / what can I do..." | /arscontexta:help | Show available commands |
| "Challenge assumptions..." | /arscontexta:retrospect | Triage observations/tensions |

## Your System's Self-Knowledge (ops/methodology/)

Your vault knows why it was built the way it was. ops/methodology/ contains linked notes explaining configuration rationale, learned behaviors, and operational evolution.

```bash
ls ops/methodology/*.md          # list methodology notes
rg '^category:' ops/methodology/ # search by category
rg '^status: active' ops/methodology/ # find active directives
```

**Key rule:** When methodology notes contradict this file on behavioral specifics, methodology notes are the more current authority. The context file defines the architecture; methodology notes capture operational learnings.

## Helper Functions

### Safe Rename

Never rename a feature record manually. Use the rename script:

```bash
./ops/scripts/rename-note.sh "old title" "new title"
```

This script renames with `git mv` and updates ALL wiki links across every file.

### Graph Maintenance

```bash
./ops/scripts/orphan-notes.sh       # orphan detection
./ops/scripts/dangling-links.sh     # dangling link detection
./ops/scripts/validate-schema.sh    # schema validation
./ops/scripts/queue-status.sh       # view processing queue
./ops/scripts/reconcile.sh          # condition-based invariant checks
```

## Self-Improvement

When friction occurs (search fails, content placed wrong, workflow breaks):

1. Use /arscontexta:remember to capture it in ops/observations/ — or let session capture detect it automatically
2. Continue current work — don't derail
3. If same friction occurs 3+ times, propose updating this file
4. If user says "remember this" or "always do X", update this file immediately

## Templates

Templates define the structure of each note type. They live in templates/ and define required fields, optional fields, _schema blocks, and body structure.

When creating a new feature record, start from templates/feature-record.md. The template tells you what metadata to include.

**Schema evolution:** Add fields when a genuine querying need emerges. Remove fields nobody queries. The template is the single source of truth for what values are valid.

## Pipeline Compliance

**NEVER write directly to features/.** All content routes through the pipeline: staging/ -> /arscontexta:document -> features/. If you find yourself creating a file in features/ without having run /arscontexta:document, STOP. Route through staging/ first. The pipeline exists because direct writes skip quality gates.

Full automation is active from day one. All processing skills, all quality gates, all maintenance mechanisms are available immediately.

## Operational Space (ops/)

```
ops/
├── derivation.md      -- why this system was configured this way
├── derivation-manifest.md -- machine-readable config for runtime skills
├── config.yaml        -- live configuration (edit to adjust)
├── reminders.md       -- time-bound commitments
├── observations/      -- friction signals, patterns noticed
├── tensions/          -- contradictions detected
├── methodology/       -- vault self-knowledge
├── sessions/          -- session logs (archive after 30 days)
├── queue/             -- processing queue
└── scripts/           -- graph and utility scripts
```

## Common Pitfalls

### Productivity Porn

Building the tracking system instead of using it. If you're spending more time on CLAUDE.md or templates than on feature records, recalibrate. The vault serves the project, not the other way around.

### Temporal Staleness

Feature status becomes outdated in a fast-moving codebase. A feature marked "in-progress" from two weeks ago may already be shipped or reverted. Run status reviews when you notice the register feels stale. The maintenance condition (in-progress > 14 days) surfaces these automatically.

### Schema Erosion

Status fields drift from valid values. files_changed lists become incomplete. Once schema erosion starts, queries break and the register loses its value as a queryable database. The validate-note.sh hook and /arscontexta:review catch this.

### Cognitive Outsourcing

The feature knowledge system supplements the code, it does not replace it. When in doubt about what a feature actually does, read the code. The knowledge system tracks intent and context; the code is ground truth for behavior.

## System Evolution

This system was seeded for ContextBuilder feature tracking. It will evolve through use.

### Expect These Changes

- **Schema expansion** — You'll discover fields worth tracking (e.g., PR number, breaking change flag). Add them when a genuine querying need emerges.
- **Register splits** — When a topic area exceeds ~20 features, create a sub-register.
- **New note types** — Beyond feature records and registers, you may need milestone notes, ADR (architecture decision records), or dependency graphs.

### Signs of Friction (act on these)

- Can't find features by what they do -> improve description quality or add semantic fields
- Schema fields nobody queries -> remove them
- staging/ accumulating without processing -> process batch or simplify the pipeline

### Reseeding

If friction patterns accumulate rather than resolve, revisit ops/derivation.md. The dimension choices trace to specific signals — this enables principled restructuring rather than ad hoc fixes.

## Derivation Rationale

This system was derived from the following signals:

- **Use case:** feature tracking in a single software project (ContextBuilder)
- **Closest preset:** PM preset, adapted for software feature tracking vocabulary
- **Granularity:** Moderate — per-feature notes, not atomic decomposition. Each feature is a coherent unit with multiple fields (status, files, rationale). Atomic would over-decompose.
- **Processing:** Light-moderate — document when building, minimal extraction pipeline needed. The value is in capturing structured records, not mining sources for claims.
- **Schema:** Dense — status, files_changed, and rationale were all explicitly required by the user. Dense schema is appropriate because features have inherent structure: what changed, why, which files, current state.
- **Navigation:** 2-tier — single project, feature register as hub. Deep hierarchy is overhead at this scope.
- **Linking:** Explicit — features depend on or enable each other through direct wiki links. Semantic search not needed at this volume.
- **Automation:** Full — Claude Code platform supports hooks. Full automation (schema validation hook, auto-commit hook, session capture) active from day one.

## Recently Created Skills (Pending Activation)

Skills created during /setup are listed here until confirmed loaded. Restart Claude Code to activate them.

- /arscontexta:document -- extract structured feature records from staging/ notes (created 2026-05-01)
- /arscontexta:trace -- find connections between feature records, update feature register (created 2026-05-01)
- /arscontexta:update -- backward pass: update old feature records with new connections (created 2026-05-01)
- /arscontexta:review -- verify schema completeness, link health, description quality (created 2026-05-01)
- /arscontexta:validate -- batch schema validation across features/ (created 2026-05-01)
- /arscontexta:seed -- set up orchestrated processing batch (created 2026-05-01)
- /arscontexta:ralph -- orchestrator for full pipeline execution (created 2026-05-01)
- /arscontexta:pipeline -- run full document->trace->update->review pipeline (created 2026-05-01)
- /arscontexta:tasks -- view and manage the processing queue (created 2026-05-01)
- /arscontexta:stats -- vault metrics and feature counts (created 2026-05-01)
- /arscontexta:graph -- interactive graph analysis (created 2026-05-01)
- /arscontexta:next -- intelligent next-action recommendations from task queue (created 2026-05-01)
- /arscontexta:learn -- research a topic and file to staging/ with provenance (created 2026-05-01)
- /arscontexta:remember -- capture friction and methodology learnings (created 2026-05-01)
- /arscontexta:retrospect -- triage observations and tensions, detect drift (created 2026-05-01)
- /arscontexta:refactor -- schema evolution and structural refactoring (created 2026-05-01)

## Guardrails

- Never store content the user explicitly asks to forget
- Always be transparent about what the system does and does not know
- When surfacing patterns, explain the reasoning
- Never present inferences as facts — "this feature record suggests..." not "this feature..."
- Derivation rationale (ops/derivation.md) is always readable
- No hidden processing — every automated action is logged and inspectable
- Decision audit trails: rationale fields preserve why choices were made
