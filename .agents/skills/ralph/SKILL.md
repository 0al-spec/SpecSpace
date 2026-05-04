---
name: ralph
description: Queue processing with fresh context per phase. Processes N tasks from the queue, spawning isolated subagents to prevent context contamination. Supports serial, parallel, batch filter, and dry run modes. Triggers on "/ralph", "/ralph N", "process queue", "run pipeline tasks".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
context: fork
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task
argument-hint: "N [--parallel] [--batch id] [--type document] [--dry-run] — N = number of tasks to process"
---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse arguments:
- N (required unless --dry-run): number of tasks to process
- --parallel: concurrent workers (max 5) + cross-connect validation
- --batch [id]: process only tasks from specific batch
- --type [type]: process only tasks at a specific phase (document, trace, update, review)
- --dry-run: show what would execute without running
- --handoff: output structured RALPH HANDOFF block at end (for pipeline chaining)

### Step 0: Read Vocabulary

Read `ops/derivation-manifest.md` (or fall back to `ops/derivation.md`) for domain vocabulary mapping. All output must use domain-native terms. If neither file exists, use universal terms.

**START NOW.** Process queue tasks.

---

## MANDATORY CONSTRAINT: SUBAGENT SPAWNING IS NOT OPTIONAL

**You MUST use the Task tool to spawn a subagent for EVERY task. No exceptions.**

This is not a suggestion. This is not an optimization you can skip for "simple" tasks. The entire architecture depends on fresh context isolation per phase. Executing tasks inline in the lead session:
- Contaminates context (later tasks run on degraded attention)
- Skips the handoff protocol (learnings are not captured)
- Violates the ralph pattern (one phase per context window)

**If you catch yourself about to execute a task directly instead of spawning a subagent, STOP.** Call the Task tool. Every time. For every task.

The lead session's ONLY job is: read queue, spawn subagent, evaluate return, update queue, repeat.

---

## Phase Configuration

Each phase maps to specific Task tool parameters.

| Phase | Skill Invoked | Purpose |
|-------|---------------|---------|
| document | /document | Create feature record from staging/ item |
| trace | /trace | Find connections, update feature register |
| update | /update | Backward pass — update older feature records |
| review | /review | Description quality + schema + link health checks |

**All phases use the same subagent configuration:**
- subagent_type: knowledge-worker (if available) or default
- mode: dontAsk

---

## Step 1: Read Queue State

Read the queue file. Check these locations in order:
1. `ops/queue.yaml`
2. `ops/queue/queue.yaml`
3. `ops/queue/queue.json`

Parse the queue. Identify ALL pending tasks.

**Queue structure (v2 schema):**

```yaml
phase_order:
  feature: [document, trace, update, review]

tasks:
  - id: feature-001
    type: feature
    status: pending
    target: "[feature description]"
    batch: "[source-name]"
    created: "2026-01-30T10:00:00Z"
    current_phase: document
    completed_phases: []
```

If the queue file does not exist or is empty, report: "Queue is empty. Use /seed or /pipeline to add sources."

## Step 2: Filter Tasks

Build a list of **actionable tasks** — tasks where `status == "pending"`. Order by position in the tasks array (first = highest priority).

Apply filters:
- If `--batch` specified: keep only tasks where `batch` matches
- If `--type` specified: keep only tasks where `current_phase` matches

The `phase_order` header defines the phase sequence:
- `feature`: document -> trace -> update -> review

## Step 3: If --dry-run, Report and Stop

Show this and STOP (do not process):

```
--=={ ralph dry-run }==--

Queue: X total tasks (Y pending, Z done)

Phase distribution:
  Features: {document: N, trace: N, update: N, review: N}

Next tasks to process:
1. {id} — phase: {current_phase} — {target}
2. {id} — phase: {current_phase} — {target}
...

Estimated: ~{N} subagent spawns
```

---

## Step 4: Process Loop (SERIAL MODE)

**If `--parallel` is set, skip to Step 6 instead.**

Process up to N tasks (default 1). For each iteration:

### 4a. Select Next Task

Pick the first pending task from the filtered list. Read its metadata: `id`, `type`, `file`, `target`, `batch`, `current_phase`, `completed_phases`.

Report:
```
=== Processing task {i}/{N}: {id} — phase: {current_phase} ===
Target: {target}
```

### 4b. Build Subagent Prompt

