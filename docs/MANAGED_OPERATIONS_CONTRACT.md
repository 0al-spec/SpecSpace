# SpecSpace Managed Operations Contract

This document is the human-readable inventory for Product Workspace
backend-managed operations. The machine-readable source is
`viewer/managed_operations_registry.py`; tests assert that this registry stays
aligned with `viewer/routes.py` and `viewer/specspace_v1_api.py`.

## Scope

Managed operations are opt-in backend actions where the browser asks SpecSpace
to call an allowlisted Platform wrapper. They exist to reduce operator copy/paste
without giving the browser shell, Git, SpecGraph, or Ontology authority.

The authority boundary is:

- the browser never executes Platform or shell commands directly;
- SpecSpace backend only calls allowlisted Platform command families;
- every operation is workspace-scoped;
- every operation must return durable report evidence;
- SpecSpace does not mutate candidate/canonical specs directly;
- SpecSpace does not write Ontology packages or accept Ontology terms;
- Git and read-model effects stay behind Platform/Git Service wrappers.

## Agent Surface Alignment

SpecSpace intends to use the Agent Surface Protocol as the future vocabulary
for describing Product Workspace operations to agents and external runtimes.
That alignment is not a production conformance claim yet.

Feature Passport evidence is a separate future viewer line. SpecSpace should
not normalize managed-operation reports into Feature Passport receipts or infer
Feature Evidence ladder state locally; it should wait for SpecGraph-owned
derived artifacts aligned with `FP-RFC-0001` `0.2.0`.

Current state:

- SpecSpace has an internal managed operation registry with operation ids,
  UI stages, endpoints, Platform command families, outputs, idempotency
  metadata, and authority flags.
- The registry is a candidate Agent Surface action catalog, but SpecSpace does
  not publish `/.well-known/agent-surface.json` as a stable public surface.
- Durable Platform and SpecGraph reports are candidate receipt evidence, but
  they are not normalized Agent Surface receipts yet.
- SpecSpace is not a grant-enforcing application: it does not issue Agent
  Grants, bind external runtimes to grants, accept external runtime action
  requests, or implement revocation UI.
- Production may remain read-only even when the local/development backend has
  managed operations enabled.

Near-term Agent Surface mapping should be additive:

| Managed operations field | Agent Surface-aligned meaning |
| --- | --- |
| `operation_id` | Candidate action id. |
| UI stage and state vocabulary | Human-readable action lifecycle. |
| Platform command family | Backend executor binding, not browser authority. |
| Required inputs and output refs | Action request preconditions and receipt refs. |
| Idempotency metadata | Action retry scope. |
| Authority flags | App-side enforcement summary. |

Do not add Agent Surface grants, runtime pairing, external agent execution, or
public well-known manifest publication until the protocol draft and local
operation registry are intentionally versioned together.

## UI State Vocabulary

Product Workspace UI projections should use this vocabulary for managed
operation paths:

| State | Meaning |
| --- | --- |
| `unavailable` | Backend execution is not configured or the operation is not valid for this workspace. |
| `request_needed` | Operator-owned intent/state is missing. |
| `gate_needed` | A validation gate or preflight report must be built before execution. |
| `ready_to_execute` | The backend can execute the allowlisted Platform wrapper. |
| `execution_requested` | The operator has asked for execution, but durable result evidence is not visible yet. |
| `running_or_waiting` | Execution may be in progress or waiting for external publication/refresh. |
| `failed` | Durable execution evidence exists and reports failure. |
| `stale` | State/artifact refs do not match the selected workspace/session. |
| `completed` | Durable success evidence exists for this operation. |
| `blocked` | A policy, gate, authority, or lifecycle condition blocks the next step. |

## Operation Inventory

