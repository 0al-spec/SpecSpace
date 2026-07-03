# Idea-to-Spec Product Workspace Workplan

Status: active planning
Updated: 2026-07-03

## Purpose

Track the SpecSpace-facing work needed to make `product_idea_to_spec` usable as
a guided Product Workspace flow. This file is the tactical UI/product backlog
for the browser experience. It complements, but does not replace:

- Platform runbooks for proven end-to-end smoke procedures;
- SpecGraph roadmaps for producer-side artifacts, contracts, and pipeline
  behavior;
- cross-repo roadmap documents for sequencing across SpecGraph, SpecSpace, and
  Platform.

## Current Focus

End-to-end UI-started product idea flow:

```text
user enters raw idea in SpecSpace
  -> SpecSpace stores operator-owned local state
  -> Platform executes the controlled intake handoff
  -> SpecGraph emits intake / clarification artifacts
  -> SpecSpace refreshes the Product Workspace lifecycle
```

SpecSpace must remain an inspect/request surface. It must not execute
SpecGraph, Platform, Git Service, mutate candidate/canonical specs, write
Ontology packages, accept ontology terms, create branches, open PRs, merge
reviews, or publish read models.

## Recently Closed

- Raw idea entry state in SpecSpace.
- Browser E2E for raw idea submit into SpecSpace-owned mutable state.
- Workspace and `guided_flow` refresh after successful raw idea submit.
- Visible handoff command for controlled Platform intake execution.
- Product Workspace visibility for the Platform real idea intake execution
  report, including operations and generated output artifacts.

## Next Tasks

### 1. UI-Started Intake Execution Visibility

Show the result of the controlled intake handoff after an operator submits a raw
idea.

Status: partially closed. SpecSpace now shows the Platform intake execution
report when the artifact is published. The remaining work is to connect this to
the next browser E2E and artifact refresh path.

Acceptance criteria:

- Platform execution report is visible in the Product Workspace. Done.
- SpecGraph intake session / clarification request artifacts are reflected in
  `real_idea_intake`.
- `guided_flow` advances from `entry_submitted` to the appropriate
  clarification or candidate-source stage.
- Missing or failed execution is shown as an actionable blocker, not as silent
  stale state.

### 2. Browser E2E: Submit -> Platform Execute -> Clarification Requests

Extend the Playwright smoke from entry persistence to the first external
handoff.

Status: partially closed. Browser E2E now covers raw idea submit followed by an
externally published intake execution/clarification projection. A future
hardening slice can replace the projection step with a real Platform subprocess
when the test environment reliably provides Platform and SpecGraph checkouts.

Acceptance criteria:

- The test uses the browser for raw idea entry. Done.
- The test harness may run Platform/SpecGraph outside the browser.
- The browser never receives execution authority. Done.
- After artifact publication/refresh, the UI shows clarification requests or a
  ready candidate-source state. Done with projected publication.

### 3. Clarification Answer UI E2E

Cover the next user-facing loop after intake questions appear.

Acceptance criteria:

- User fills clarification answers in SpecSpace.
- SpecSpace-owned answer state is saved and validated.
- Import preview / continuation lane is visible.
- Invalid or missing answers produce clear UI diagnostics.

### 4. Artifact Refresh And Runs-Watch Hardening

Make the Product Workspace update predictably after external Platform/SpecGraph
execution.

Acceptance criteria:

- UI refreshes relevant idea-to-spec surfaces after artifact changes.
- Manual reload is not the normal happy path.
- Workspace artifact base, SpecSpace state directory, and SpecGraph run
  directory drift are visible as diagnostics.

### 5. Operator Handoff UX

Make controlled handoffs understandable without giving SpecSpace execution
authority.

Acceptance criteria:

- Copyable command hints are paired with source refs and expected outputs.
- Last execution report is shown next to the current lifecycle stage.
- Next safe step, blockers, and authority boundary stay aligned.

## Known Friction

- UI submit persists raw idea entry, but does not execute the intake pipeline.
- E2E currently proves the entry boundary, not the full lifecycle.
- Some browser tests still use a fixture-backed `/api/v1/idea-to-spec-workspace`
  projection while only mutable state APIs are real.
- Local state directory, SpecGraph run directory, and product workspace artifact
  base can drift during manual smoke runs.
- Clarification answer flow is not yet covered by browser E2E.
- Operator handoff commands are visible, but execution status is not yet a
  first-class part of the UI-started intake stage.

## Cross-Repo Coordination

Use this file for SpecSpace UX tasks only. When a task requires producer-side
contracts or execution boundaries, update the corresponding repo as well:

- SpecGraph: artifact contracts, Make targets, validators, public bundle
  surfaces, candidate lifecycle reports.
- Platform: controlled execution wrappers, Git Service handoff, product
  runbooks, smoke profiles.
- Metrics: idea maturity schema/validator contracts.

When a cross-repo task lands, keep this workplan focused on the remaining
SpecSpace-facing behavior rather than duplicating full PR histories.
