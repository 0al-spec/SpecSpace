---
name: seed
description: Set up orchestrated processing batch for a source in staging/. Creates queue entries and task files for full document->trace->update->review pipeline. Triggers on "/seed", "/seed [file]", "process batch", "start pipeline".
version: "1.0"
generated_from: "arscontexta-v1.6"
user-invocable: true
allowed-tools: Read, Write, Grep, Glob, Bash
context: fork
---

## THE MISSION

Initialize a processing batch for staged content. Creates the queue infrastructure for orchestrated execution.

**Target: $ARGUMENTS**

## Workflow

1. Identify the source (staging/ file or description of feature to document)
2. Create `ops/queue/queue.json` if it doesn't exist
3. Add a queue entry for the batch:

```json
{
  "tasks": [
    {
      "id": "feature-001",
      "type": "feature",
      "status": "pending",
      "target": "[feature description]",
      "batch": "[source-name]",
      "created": "[ISO timestamp]",
      "current_phase": "document",
      "completed_phases": []
    }
  ]
}
```

4. Report: queue initialized, task count, recommended next step (`/arscontexta:pipeline`)