Construct a prompt based on `current_phase`. Every prompt MUST include:
- The task identity (id, current_phase, target)
- The skill to invoke with `--handoff`
- `ONE PHASE ONLY` constraint
- Instruction to output RALPH HANDOFF block

**Phase-specific prompts:**

For **document** phase:
```
You are processing task {ID} from the work queue.
Phase: document | Target: {TARGET}

Run /document --handoff on the feature described: {TARGET}
Create a feature record in features/[feature-title].md
Follow the feature record schema: description, status, files_changed, rationale, Areas footer.
ONE PHASE ONLY. Do NOT run trace.
```

For **trace** phase:

**Build sibling list:** Query the queue for other features in the same batch where `completed_phases` includes "document". Format as wiki links.

```
You are processing task {ID} from the work queue.
Phase: trace | Target: {TARGET}

OTHER FEATURES FROM THIS BATCH (check connections to these alongside regular discovery):
{for each sibling in batch where completed_phases includes "document":}
- [[{SIBLING_TARGET}]]
{end for, or "None yet" if this is the first feature}

Run /trace --handoff on: {TARGET}
Find connections between this feature record and existing features.
Update features/index.md with this feature record.
Add wiki links where genuine connections exist.
ONE PHASE ONLY. Do NOT run update.
```

For **update** phase:

**Same sibling list** as trace (re-query queue for freshest state):

```
You are processing task {ID} from the work queue.
Phase: update | Target: {TARGET}

OTHER FEATURES FROM THIS BATCH:
{for each sibling in batch where completed_phases includes "document":}
- [[{SIBLING_TARGET}]]
{end for}

Run /update --handoff for: {TARGET}
This is the BACKWARD pass. Find OLDER feature records AND sibling features
that should reference this feature record but don't.
Add inline links FROM older feature records TO this feature record.
ONE PHASE ONLY. Do NOT run review.
```

For **review** phase:
```
You are processing task {ID} from the work queue.
Phase: review | Target: {TARGET}

Run /review --handoff on: {TARGET}
Combined verification: cold-read test, schema check, link health.
IMPORTANT: Cold-read runs FIRST — read only title+description, predict content,
THEN read full feature record.
Final phase for this feature. ONE PHASE ONLY.
```

### 4c. Spawn Subagent (MANDATORY — NEVER SKIP)

Call the Task tool with the constructed prompt:

```
Task(
  prompt = {the constructed prompt from 4b},
  description = "{current_phase}: {short target}" (5 words max)
)
```

**REPEAT: You MUST call the Task tool here.** Do NOT execute the prompt yourself.

Wait for the subagent to complete and capture its return value.

### 4d. Evaluate Return

When the subagent returns:

1. **Look for RALPH HANDOFF block** — search for `=== RALPH HANDOFF` and `=== END HANDOFF ===` markers
2. **If handoff found:** Parse the Work Done, Learnings, and Queue Updates sections
3. **If handoff missing:** Log a warning but continue — the work was still completed
4. **Capture learnings:** If Learnings section has non-NONE entries, note them for the final report

### 4e. Update Queue (Phase Progression)

After evaluating the return, advance the task to the next phase.

**Phase progression logic:**

Look up `phase_order` from the queue header to determine the next phase. Find `current_phase` in the array. If there is a next phase, advance. If it is the last phase, mark done.

**If NOT the last phase** — advance to next:
- Set `current_phase` to the next phase in the sequence
- Append the completed phase to `completed_phases`

**If the last phase** (review) — mark task done:
- Set `status: done`
- Set `completed` to current UTC timestamp
- Set `current_phase` to null
- Append the completed phase to `completed_phases`

### 4f. Report Progress

```
=== Task {id} complete ({i}/{N}) ===
Phase: {current_phase} -> {next_phase or "done"}
```

If learnings were captured, show a brief summary.
If more unblocked tasks exist, show the next one.

### 4g. Re-filter Tasks

Before the next iteration, re-read the queue and re-filter tasks. Phase advancement may have changed eligibility.

---

## Step 5: Post-Batch Cross-Connect (Serial Mode)

After advancing a task to "done" (Step 4e), check if ALL tasks in that batch now have `status: "done"`. If yes and the batch has 2 or more completed features:

1. **Collect all feature record paths** from completed batch tasks.

