import importlib
import inspect

from viewer import managed_operations_registry, routes, specspace_v1_api


def _operation(operation_id: str) -> managed_operations_registry.ManagedOperation:
    operation = managed_operations_registry.operation_by_id(operation_id)
    assert operation is not None
    return operation


def _artifact_token(ref: str) -> str:
    normalized = ref.rsplit("://", 1)[-1].rsplit("/", 1)[-1]
    return normalized.replace("<request-id>.", "")


def _module_string_values(module: object) -> set[str]:
    return {value for value in vars(module).values() if isinstance(value, str)}


def test_managed_operations_have_unique_ids_and_endpoints() -> None:
    operations = managed_operations_registry.MANAGED_OPERATIONS

    operation_ids = [operation.operation_id for operation in operations]
    endpoints = [operation.endpoint for operation in operations]

    assert len(operation_ids) == len(set(operation_ids))
    assert len(endpoints) == len(set(endpoints))
    assert len(operations) >= 12


def test_managed_operations_routes_and_handlers_exist() -> None:
    for operation in managed_operations_registry.MANAGED_OPERATIONS:
        route = routes.route_for("POST", operation.endpoint)

        assert route is not None, operation.operation_id
        assert route.handler == operation.handler_name
        assert route.pass_parsed is True
        assert hasattr(specspace_v1_api, operation.handler_name)
        importlib.import_module(operation.implementation_module)


def test_managed_operations_use_normalized_state_vocabulary() -> None:
    vocabulary = set(managed_operations_registry.MANAGED_OPERATION_STATES)

    assert vocabulary == {
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
    }

    for operation in managed_operations_registry.MANAGED_OPERATIONS:
        assert operation.expected_ui_states
        assert set(operation.expected_ui_states).issubset(vocabulary)
        if "gate" in operation.operation_id or operation.category in {
            "repair",
            "approval",
            "promotion",
            "publication",
        }:
            assert "gate_needed" in operation.expected_ui_states


def test_managed_operations_safety_metadata_is_complete() -> None:
    required_flags = set(managed_operations_registry.SPECSPACE_WRITE_FLAGS_MUST_BE_FALSE)

    for operation in managed_operations_registry.MANAGED_OPERATIONS:
        assert operation.platform_command
        assert operation.platform_command[0] not in {"sh", "bash", "zsh"}
        assert "-c" not in operation.platform_command
        assert operation.input_refs
        assert set(operation.conditional_input_refs).issubset(operation.input_refs)
        assert operation.output_reports
        assert operation.idempotency_key
        assert operation.overwrite_policy
        assert operation.timeout_policy
        assert operation.replay_policy
        assert set(operation.write_capable_flags_must_be_false) == required_flags

        if operation.operation_id == "promotion_review_execute":
            assert operation.requires_explicit_confirmation
        if operation.operation_id == "read_model_publication_execute":
            assert operation.irreversible
            assert not operation.requires_explicit_confirmation


def test_managed_operations_cover_product_lifecycle_categories() -> None:
    categories = {
        operation.category
        for operation in managed_operations_registry.MANAGED_OPERATIONS
    }

    assert categories == {
        "workspace",
        "intake",
        "repair",
        "approval",
        "promotion",
        "publication",
    }


def test_managed_operation_records_are_serializable_contract_shape() -> None:
    records = managed_operations_registry.managed_operation_records()

    assert records
    assert {
        "operation_id",
        "endpoint",
        "handler_name",
        "implementation_module",
        "platform_command",
        "input_refs",
        "output_reports",
        "expected_ui_states",
    }.issubset(records[0])
    assert all(isinstance(record["platform_command"], tuple) for record in records)


def test_managed_operation_command_and_report_tokens_match_implementation() -> None:
    for operation in managed_operations_registry.MANAGED_OPERATIONS:
        module = importlib.import_module(operation.implementation_module)
        source = inspect.getsource(module)
        module_strings = _module_string_values(module)

        for token in operation.platform_command:
            assert token in source, (operation.operation_id, token)
        for output_ref in operation.output_reports:
            token = _artifact_token(output_ref)
            assert token in source or token in module_strings, (
                operation.operation_id,
                token,
            )


def test_managed_operation_registry_records_reviewed_artifact_edges() -> None:
    continuation = _operation("real_idea_answer_continuation_execute")
    assert (
        "runs/platform_product_workspace_initialization_execution_report.json"
        in continuation.input_refs
    )
    assert continuation.conditional_input_refs == (
        "specspace-state://idea_to_spec_intake_clarification_answers.json",
    )

    repair = _operation("repair_rerun_execute")
    assert "runs/specspace_repair_draft_import_preview.json" in repair.input_refs
    assert "runs/idea_to_spec_repair_session.json" in repair.input_refs
    assert (
        "runs/managed_repair_rerun_plans/<request-id>.platform_product_repair_rerun_execution_plan.json"
        in repair.output_reports
    )

    approval = _operation("candidate_approval_execute")
    assert "runs/repaired_candidate_promotion_handoff_report.json" not in (
        approval.input_refs
    )
    assert "runs/repaired_idea_to_spec_repair_session.json" in approval.input_refs
    assert "runs/repaired_idea_to_spec_promotion_gate.json" in approval.input_refs
    assert (
        "runs/platform_product_repair_rerun_execution_report.json"
        in approval.input_refs
    )
    assert (
        "runs/platform_candidate_approval_intent_gate_report.json"
        in approval.output_reports
    )

    promotion_request = _operation("promotion_request_execute")
    assert "runs/graph_repository_execution_plan.json" in promotion_request.input_refs


def test_consume_on_attempt_operations_require_new_request_for_retry() -> None:
    consume_on_attempt_operation_ids = {
        "real_idea_intake_execute",
        "real_idea_answer_continuation_execute",
        "repair_rerun_request_gate_execute",
        "repair_rerun_execute",
        "candidate_approval_execute",
    }

    for operation_id in consume_on_attempt_operation_ids:
        policy = _operation(operation_id).replay_policy
        assert "new UI" in policy