| Operation id | UI stage | Endpoint | Platform command | Primary outputs |
| --- | --- | --- | --- | --- |
| `workspace_initialization_execute` | Workspace initialization | `POST /api/v1/product-workspace-initialization/execute` | `workspace execute-requested-initialization` | `runs/platform_product_workspace_initialization_execution_report.json` |
| `real_idea_intake_execute` | Real idea intake | `POST /api/v1/real-idea-intake/execute` | `product-real-idea-intake execute-requested` | `runs/platform_real_idea_entry_intake_execution_report.json` |
| `real_idea_answer_continuation_execute` | Guided clarification continuation | `POST /api/v1/real-idea-answer-continuation/execute` | `product-real-idea-continuation execute-requested` | `runs/platform_real_idea_answer_continuation_execution_report.json` |
| `repair_rerun_request_gate_execute` | Guided repair request gate | `POST /api/v1/idea-to-spec-repair-rerun-request-gate/execute` | `product-repair-rerun request-gate` | `runs/platform_product_repair_rerun_request_gate_execution_report.json`, `runs/specspace_repair_rerun_request_gate.json` |
| `repair_rerun_execute` | Guided repair rerun | `POST /api/v1/idea-to-spec-repair-rerun/execute` | `product-repair-rerun plan` then `product-repair-rerun execute` | `runs/managed_repair_rerun_plans/<request-id>.platform_product_repair_rerun_execution_plan.json`, `runs/platform_product_repair_rerun_execution_report.json` |
| `repair_rerun_publish` | Guided repair publication | `POST /api/v1/idea-to-spec-repair-rerun/publish` | `product-repair-rerun publish` | `runs/platform_product_repair_rerun_publication_report.json` |
| `candidate_approval_execute` | Guided candidate approval | `POST /api/v1/idea-to-spec-candidate-approval/execute` | `product-candidate-approval approve` | `runs/platform_candidate_approval_intent_gate_report.json`, `runs/platform_candidate_approval_execution_report.json`, `runs/candidate_approval_decision.json` |
| `promotion_request_execute` | Guided promotion request | `POST /api/v1/idea-to-spec-promotion-request/execute` | `product-candidate-promotion request` | `runs/graph_repository_promotion_request.json` |
| `promotion_execute_dry_run` | Guided promotion dry-run | `POST /api/v1/idea-to-spec-promotion/execute` | `product-candidate-promotion execute --dry-run --open-review-dry-run` | `runs/product_candidate_promotion_execution_report.json`, `runs/git_service_promotion_execution_report.json` |
| `promotion_review_execute` | Guided promotion review | `POST /api/v1/idea-to-spec-promotion-review/execute` | `product-candidate-promotion execute` | `runs/product_candidate_promotion_execution_report.json`, `runs/git_service_promotion_execution_report.json` |
| `review_status_execute` | Guided review status | `POST /api/v1/idea-to-spec-review-status/execute` | `product-candidate-promotion review-status` | `runs/product_candidate_promotion_review_status_report.json` |
| `read_model_publication_execute` | Guided read-model publication | `POST /api/v1/idea-to-spec-read-model-publication/execute` | `product-candidate-promotion publish-read-model` | `runs/product_candidate_promotion_read_model_publication_report.json` |

## Idempotency And Replay Policy

Each operation has a declared idempotency source in
`viewer/managed_operations_registry.py`. In general:

- request-driven operations use the active request id or request digest;
- approval and promotion use the selected approval decision or promotion
  request;
- review-status inspection uses the review PR identity;
- read-model publication uses merged review evidence.

Replay is acceptable only when the selected workspace, request/artifact refs,
and digests still match. Some operations consume their request or intent before
invoking Platform; after timeout or failure, retry requires a newly submitted UI
request/intent rather than resubmitting the same request id. Stale or
cross-workspace state must remain `stale` or `blocked`, not `ready_to_execute`.

## Overwrite Policy

Managed operations should preserve durable successful evidence unless the same
workspace-scoped request/ref set is being refreshed. Failed imports, failed
materialization, malformed reports, and timeout reports must not silently replace
ready candidate, approval, promotion, or publication artifacts.

Non-dry-run Git review execution requires explicit operator confirmation.
Read-model publication requires merged review-status evidence but is not
currently protected by an extra confirmation field. Dry-run promotion must not
create worktrees, commits, pull requests, or read models.

## Timeout Policy

Every backend-managed operation is bounded by
`platform_execution_timeout_seconds`. A timeout is a durable failed execution
state and should keep the next UI action as inspect/recreate request or retry
only when the operation is still replayable; it must not advance the lifecycle.

## Regression Matrix

The current regression suite should keep covering these categories:

| Category | Required coverage |
| --- | --- |
| Route/handler registry | Every operation id maps to a POST route and a concrete handler. |
| State vocabulary | UI projections use the normalized state vocabulary above. |
| Authority flags | Browser/SpecSpace write-capable flags must be explicitly false. |
| Stale/replay | Cross-workspace or stale request/artifact refs block execution. |
| Timeout/failure | Timeout and failed reports are visible and do not advance lifecycle. |
| Dry-run guard | Promotion dry-run never opens PRs or writes read models. |
| Non-dry-run guard | Promotion review and read-model publication require explicit confirmation and prior evidence. |
| Happy path | Playwright exercises a UI-started managed lifecycle through workspace, intake, clarification, repair, approval, and promotion handoffs. |

When adding a new managed operation, update the registry first, then add route,
handler, UI state projection, docs, and regression coverage.