2. **Spawn ONE subagent** for cross-connect validation:
```
Task(
  prompt = "You are running post-batch cross-connect validation for batch '{BATCH}'.

Feature records created in this batch:
{list of ALL feature titles + paths from completed batch tasks}

Verify sibling connections exist between batch feature records. Add any that were missed
because sibling feature records did not exist yet when the earlier feature's trace ran.
Check backward link gaps. Output RALPH HANDOFF block when done.",
  description = "cross-connect: batch {BATCH}"
)
```

3. **Parse handoff block**, capture learnings. Include cross-connect results in the final report.

**Skip if:** batch has only 1 feature (no siblings) or tasks from the batch are still pending.

---

## Step 6: Parallel Mode (--parallel)

**When `--parallel` flag is present, SKIP Step 4 entirely and use this section instead.**

**Incompatible flags:** `--parallel` cannot be combined with `--type`. If both set, report error:
```
ERROR: --parallel and --type are incompatible. Parallel processes full feature pipelines, not individual phases.
Use serial mode for per-phase filtering: /ralph N --type trace
```

### Parallel Architecture

```
Ralph Lead (you) — orchestration only
|
+-- PHASE A: PARALLEL FEATURE PROCESSING (concurrent)
|   +-- worker-001: all 4 phases for feature 001 (with sibling awareness)
|   +-- worker-002: all 4 phases for feature 002 (with sibling awareness)
|   +-- ...up to 5 concurrent workers
|
+-- PHASE B: CROSS-CONNECT VALIDATION (one subagent, one pass)
|   +-- validates sibling links, adds any that workers missed
|
+-- CLEANUP + FINAL REPORT
```

### 6a. Identify Parallelizable Features

From the filtered queue, find pending features. Cap at 5 concurrent workers (or N, whichever is smaller).

### 6b. Spawn Feature Workers

For each parallelizable feature (up to N requested, max 5 concurrent), build the worker prompt with sibling awareness and spawn via Task tool. **Spawn workers in PARALLEL** — launch all Task tool calls in a single message.

### 6c. Monitor Workers (Phase A)

Wait for worker completions. Collect all created feature record titles and paths for Phase B. **Phase B CANNOT start until ALL spawned workers have reported back.**

### 6d. Cross-Connect Validation (Phase B)

**Skip if only 1 feature was processed.**

Spawn ONE subagent to verify sibling connections exist and add any that workers missed.

### 6e. Cleanup

After Phase B completes, proceed to Step 7 for the final report.

---

## Step 7: Final Report

```
--=={ ralph }==--

Processed: {count} tasks
  {breakdown by phase type}

Subagents spawned: {count} (MUST equal tasks processed)

Learnings captured:
  {list any friction, surprises, methodology insights, or "None"}

Queue state:
  Pending: {count}
  Done: {count}
  Phase distribution: {document: N, trace: N, update: N, review: N}

Next steps:
  {if more pending tasks}: Run /ralph {remaining} to continue
  {if batch complete}: All tasks in batch processed
  {if queue empty}: All tasks processed
```

**Verification:** The "Subagents spawned" count MUST equal "Tasks processed." If it does not, the lead executed tasks inline — this is a process violation. Report it as an error.

If `--handoff` flag was set, also output:

```
=== RALPH HANDOFF: orchestration ===
Target: queue processing

Work Done:
- Processed {count} tasks: {list of task IDs}
- Types: {breakdown by type}

Learnings:
- [Friction]: {description} | NONE
- [Surprise]: {description} | NONE
- [Methodology]: {description} | NONE
- [Process gap]: {description} | NONE

Queue Updates:
- Marked done: {list of completed task IDs}
=== END HANDOFF ===
```

---

## Error Recovery

**Subagent crash mid-phase:** The queue still shows `current_phase` at the failed phase. Re-running `/ralph` picks it up automatically.

**Queue corruption:** Report the error and stop. Do NOT attempt to fix it automatically.

**All tasks blocked:** Report which tasks are blocked and why.

**Empty queue:** Report "Queue is empty. Use /seed or /pipeline to add sources."

---

## Critical Constraints

**Never:**
- Execute tasks inline in the lead session (USE THE TASK TOOL)
- Process more than one phase per subagent (context contamination)
- Retry failed tasks automatically without human input
- Skip queue phase advancement (breaks pipeline state)
- In parallel mode: combine with --type (incompatible)

**Always:**
- Spawn a subagent via Task tool for EVERY task (the lead ONLY orchestrates)
- Include sibling feature titles in trace and update prompts
- Re-filter tasks between iterations (phase advancement creates new eligibility)
- Log learnings from handoff blocks
- Report failures clearly for human review
