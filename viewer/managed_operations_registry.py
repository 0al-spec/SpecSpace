"""Registry for SpecSpace backend-managed product workspace operations.

The registry is intentionally descriptive. Execution remains implemented in the
per-operation modules, while tests use this table to catch route, handler,
selected command, report-path, and safety-policy drift.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


MANAGED_OPERATION_STATES: tuple[str, ...] = (
    "unavailable",
    "request_needed",
    "gate_needed",
    "ready_to_execute",
    "execution_requested",
    "running_or_waiting",
    "failed",
    "stale",
    "completed",
    "blocked",
)

SPECSPACE_WRITE_FLAGS_MUST_BE_FALSE: tuple[str, ...] = (
    "browser_executes_platform",
    "browser_executes_shell",
    "specspace_mutates_candidate_artifacts",
    "specspace_mutates_canonical_specs",
    "specspace_writes_ontology_packages",
    "specspace_accepts_ontology_terms",
    "specspace_creates_git_branch",
    "specspace_creates_git_commit",
    "specspace_opens_pull_request",
    "specspace_merges_pull_request",
    "specspace_publishes_read_model",
)


@dataclass(frozen=True)
class ManagedOperation:
    operation_id: str
    category: str
    lifecycle_stage: str
    ui_stage: str
    endpoint: str
    handler_name: str
    implementation_module: str
    platform_command: tuple[str, ...]
    input_refs: tuple[str, ...]
    output_reports: tuple[str, ...]
    idempotency_key: str
    overwrite_policy: str
    timeout_policy: str
    replay_policy: str
    expected_ui_states: tuple[str, ...]
    dry_run_only: bool = False
    irreversible: bool = False
    requires_explicit_confirmation: bool = False
    write_capable_flags_must_be_false: tuple[str, ...] = (
        SPECSPACE_WRITE_FLAGS_MUST_BE_FALSE
    )
    notes: str = ""


_COMMON_EARLY_STATES = (
    "unavailable",
    "request_needed",
    "ready_to_execute",
    "running_or_waiting",
    "failed",
    "stale",
    "completed",
    "blocked",
)

_COMMON_GATE_STATES = (
    "unavailable",
    "request_needed",
    "gate_needed",
    "ready_to_execute",
    "running_or_waiting",
    "failed",
    "stale",
    "completed",
    "blocked",
)


MANAGED_OPERATIONS: tuple[ManagedOperation, ...] = (
    ManagedOperation(
        operation_id="workspace_initialization_execute",
        category="workspace",
        lifecycle_stage="workspace_initialization",
        ui_stage="Workspace initialization",
        endpoint="/api/v1/product-workspace-initialization/execute",
        handler_name="handle_v1_product_workspace_initialization_execute_post",
        implementation_module="viewer.product_workspace_initialization_execution",
        platform_command=("workspace", "execute-requested-initialization"),
        input_refs=("runs/product_workspace_initialization_execution_request.json",),
        output_reports=(
            "runs/platform_product_workspace_initialization_execution_report.json",
        ),
        idempotency_key="execution_request.summary.idempotency_key",
        overwrite_policy="Reject missing, stale, or mismatched execution request refs; Platform validates request digest before writing the report.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout returns specspace_managed_workspace_initialization_execution with executed=false.",
        replay_policy="Same execution request is idempotent at Platform request level; mutated request digests must be rejected.",
        expected_ui_states=_COMMON_EARLY_STATES,
    ),
    ManagedOperation(
        operation_id="real_idea_intake_execute",
        category="intake",
        lifecycle_stage="intake",
        ui_stage="Real idea intake",
        endpoint="/api/v1/real-idea-intake/execute",
        handler_name="handle_v1_real_idea_intake_execute_post",
        implementation_module="viewer.real_idea_intake_execution",
        platform_command=("product-real-idea-intake", "execute-requested"),
        input_refs=(
            "specspace-state://real_idea_intake_execution_requests.json",
            "specspace-state://real_idea_entry_requests.json",
            "runs/platform_product_workspace_initialization_execution_report.json",
        ),
        output_reports=("runs/platform_real_idea_entry_intake_execution_report.json",),
        idempotency_key="execution_request.request_id",
        overwrite_policy="Consumes only the active SpecSpace-owned execution request for the selected workspace and existing initialization evidence.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout leaves raw idea state local-only and reports executed=false.",
        replay_policy="The request is consumed before Platform execution; retry after timeout or failure requires a new UI execution request.",
        expected_ui_states=_COMMON_EARLY_STATES,
    ),
    ManagedOperation(
        operation_id="real_idea_answer_continuation_execute",
        category="intake",
        lifecycle_stage="clarification",
        ui_stage="Guided clarification continuation",
        endpoint="/api/v1/real-idea-answer-continuation/execute",
        handler_name="handle_v1_real_idea_answer_continuation_execute_post",
        implementation_module="viewer.real_idea_answer_continuation_execution",
        platform_command=("product-real-idea-continuation", "execute-requested"),
        input_refs=(
            "specspace-state://real_idea_answer_continuation_execution_requests.json",
            "specspace-state://idea_to_spec_intake_clarification_answers.json",
            "runs/platform_product_workspace_initialization_execution_report.json",
            "runs/platform_real_idea_entry_intake_execution_report.json",
        ),
        output_reports=(
            "runs/platform_real_idea_answer_continuation_execution_report.json",
        ),
        idempotency_key="execution_request.request_id",
        overwrite_policy="Refuses stale continuation requests and preserves existing ready artifacts on failed materialization.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout returns managed continuation report with executed=false.",
        replay_policy="The request is consumed before Platform execution; retry after timeout or failure requires a new UI continuation request.",
        expected_ui_states=_COMMON_EARLY_STATES,
    ),
    ManagedOperation(
        operation_id="repair_rerun_request_gate_execute",
        category="repair",
        lifecycle_stage="repair",
        ui_stage="Guided repair request gate",
        endpoint="/api/v1/idea-to-spec-repair-rerun-request-gate/execute",
        handler_name="handle_v1_idea_to_spec_repair_rerun_request_gate_execute_post",
        implementation_module="viewer.idea_to_spec_repair_rerun_request_gate_execution",
        platform_command=("product-repair-rerun", "request-gate"),
        input_refs=(
            "specspace-state://idea_to_spec_repair_rerun_requests.json",
            "runs/specspace_repair_draft_import_preview.json",
            "runs/idea_to_spec_repair_session.json",
        ),
        output_reports=(
            "runs/platform_product_repair_rerun_request_gate_execution_report.json",
            "runs/specspace_repair_rerun_request_gate.json",
        ),
        idempotency_key="rerun_request.request_id",
        overwrite_policy="Builds or refreshes only the request gate for the active repair request/session.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout does not execute repair rerun.",
        replay_policy="The request is consumed before Platform execution; retry after timeout or failure requires a new UI repair rerun request.",
        expected_ui_states=_COMMON_GATE_STATES,
    ),
    ManagedOperation(
        operation_id="repair_rerun_execute",
        category="repair",
        lifecycle_stage="repair",
        ui_stage="Guided repair rerun",
        endpoint="/api/v1/idea-to-spec-repair-rerun/execute",
        handler_name="handle_v1_idea_to_spec_repair_rerun_execute_post",
        implementation_module="viewer.idea_to_spec_repair_rerun_execution",
        platform_command=("product-repair-rerun", "plan", "execute"),
        input_refs=(
            "specspace-state://idea_to_spec_repair_rerun_requests.json",
            "runs/specspace_repair_draft_import_preview.json",
            "runs/idea_to_spec_repair_session.json",
            "runs/specspace_repair_rerun_request_gate.json",
        ),
        output_reports=(
            "runs/managed_repair_rerun_plans/<request-id>.platform_product_repair_rerun_execution_plan.json",
            "runs/platform_product_repair_rerun_execution_report.json",
        ),
        idempotency_key="rerun_request.request_id",
        overwrite_policy="Writes a managed plan path and executes only after the request gate is ready.",
        timeout_policy="Plan and execute phases are separately timeout bounded and surfaced as failed/pending evidence.",
        replay_policy="The request is consumed before Platform execution; retry after timeout or failure requires a new UI repair rerun request.",
        expected_ui_states=_COMMON_GATE_STATES,
    ),
    ManagedOperation(
        operation_id="repair_rerun_publish",
        category="repair",
        lifecycle_stage="repair",
        ui_stage="Guided repair publication",
        endpoint="/api/v1/idea-to-spec-repair-rerun/publish",
        handler_name="handle_v1_idea_to_spec_repair_rerun_publish_post",
        implementation_module="viewer.idea_to_spec_repair_rerun_publication",
        platform_command=("product-repair-rerun", "publish"),
        input_refs=("runs/platform_product_repair_rerun_execution_report.json",),
        output_reports=("runs/platform_product_repair_rerun_publication_report.json",),
        idempotency_key="execution_report.summary.execution_id",
        overwrite_policy="Publishes public-safe bundle evidence only after successful repair rerun execution.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout keeps prior publication report unchanged.",
        replay_policy="Replay is allowed only against the same successful execution report and workspace bundle target.",
        expected_ui_states=_COMMON_GATE_STATES,
    ),
    ManagedOperation(
        operation_id="candidate_approval_execute",
        category="approval",
        lifecycle_stage="approval",
        ui_stage="Guided candidate approval",
        endpoint="/api/v1/idea-to-spec-candidate-approval/execute",
        handler_name="handle_v1_idea_to_spec_candidate_approval_execute_post",
        implementation_module="viewer.idea_to_spec_candidate_approval_execution",
        platform_command=("product-candidate-approval", "approve"),
        input_refs=(
            "specspace-state://idea_to_spec_candidate_approval_intents.json",
            "runs/repaired_active_idea_to_spec_candidate.json",
            "runs/repaired_idea_to_spec_repair_session.json",
            "runs/repaired_idea_to_spec_promotion_gate.json",
            "runs/platform_product_repair_rerun_execution_report.json",
            "runs/platform_product_repair_rerun_publication_report.json",
        ),
        output_reports=(
            "runs/platform_candidate_approval_intent_gate_report.json",
            "runs/platform_candidate_approval_execution_report.json",
            "runs/candidate_approval_decision.json",
        ),
        idempotency_key="approval_intent.intent_id",
        overwrite_policy="Materializes approval only when gate is ready; failed execution cannot replace a ready decision.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout leaves Git and promotion state untouched.",
        replay_policy="The approval intent is consumed before Platform execution; retry after timeout or failure requires a new UI approval intent.",
        expected_ui_states=_COMMON_GATE_STATES,
    ),
    ManagedOperation(
        operation_id="promotion_request_execute",
        category="promotion",
        lifecycle_stage="promotion",
        ui_stage="Guided promotion request",
        endpoint="/api/v1/idea-to-spec-promotion-request/execute",
        handler_name="handle_v1_idea_to_spec_promotion_request_execute_post",
        implementation_module="viewer.idea_to_spec_promotion_request_execution",
        platform_command=("product-candidate-promotion", "request"),
        input_refs=(
            "runs/graph_repository_execution_plan.json",
            "runs/candidate_approval_decision.json",
        ),
        output_reports=("runs/graph_repository_promotion_request.json",),
        idempotency_key="candidate_approval_decision.decision_id",
        overwrite_policy="Creates the promotion request only from the selected approval decision and product graph plan.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout leaves Git Service uninvoked.",
        replay_policy="Existing matching promotion request is reused; mismatched candidate/workspace refs are blocked.",
        expected_ui_states=_COMMON_GATE_STATES,
    ),
    ManagedOperation(
        operation_id="promotion_execute_dry_run",
        category="promotion",
        lifecycle_stage="promotion",
        ui_stage="Guided promotion dry-run",
        endpoint="/api/v1/idea-to-spec-promotion/execute",
        handler_name="handle_v1_idea_to_spec_promotion_execute_post",
        implementation_module="viewer.idea_to_spec_promotion_execution",
        platform_command=(
            "product-candidate-promotion",
            "execute",
            "--dry-run",
            "--open-review-dry-run",
        ),
        input_refs=(
            "runs/graph_repository_promotion_request.json",
            "runs/candidate_approval_decision.json",
        ),
        output_reports=(
            "runs/product_candidate_promotion_execution_report.json",
            "runs/git_service_promotion_execution_report.json",
        ),
        idempotency_key="promotion_request.request_id",
        overwrite_policy="Dry-run reports are refreshable and must not create worktrees, commits, PRs, or read models.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout is surfaced as dry-run incomplete.",
        replay_policy="Replay is allowed only as dry-run inspection for the same request and approval refs.",
        expected_ui_states=_COMMON_GATE_STATES,
        dry_run_only=True,
    ),
    ManagedOperation(
        operation_id="promotion_review_execute",
        category="promotion",
        lifecycle_stage="promotion",
        ui_stage="Guided promotion review",
        endpoint="/api/v1/idea-to-spec-promotion-review/execute",
        handler_name="handle_v1_idea_to_spec_promotion_review_execute_post",
        implementation_module="viewer.idea_to_spec_promotion_execution",
        platform_command=("product-candidate-promotion", "execute"),
        input_refs=(
            "runs/graph_repository_promotion_request.json",
            "runs/candidate_approval_decision.json",
            "runs/product_candidate_promotion_execution_report.json",
        ),
        output_reports=(
            "runs/product_candidate_promotion_execution_report.json",
            "runs/git_service_promotion_execution_report.json",
        ),
        idempotency_key="promotion_request.request_id",
        overwrite_policy="Requires explicit operator confirmation and prior dry-run evidence before non-dry-run Git Service execution.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout requires operator inspection before retry.",
        replay_policy="Replay must not open duplicate review PRs; Platform/Git Service owns branch and PR idempotency.",
        expected_ui_states=_COMMON_GATE_STATES,
        irreversible=True,
        requires_explicit_confirmation=True,
        notes="This may create a worktree, branch, commit, and review PR through Platform/Git Service.",
    ),
    ManagedOperation(
        operation_id="review_status_execute",
        category="publication",
        lifecycle_stage="publication",
        ui_stage="Guided review status",
        endpoint="/api/v1/idea-to-spec-review-status/execute",
        handler_name="handle_v1_idea_to_spec_review_status_execute_post",
        implementation_module="viewer.idea_to_spec_review_status_execution",
        platform_command=("product-candidate-promotion", "review-status"),
        input_refs=("runs/product_candidate_promotion_execution_report.json",),
        output_reports=(
            "runs/product_candidate_promotion_review_status_report.json",
        ),
        idempotency_key="review.pr_number",
        overwrite_policy="Refreshes read-only review status only after non-dry-run promotion execution opened a review.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout does not mutate Git.",
        replay_policy="Replay is safe read-only inspection for the same review PR.",
        expected_ui_states=_COMMON_GATE_STATES,
    ),
    ManagedOperation(
        operation_id="read_model_publication_execute",
        category="publication",
        lifecycle_stage="publication",
        ui_stage="Guided read-model publication",
        endpoint="/api/v1/idea-to-spec-read-model-publication/execute",
        handler_name="handle_v1_idea_to_spec_read_model_publication_execute_post",
        implementation_module="viewer.idea_to_spec_read_model_publication_execution",
        platform_command=("product-candidate-promotion", "publish-read-model"),
        input_refs=(
            "runs/product_candidate_promotion_review_status_report.json",
            "dist/specgraph-public/workspaces/<workspace-id>",
        ),
        output_reports=(
            "runs/product_candidate_promotion_read_model_publication_report.json",
        ),
        idempotency_key="review.merge_commit_sha",
        overwrite_policy="Publishes public-safe read model only after merged review-status evidence.",
        timeout_policy="Bounded by platform_execution_timeout_seconds; timeout leaves previous read model publication evidence inspectable.",
        replay_policy="Replay must use the same merged review evidence and workspace output directory.",
        expected_ui_states=_COMMON_GATE_STATES,
        irreversible=True,
        notes="This publishes public read-model files through Platform; it still does not mutate specs or Ontology.",
    ),
)


def operation_by_id(operation_id: str) -> ManagedOperation | None:
    for operation in MANAGED_OPERATIONS:
        if operation.operation_id == operation_id:
            return operation
    return None


def managed_operation_records() -> list[dict[str, Any]]:
    return [asdict(operation) for operation in MANAGED_OPERATIONS]


def managed_operation_endpoints() -> set[str]:
    return {operation.endpoint for operation in MANAGED_OPERATIONS}
