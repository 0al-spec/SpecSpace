---
name: pipeline
description: End-to-end feature processing — seed, document all features through trace/update/review, archive. The full pipeline in one command. Triggers on "/pipeline", "/pipeline [file]", "process this end to end", "full pipeline".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
context: fork
model: sonnet
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task
argument-hint: "[file] — path to staging/ file or feature description to process end-to-end"
---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse immediately:
- Source: the staging file or feature description to process (required)
- `--handoff`: output RALPH HANDOFF block at end (for chaining)
- If target is empty: list files in `staging/` and ask which to process

### Step 0: Read Vocabulary

Read `ops/derivation-manifest.md` (or fall back to `ops/derivation.md`) for domain vocabulary mapping. All output must use domain-native terms. If neither file exists, use universal terms.

**START NOW.** Run the full pipeline.

---

## Pipeline Overview

The pipeline chains four phases. Each phase uses skill invocation or /ralph for subagent-based processing. State lives in the queue file — the pipeline is stateless orchestration on top of stateful queue entries.

```
Staging file or feature description
    |
    v
Phase 1: /seed — create queue entry, set up task
    |
    v
Phase 2: /ralph (document phase) — create feature record from staging/ item
    |
    v
Phase 3: /ralph (all phases) — trace -> update -> review
    |
    v
Phase 4: batch complete — summarize results
    |
    v
Complete
```

The pipeline is the convenience wrapper. /ralph is the engine. /seed is the entry point.

---

## Phase 1: Seed

Invoke /seed on the target to create the task entry in the queue.

**How to invoke:**

Use the Skill tool if available, otherwise execute the /seed workflow directly:
- Validate source exists (staging/ file) or accept feature description
- Check for prior processing (duplicate detection by target name)
- Create queue entry with `current_phase: document`
- Add task to `ops/queue/queue.json`

**Capture from seed output:**
- **Batch ID**: the source basename or slugified feature name
- **Task ID**: the created task identifier

Report: `$ Seeded: {batch-name}`

**If seed reports the batch was already processed:** Ask the user whether to proceed or skip. Do NOT auto-skip.

---

## Phase 2: Document

Process the document phase via /ralph. This spawns a subagent that runs /document, creating the feature record in features/.

**How to invoke:**

```
/ralph 1 --batch {batch_id} --type document
```

Or via Task tool:
```
Task(
  prompt = "Run /ralph 1 --batch {batch_id} --type document",
  description = "document: {batch_id}"
)
```

After completion, read the queue to confirm the feature record was created.

Report:
```
$ Documented: {feature-title}
  Processing through trace -> update -> review...
```

**If document phase fails:** Report the issue. Do NOT continue to trace.

---

## Phase 3: Process All Phases

Count total pending tasks for this batch from the queue. Then process all of them through the remaining phases.

**How to invoke:**

```
/ralph {remaining_count} --batch {batch_id}
```

Or via Task tool:
```
Task(
  prompt = "Run /ralph {remaining_count} --batch {batch_id}",
  description = "process: {batch_id} ({remaining_count} tasks)"
)
```

This processes every feature through: trace -> update -> review.

Each phase runs in an isolated subagent with fresh context. /ralph handles all the orchestration: subagent spawning, handoff parsing, queue advancement, learnings capture.

**Progress reporting:**

```
$ Processing feature: {title}
  $ trace... done (N connections found)
  $ update... done (N feature records updated)
  $ review... done (PASS)
```

---

## Phase 4: Verify Completion

After /ralph finishes, verify all tasks for this batch are done.

Check the queue: count tasks for this batch that are NOT done.

**If tasks remain pending:**
- Report which tasks are incomplete and at which phase
- Suggest: "Run `/ralph --batch {batch_id}` to continue from where it stopped"
- Do NOT proceed to final report

**If all tasks are done:** Proceed to Phase 5.

---

## Phase 5: Final Report

```
--=={ pipeline }==--

Source: {source_or_description}
Batch: {batch_id}

Processing:
  Feature records created: {N}
  Connections added: {C}
  Feature register updated: {yes/no}
  Older feature records updated via update: {R}

Quality:
  Review checks: {PASS/FAIL count}

Feature records created:
- [[feature title 1]]
- [[feature title 2]]
- ...
```

If `--handoff` flag was set, also output:

```
=== RALPH HANDOFF: pipeline ===
Target: {source_or_description}

Work Done:
- Seeded source: {batch_id}
- Created {N} feature records
- Processed all features through 4-phase pipeline

Files Modified:
- features/ ({N} new feature records)
- features/index.md (updated)

Learnings:
- [Friction]: {description} | NONE
- [Surprise]: {description} | NONE
- [Methodology]: {description} | NONE
- [Process gap]: {description} | NONE

Queue Updates:
- All tasks for batch {batch_id} marked done
=== END HANDOFF ===
```

---

## Error Handling

**Phase failure at any stage:**
1. Report the failure with context (which phase, which task, what error)
2. Show the current queue state for this batch
3. Suggest remediation: "Run `/ralph --batch {batch_id}` to continue from where it stopped"
4. Do NOT attempt to continue automatically past failures

**The pipeline is resumable.** Queue state persists across sessions:
- /seed detects prior processing and asks whether to proceed
- /ralph picks up from the last completed phase (queue is the source of truth)

---

## Resumability

The pipeline is designed to be interrupted and resumed at any point:

| Interrupted At | How to Resume |
|----------------|---------------|
| Before seed | Run /pipeline again (starts fresh) |
| After seed, before document | /ralph 1 --batch {id} --type document |
| After document, during remaining phases | /ralph --batch {id} (picks up from failed phase) |

State lives in the queue file. The pipeline reads queue state, not session state.

---

## Edge Cases

**No target file:** List `staging/` candidates, suggest the best one based on age.

**Source already seeded:** /seed detects this and asks the user. If they decline, the pipeline stops cleanly.

**No ops/derivation-manifest.md:** Use universal vocabulary for all output.

---

## Critical Constraints

**never:**
- Skip the seed phase (duplicate detection is important)
- Continue past a failed phase automatically
- Process feature records inline instead of via /ralph subagents

**always:**
- Report progress at each phase boundary
- Verify all tasks are done before final report
- Show the user what was created (list of feature records)
- Suggest next steps if interrupted
- Use domain-native vocabulary from derivation manifest
