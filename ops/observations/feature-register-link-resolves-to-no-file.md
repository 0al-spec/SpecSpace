---
description: Template-mandated [[feature register]] links fail the review skill's filename-based dangling-link check because the register file is features/index.md
category: process-gap
status: pending
observed: 2026-07-03
---

# the mandated [[feature register]] link points at a file name that does not exist

`templates/feature-record.md` (Areas footer) and
`docs/agent/feature-knowledge-system.md` (link conventions section) both
require every feature record to link `[[feature register]]`. The register
itself lives at `features/index.md`, so the /review skill's link-health check
(`find . -name "feature register.md"`) reports the link as dangling on every
record that follows the template correctly.

Neither prescribed fix applies: creating `features/feature register.md` would
duplicate the hub, and removing the link violates the template. Resolution
needs a system-level decision — rename the hub file to match the link, add an
alias mechanism, or teach the link-health check that `[[feature register]]`
resolves to `features/index.md`.

Until triaged, [[feature register]] links in records should be treated as a
known alias, not a defect.
